import asyncio
import logging
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

from .chatwork_api import ChatWorkAPI
from .task_analyzer import TaskAnalyzer
from .alert_system import AlertSystem
from .config import Config

# 環境変数を読み込み
load_dotenv()

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ChatWorkAIManager:
    """ChatWork AI Manager メインクラス"""
    
    def __init__(self, config: Optional[Config] = None):
        self.config = config or Config()
        self.chatwork_api = ChatWorkAPI(self.config.chatwork_token)
        self.task_analyzer = TaskAnalyzer(self.config)
        self.alert_system = AlertSystem(self.chatwork_api, self.config)
        self.is_running = False
        self.processed_messages = set()
        self.processed_message_details = []  # 処理済みメッセージの詳細を保存
        
        logger.info("ChatWork AI Manager initialized")
    
    async def start(self):
        """AIマネージャーを開始"""
        self.is_running = True
        logger.info("Starting ChatWork AI Manager...")
        
        # 複数のタスクを並行実行
        tasks = [
            self.monitor_messages(),
            self.alert_system.start_scheduler(),
            self.periodic_cleanup()
        ]
        
        try:
            await asyncio.gather(*tasks)
        except Exception as e:
            logger.error(f"Error in ChatWork AI Manager: {e}")
            await self.stop()
    
    async def stop(self):
        """AIマネージャーを停止"""
        self.is_running = False
        await self.alert_system.stop()
        logger.info("ChatWork AI Manager stopped")
    
    async def monitor_messages(self):
        """リアルタイムメッセージ監視ループ"""
        logger.info("Starting message monitoring...")
        
        while self.is_running:
            try:
                # 監視対象ルームのメッセージを取得
                for room_id in self.config.monitored_rooms:
                    await self._check_room_messages(room_id)
                
                # 監視間隔待機
                await asyncio.sleep(self.config.monitoring_interval)
                
            except Exception as e:
                logger.error(f"Error in message monitoring: {e}")
                await asyncio.sleep(self.config.error_retry_interval)
    
    async def _check_room_messages(self, room_id: str):
        """特定ルームのメッセージをチェック（削除検出機能付き）"""
        try:
            # 最新メッセージを取得（force=1で強制更新、削除検出も実行）
            all_messages = await self.chatwork_api.get_messages(room_id, force=1)
            
            # 新しいメッセージのみを取得
            new_messages = await self.chatwork_api.get_new_messages(room_id)
            
            for message in new_messages:
                message_id = f"{room_id}_{message.message_id}"
                
                # 既に処理済みの場合はスキップ
                if message_id in self.processed_messages:
                    continue
                
                # メッセージを処理
                await self.process_message(message)
                self.processed_messages.add(message_id)
                
                logger.info(f"Processed message {message_id} in room {room_id}")
                
        except Exception as e:
            logger.error(f"Error checking room {room_id}: {e}")
    
    async def process_message(self, message):
        """個別メッセージの処理"""
        try:
            logger.info(f"Processing message from {message.account.name}")
            
            # AI分析でタスク抽出
            analysis = await self.task_analyzer.analyze(message)
            
            logger.info(f"Analysis result: requires_reply={analysis.requires_reply}, "
                       f"tasks={len(analysis.tasks)}, priority={analysis.priority}")
            
            # 処理済みメッセージの詳細を保存
            message_detail = {
                "message_id": message.message_id,
                "room_id": message.room_id,
                "sender": message.account.name,
                "sender_id": message.account.account_id,
                "body": message.body[:200] + ("..." if len(message.body) > 200 else ""),
                "send_time": message.send_time,
                "processed_at": datetime.now().isoformat(),
                "analysis": {
                    "requires_reply": analysis.requires_reply,
                    "priority": analysis.priority,
                    "tasks": [{
                        "description": task.description,
                        "priority": task.priority,
                        "deadline": task.deadline
                    } for task in analysis.tasks],
                    "questions": analysis.questions,
                    "mentions": analysis.mentions,
                    "sentiment": analysis.sentiment,
                    "summary": analysis.summary
                }
            }
            self.processed_message_details.append(message_detail)
            
            # 最新100件のみ保持（メモリ効率のため）
            if len(self.processed_message_details) > 100:
                self.processed_message_details = self.processed_message_details[-100:]
            
            # 返信が必要な場合はアラートシステムに登録
            if analysis.requires_reply:
                await self.alert_system.schedule_alert(message, analysis)
            
            # タスクが抽出された場合は自動作成（現在は無効化）
            # if analysis.tasks:
            #     await self._create_tasks_from_analysis(message, analysis)
            
            # 高優先度の場合は即座に通知（現在は無効化）
            # if analysis.priority == "high":
            #     await self._send_immediate_notification(message, analysis)
                
        except Exception as e:
            logger.error(f"Error processing message: {e}")
    
    async def _create_tasks_from_analysis(self, message, analysis):
        """分析結果からタスクを自動作成"""
        try:
            for task_info in analysis.tasks:
                task_data = {
                    "body": f"[自動抽出] {task_info.description}",
                    "to_ids": task_info.assignees or [message.account.account_id],
                    "limit": task_info.deadline
                }
                
                await self.chatwork_api.create_task(message.room_id, task_data)
                logger.info(f"Created task: {task_info.description}")
                
        except Exception as e:
            logger.error(f"Error creating tasks: {e}")
    
    async def _send_immediate_notification(self, message, analysis):
        """高優先度メッセージの即座通知"""
        try:
            notification_text = (
                f"🚨 高優先度メッセージを検出\n"
                f"差出人: {message.account.name}\n"
                f"内容: {message.body[:100]}...\n"
                f"分析: {analysis.summary}"
            )
            
            await self.chatwork_api.send_message(message.room_id, notification_text)
            logger.info("Sent immediate high-priority notification")
            
        except Exception as e:
            logger.error(f"Error sending immediate notification: {e}")
    
    async def periodic_cleanup(self):
        """定期的なクリーンアップ処理"""
        while self.is_running:
            try:
                # 古い処理済みメッセージIDを削除（メモリ効率化）
                current_time = datetime.now()
                cutoff_time = current_time - timedelta(hours=24)
                
                # 実際の実装では、メッセージIDに時刻情報を含めるか、
                # 別途タイムスタンプを管理する必要があります
                # ここでは簡略化
                
                logger.info("Performed periodic cleanup")
                
                # 1時間ごとにクリーンアップ
                await asyncio.sleep(3600)
                
            except Exception as e:
                logger.error(f"Error in periodic cleanup: {e}")
                await asyncio.sleep(3600)
    
    async def get_status(self) -> Dict:
        """システムステータスを取得"""
        return {
            "is_running": self.is_running,
            "processed_messages_count": len(self.processed_messages),
            "monitored_rooms": len(self.config.monitored_rooms),
            "pending_alerts": await self.alert_system.get_pending_count(),
            "last_check": datetime.now().isoformat()
        }
    
    async def get_processed_messages(self, limit: int = 50) -> List[Dict]:
        """処理済みメッセージの詳細を取得"""
        # 最新のメッセージから返す
        return self.processed_message_details[-limit:][::-1]
    
    async def manual_check_room(self, room_id: str) -> Dict:
        """特定ルームの手動チェック"""
        try:
            await self._check_room_messages(room_id)
            return {"success": True, "room_id": room_id}
        except Exception as e:
            return {"success": False, "room_id": room_id, "error": str(e)}


async def main():
    """メイン実行関数"""
    config = Config()
    manager = ChatWorkAIManager(config)
    
    try:
        await manager.start()
    except KeyboardInterrupt:
        logger.info("Received shutdown signal")
        await manager.stop()


if __name__ == "__main__":
    asyncio.run(main())