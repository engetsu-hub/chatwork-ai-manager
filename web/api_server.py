from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import uvicorn

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.main import ChatWorkAIManager
from src.config import Config
from src.chatwork_api import ChatWorkMessage

logger = logging.getLogger(__name__)

# Pydanticモデル
class MessageAnalysisRequest(BaseModel):
    body: str
    account_name: str = "Test User"
    account_id: int = 0

class RoomCheckRequest(BaseModel):
    room_id: str

class AlertMarkRequest(BaseModel):
    room_id: str
    message_id: str

class MessageReplyRequest(BaseModel):
    message_id: str
    room_id: str
    reply_body: str
    original_sender: Optional[str] = None

class MessageReactionRequest(BaseModel):
    message_id: str
    room_id: str
    reaction: str

class MessageQuoteRequest(BaseModel):
    message_id: str
    room_id: str
    original_body: str
    quote_comment: Optional[str] = None

class ConfigUpdateRequest(BaseModel):
    monitored_rooms: List[str]
    monitoring_interval: int = 30
    high_priority_threshold_minutes: int = 30
    normal_priority_threshold_hours: int = 2

# WebSocketマネージャー
class WebSocketManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected. Total connections: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")
    
    async def broadcast(self, message: dict):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Error sending to WebSocket: {e}")
                disconnected.append(connection)
        
        # 切断されたコネクションを削除
        for conn in disconnected:
            self.disconnect(conn)

# FastAPIアプリケーション
app = FastAPI(title="ChatWork AI Manager", version="1.0.0")

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 静的ファイル
app.mount("/static", StaticFiles(directory="static"), name="static")

# グローバル変数
ai_manager: ChatWorkAIManager = None
websocket_manager = WebSocketManager()

@app.on_event("startup")
async def startup_event():
    """アプリケーション起動時の処理"""
    global ai_manager
    try:
        config = Config()
        ai_manager = ChatWorkAIManager(config)
        
        # バックグラウンドでAIマネージャーを起動
        asyncio.create_task(start_ai_manager())
        
        logger.info("FastAPI server started")
    except Exception as e:
        logger.error(f"Startup error: {e}")

async def start_ai_manager():
    """AIマネージャーをバックグラウンドで起動"""
    try:
        # メッセージ処理時にWebSocketで通知するようにカスタマイズ
        original_process_message = ai_manager.process_message
        
        async def enhanced_process_message(message):
            result = await original_process_message(message)
            
            # WebSocketで通知
            await websocket_manager.broadcast({
                "type": "new_message",
                "data": {
                    "room_id": message.room_id,
                    "message_id": message.message_id,
                    "sender": message.account.name,
                    "body": message.body[:100] + ("..." if len(message.body) > 100 else ""),
                    "timestamp": message.send_time
                }
            })
            
            return result
        
        ai_manager.process_message = enhanced_process_message
        await ai_manager.start()
        
    except Exception as e:
        logger.error(f"AI Manager error: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    """アプリケーション終了時の処理"""
    global ai_manager
    if ai_manager:
        await ai_manager.stop()

# =====================
# Web UIエンドポイント
# =====================

@app.get("/", response_class=HTMLResponse)
async def get_dashboard():
    """メインダッシュボード"""
    with open("static/index.html", "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

# =====================
# API エンドポイント
# =====================

@app.get("/api/status")
async def get_status():
    """システムステータス取得"""
    if not ai_manager:
        raise HTTPException(status_code=503, detail="AI Manager not initialized")
    
    try:
        status = await ai_manager.get_status()
        alert_summary = await ai_manager.alert_system.get_pending_alerts_summary()
        
        return {
            "system": status,
            "alerts": alert_summary,
            "timestamp": status["last_check"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/rooms")
async def get_rooms():
    """ルーム一覧取得"""
    if not ai_manager:
        raise HTTPException(status_code=503, detail="AI Manager not initialized")
    
    try:
        rooms = await ai_manager.chatwork_api.get_rooms()
        return {"rooms": rooms}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/rooms/categories")
async def get_room_categories():
    """ルームをカテゴリ別に分類して取得"""
    if not ai_manager:
        raise HTTPException(status_code=503, detail="AI Manager not initialized")
    
    try:
        categories = await ai_manager.chatwork_api.get_room_categories()
        return {"categories": categories}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/messages/{room_id}")
async def get_messages(room_id: str, limit: int = 50):
    """メッセージ取得"""
    if not ai_manager:
        raise HTTPException(status_code=503, detail="AI Manager not initialized")
    
    try:
        messages = await ai_manager.chatwork_api.get_messages(room_id, force=1)
        
        # メッセージを辞書形式に変換
        message_list = []
        for msg in messages[-limit:]:  # 最新のメッセージを取得
            message_list.append({
                "message_id": msg.message_id,
                "account": {
                    "account_id": msg.account.account_id,
                    "name": msg.account.name,
                    "avatar_image_url": msg.account.avatar_image_url
                },
                "body": msg.body,
                "send_time": msg.send_time,
                "update_time": msg.update_time
            })
        
        return {"messages": message_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/alerts")
async def get_alerts():
    """アラート一覧取得"""
    if not ai_manager:
        raise HTTPException(status_code=503, detail="AI Manager not initialized")
    
    try:
        summary = await ai_manager.alert_system.get_pending_alerts_summary()
        
        # 詳細なアラート情報も含める
        pending_alerts = []
        for alert_id, alert in ai_manager.alert_system.pending_alerts.items():
            pending_alerts.append({
                "alert_id": alert_id,
                "room_id": alert.message.room_id,
                "message_id": alert.message.message_id,
                "sender": alert.message.account.name,
                "body": alert.message.body[:200],
                "priority": alert.analysis.priority,
                "added_at": alert.added_at.isoformat(),
                "alerts_sent": alert.alerts_sent,
                "escalation_level": alert.escalation_level
            })
        
        return {
            "summary": summary,
            "pending_alerts": pending_alerts,
            "total_deleted_messages": sum(len(msgs) for msgs in ai_manager.chatwork_api.deleted_messages.values())
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/processed-messages")
async def get_processed_messages(limit: int = 50):
    """処理済みメッセージの詳細取得"""
    if not ai_manager:
        raise HTTPException(status_code=503, detail="AI Manager not initialized")
    
    try:
        messages = await ai_manager.get_processed_messages(limit)
        return {"messages": messages, "total": len(messages)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze")
async def analyze_message(request: MessageAnalysisRequest):
    """メッセージ分析"""
    if not ai_manager:
        raise HTTPException(status_code=503, detail="AI Manager not initialized")
    
    try:
        # テスト用のメッセージオブジェクトを作成
        from src.chatwork_api import ChatWorkMessage, ChatWorkAccount
        
        account = ChatWorkAccount(
            account_id=request.account_id,
            name=request.account_name
        )
        
        message = ChatWorkMessage(
            message_id="test",
            room_id="test",
            account=account,
            body=request.body,
            send_time=int(asyncio.get_event_loop().time()),
            update_time=int(asyncio.get_event_loop().time())
        )
        
        analysis = await ai_manager.task_analyzer.analyze(message)
        
        return {
            "requires_reply": analysis.requires_reply,
            "priority": analysis.priority,
            "tasks": [
                {
                    "description": task.description,
                    "assignees": task.assignees,
                    "deadline": task.deadline,
                    "priority": task.priority
                }
                for task in analysis.tasks
            ],
            "questions": analysis.questions,
            "mentions": analysis.mentions,
            "sentiment": analysis.sentiment,
            "summary": analysis.summary,
            "confidence_score": analysis.confidence_score
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/rooms/{room_id}/check")
async def check_room(room_id: str):
    """特定ルームの手動チェック"""
    if not ai_manager:
        raise HTTPException(status_code=503, detail="AI Manager not initialized")
    
    try:
        result = await ai_manager.manual_check_room(room_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/alerts/mark-replied")
async def mark_alert_replied(request: AlertMarkRequest):
    """アラートを返信済みとしてマーク"""
    if not ai_manager:
        raise HTTPException(status_code=503, detail="AI Manager not initialized")
    
    try:
        await ai_manager.alert_system.mark_as_replied(request.room_id, request.message_id)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/alerts/force-check")
async def force_check_alerts():
    """アラートの強制チェック"""
    if not ai_manager:
        raise HTTPException(status_code=503, detail="AI Manager not initialized")
    
    try:
        alerts = await ai_manager.alert_system.force_check_alerts()
        return {"checked_alerts": alerts, "count": len(alerts)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/deleted-messages/{room_id}")
async def get_deleted_messages_by_room(room_id: str):
    """特定ルームの削除メッセージログを取得"""
    if not ai_manager:
        raise HTTPException(status_code=503, detail="AI Manager not initialized")
    
    try:
        deleted_messages = await ai_manager.chatwork_api.get_deleted_messages(room_id)
        return {"deleted_messages": deleted_messages.get(room_id, [])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/deleted-messages")
async def get_all_deleted_messages():
    """全ルームの削除メッセージログを取得"""
    if not ai_manager:
        raise HTTPException(status_code=503, detail="AI Manager not initialized")
    
    try:
        deleted_messages = await ai_manager.chatwork_api.get_deleted_messages()
        
        # ルーム名を取得して情報を充実させる
        rooms = await ai_manager.chatwork_api.get_rooms()
        room_names = {str(room["room_id"]): room["name"] for room in rooms}
        
        # レスポンスを構築
        result = []
        for room_id, messages in deleted_messages.items():
            for msg in messages:
                msg_info = msg.copy()
                msg_info["room_name"] = room_names.get(room_id, f"Room {room_id}")
                result.append(msg_info)
        
        # 削除時刻でソート（新しい順）
        result.sort(key=lambda x: x.get("deleted_at", ""), reverse=True)
        
        return {"deleted_messages": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/deleted-messages/{room_id}")
async def clear_deleted_messages_by_room(room_id: str):
    """特定ルームの削除メッセージログをクリア"""
    if not ai_manager:
        raise HTTPException(status_code=503, detail="AI Manager not initialized")
    
    try:
        await ai_manager.chatwork_api.clear_deleted_messages_log(room_id)
        return {"success": True, "message": f"Room {room_id} deleted messages log cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/deleted-messages")
async def clear_all_deleted_messages():
    """全ルームの削除メッセージログをクリア"""
    if not ai_manager:
        raise HTTPException(status_code=503, detail="AI Manager not initialized")
    
    try:
        await ai_manager.chatwork_api.clear_deleted_messages_log()
        return {"success": True, "message": "All deleted messages logs cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/messages/reply")
async def reply_to_message(request: MessageReplyRequest):
    """メッセージに返信"""
    if not ai_manager:
        raise HTTPException(status_code=503, detail="AI Manager not initialized")
    
    try:
        result = await ai_manager.chatwork_api.reply_to_message(
            request.room_id, 
            request.message_id, 
            request.reply_body,
            request.original_sender
        )
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/messages/reaction")
async def add_message_reaction(request: MessageReactionRequest):
    """メッセージにリアクションを追加"""
    if not ai_manager:
        raise HTTPException(status_code=503, detail="AI Manager not initialized")
    
    try:
        result = await ai_manager.chatwork_api.add_reaction(
            request.room_id, 
            request.message_id, 
            request.reaction
        )
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/messages/quote")
async def quote_message(request: MessageQuoteRequest):
    """メッセージを引用"""
    if not ai_manager:
        raise HTTPException(status_code=503, detail="AI Manager not initialized")
    
    try:
        result = await ai_manager.chatwork_api.quote_message(
            request.room_id,
            request.message_id,
            request.original_body,
            request.quote_comment
        )
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# =====================
# WebSocket エンドポイント
# =====================

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket接続"""
    await websocket_manager.connect(websocket)
    try:
        while True:
            # クライアントからのメッセージを待機
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # ping/pong処理
            if message.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
            
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket)

# =====================
# 開発用サーバー起動
# =====================

def run_server(host: str = "127.0.0.1", port: int = 8000, reload: bool = True):
    """開発用サーバー起動"""
    uvicorn.run(
        "web.api_server:app",
        host=host,
        port=port,
        reload=reload,
        log_level="info"
    )

if __name__ == "__main__":
    run_server()