import aiohttp
import asyncio
import logging
from typing import List, Dict, Optional, Any
from dataclasses import dataclass
from datetime import datetime
import json
import re

logger = logging.getLogger(__name__)


@dataclass
class ChatWorkAccount:
    """ChatWorkアカウント情報"""
    account_id: int
    name: str
    avatar_image_url: Optional[str] = None


@dataclass
class ChatWorkMessage:
    """ChatWorkメッセージ"""
    message_id: str
    room_id: str
    account: ChatWorkAccount
    body: str
    send_time: int
    update_time: int


@dataclass
class ChatWorkTask:
    """ChatWorkタスク"""
    task_id: str
    room_id: str
    account: ChatWorkAccount
    assigned_by_account: ChatWorkAccount
    message_id: str
    body: str
    limit_time: Optional[int]
    status: str


class ChatWorkAPI:
    """ChatWork API クライアント"""
    
    def __init__(self, api_token: str):
        self.api_token = api_token
        self.base_url = "https://api.chatwork.com/v2"
        self.session = None
        self.last_message_ids = {}  # ルーム別の最後のメッセージID
        self.deleted_messages = {}  # 削除されたメッセージの履歴
        self.cached_messages = {}  # ルーム別のメッセージキャッシュ
        
    async def __aenter__(self):
        await self._ensure_session()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()
    
    async def _ensure_session(self):
        """HTTPセッションを確保"""
        if self.session is None:
            headers = {
                "X-ChatWorkToken": self.api_token,
                "Content-Type": "application/x-www-form-urlencoded"
            }
            timeout = aiohttp.ClientTimeout(total=30)
            self.session = aiohttp.ClientSession(headers=headers, timeout=timeout)
    
    async def close(self):
        """セッションを閉じる"""
        if self.session:
            await self.session.close()
            self.session = None
    
    async def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """APIリクエストを実行"""
        await self._ensure_session()
        
        url = f"{self.base_url}{endpoint}"
        
        try:
            async with self.session.request(method, url, **kwargs) as response:
                if response.status == 200:
                    return await response.json()
                elif response.status == 401:
                    raise Exception("Unauthorized: Invalid API token")
                elif response.status == 429:
                    # レート制限の場合は待機
                    await asyncio.sleep(60)
                    raise Exception("Rate limit exceeded")
                else:
                    error_text = await response.text()
                    raise Exception(f"API Error {response.status}: {error_text}")
                    
        except aiohttp.ClientError as e:
            logger.error(f"HTTP Client Error: {e}")
            raise Exception(f"Network error: {e}")
    
    async def get_me(self) -> Dict[str, Any]:
        """自分の情報を取得"""
        return await self._request("GET", "/me")
    
    async def get_rooms(self) -> List[Dict[str, Any]]:
        """ルーム一覧を取得（カテゴリ情報付き）"""
        try:
            rooms = await self._request("GET", "/rooms")
            
            # 基本的なルーム情報のみを返す（高速化）
            enhanced_rooms = []
            for room in rooms:
                try:
                    room_with_category = room.copy()
                    # 基本的なタイプ情報のみでカテゴリを決定
                    room_with_category['category'] = self._determine_basic_category(room)
                    enhanced_rooms.append(room_with_category)
                    
                except Exception as e:
                    logger.warning(f"Failed to categorize room {room['room_id']}: {e}")
                    room_with_category = room.copy()
                    room_with_category['category'] = 'others'
                    enhanced_rooms.append(room_with_category)
            
            return enhanced_rooms
            
        except Exception as e:
            logger.error(f"Error getting rooms: {e}")
            return []
    
    async def get_room_info(self, room_id: str) -> Dict[str, Any]:
        """ルーム情報を取得"""
        return await self._request("GET", f"/rooms/{room_id}")
    
    async def get_messages(self, room_id: str, force: int = 0) -> List[ChatWorkMessage]:
        """メッセージ一覧を取得（削除検出機能付き）"""
        try:
            params = {"force": force}
            data = await self._request("GET", f"/rooms/{room_id}/messages", params=params)
            
            # 現在のメッセージIDセットを作成
            current_message_ids = set()
            messages = []
            deleted_tag_messages = []  # [delete]タグ付きメッセージ
            
            for msg_data in data:
                message_id = msg_data["message_id"]
                body = msg_data["body"]
                
                # [delete]タグを含むメッセージを検出
                if "[delete]" in body or "[deleted]" in body:
                    # [delete]タグ付きメッセージとして記録
                    account = ChatWorkAccount(
                        account_id=msg_data["account"]["account_id"],
                        name=msg_data["account"]["name"],
                        avatar_image_url=msg_data["account"].get("avatar_image_url")
                    )
                    
                    deleted_tag_message = ChatWorkMessage(
                        message_id=message_id,
                        room_id=room_id,
                        account=account,
                        body=body,
                        send_time=msg_data["send_time"],
                        update_time=msg_data["update_time"]
                    )
                    deleted_tag_messages.append(deleted_tag_message)
                    # 通常のメッセージリストからは除外
                    continue
                
                current_message_ids.add(message_id)
                
                account = ChatWorkAccount(
                    account_id=msg_data["account"]["account_id"],
                    name=msg_data["account"]["name"],
                    avatar_image_url=msg_data["account"].get("avatar_image_url")
                )
                
                message = ChatWorkMessage(
                    message_id=message_id,
                    room_id=room_id,
                    account=account,
                    body=body,
                    send_time=msg_data["send_time"],
                    update_time=msg_data["update_time"]
                )
                messages.append(message)
            
            # [delete]タグ付きメッセージを削除ログに追加
            if deleted_tag_messages:
                await self._add_deleted_tag_messages_to_log(room_id, deleted_tag_messages)
            
            # 削除されたメッセージを検出
            await self._detect_deleted_messages(room_id, current_message_ids)
            
            # メッセージキャッシュを更新
            self.cached_messages[room_id] = {msg.message_id: msg for msg in messages}
            
            return messages
            
        except Exception as e:
            logger.error(f"Error getting messages for room {room_id}: {e}")
            return []
    
    async def get_new_messages(self, room_id: str) -> List[ChatWorkMessage]:
        """新しいメッセージのみを取得"""
        try:
            all_messages = await self.get_messages(room_id, force=1)
            
            # 前回チェック以降の新しいメッセージのみを抽出
            last_message_id = self.last_message_ids.get(room_id)
            new_messages = []
            
            for message in all_messages:
                if last_message_id is None or message.message_id > last_message_id:
                    new_messages.append(message)
            
            # 最新のメッセージIDを更新
            if all_messages:
                self.last_message_ids[room_id] = max(msg.message_id for msg in all_messages)
            
            return new_messages
            
        except Exception as e:
            logger.error(f"Error getting new messages for room {room_id}: {e}")
            return []
    
    async def send_message(self, room_id: str, message: str, self_unread: bool = False) -> Dict[str, Any]:
        """メッセージを送信"""
        try:
            data = {
                "body": message,
                "self_unread": "1" if self_unread else "0"
            }
            
            return await self._request("POST", f"/rooms/{room_id}/messages", data=data)
            
        except Exception as e:
            logger.error(f"Error sending message to room {room_id}: {e}")
            raise
    
    async def reply_to_message(self, room_id: str, message_id: str, reply_body: str, original_sender: str = None) -> Dict[str, Any]:
        """メッセージに返信（シンプルな引用形式）"""
        try:
            # シンプルな引用形式で返信
            if original_sender:
                reply_format = f"[To:{original_sender}] {reply_body}"
            else:
                reply_format = f"> 返信: {reply_body}"
            
            return await self.send_message(room_id, reply_format)
            
        except Exception as e:
            logger.error(f"Error replying to message {message_id} in room {room_id}: {e}")
            raise
    
    async def add_reaction(self, room_id: str, message_id: str, reaction: str) -> Dict[str, Any]:
        """メッセージにリアクション（絵文字メッセージ）を送信"""
        try:
            # ChatWork API v2にはリアクション機能がないため、絵文字メッセージで代用
            reaction_emojis = {
                "thumbsup": "👍",
                "thumbsdown": "👎", 
                "clap": "👏",
                "love": "❤️",
                "smile": "😄",
                "surprised": "😲"
            }
            
            emoji = reaction_emojis.get(reaction, reaction)
            reaction_message = f"{emoji}"
            
            return await self.send_message(room_id, reaction_message)
            
        except Exception as e:
            logger.error(f"Error adding reaction to message {message_id}: {e}")
            raise
    
    async def get_tasks(self, room_id: str, status: str = "open") -> List[ChatWorkTask]:
        """タスク一覧を取得"""
        try:
            params = {"status": status}
            data = await self._request("GET", f"/rooms/{room_id}/tasks", params=params)
            
            tasks = []
            for task_data in data:
                account = ChatWorkAccount(
                    account_id=task_data["account"]["account_id"],
                    name=task_data["account"]["name"],
                    avatar_image_url=task_data["account"].get("avatar_image_url")
                )
                
                assigned_by_account = ChatWorkAccount(
                    account_id=task_data["assigned_by_account"]["account_id"],
                    name=task_data["assigned_by_account"]["name"],
                    avatar_image_url=task_data["assigned_by_account"].get("avatar_image_url")
                )
                
                task = ChatWorkTask(
                    task_id=task_data["task_id"],
                    room_id=room_id,
                    account=account,
                    assigned_by_account=assigned_by_account,
                    message_id=task_data["message_id"],
                    body=task_data["body"],
                    limit_time=task_data.get("limit_time"),
                    status=task_data["status"]
                )
                tasks.append(task)
            
            return tasks
            
        except Exception as e:
            logger.error(f"Error getting tasks for room {room_id}: {e}")
            return []
    
    async def create_task(self, room_id: str, task_data: Dict[str, Any]) -> Dict[str, Any]:
        """タスクを作成"""
        try:
            data = {
                "body": task_data["body"],
                "to_ids": ",".join(map(str, task_data["to_ids"]))
            }
            
            if task_data.get("limit"):
                data["limit"] = task_data["limit"]
            
            return await self._request("POST", f"/rooms/{room_id}/tasks", data=data)
            
        except Exception as e:
            logger.error(f"Error creating task in room {room_id}: {e}")
            raise
    
    async def update_task_status(self, room_id: str, task_id: str, status: str) -> Dict[str, Any]:
        """タスクステータスを更新"""
        try:
            data = {"status": status}
            return await self._request("PUT", f"/rooms/{room_id}/tasks/{task_id}/status", data=data)
            
        except Exception as e:
            logger.error(f"Error updating task {task_id} status in room {room_id}: {e}")
            raise
    
    async def get_room_members(self, room_id: str) -> List[Dict[str, Any]]:
        """ルームメンバー一覧を取得"""
        try:
            return await self._request("GET", f"/rooms/{room_id}/members")
        except Exception as e:
            logger.error(f"Error getting members for room {room_id}: {e}")
            return []
    
    async def quote_message(self, room_id: str, message_id: str, original_body: str, quote_comment: str = None) -> Dict[str, Any]:
        """メッセージを引用"""
        try:
            # ChatWorkの引用フォーマットを使用
            quoted_body = re.sub(r'\[.*?\]', '', original_body).strip()  # マークアップを除去
            if len(quoted_body) > 100:
                quoted_body = quoted_body[:100] + "..."
            
            quote_format = f"[qt]{quoted_body}[/qt]"
            if quote_comment:
                quote_format += f"\n{quote_comment}"
            
            return await self.send_message(room_id, quote_format)
            
        except Exception as e:
            logger.error(f"Error quoting message {message_id} in room {room_id}: {e}")
            raise
    
    async def _detect_deleted_messages(self, room_id: str, current_message_ids: set):
        """削除されたメッセージを検出してログに記録"""
        if room_id not in self.cached_messages:
            # 初回取得の場合は削除検出しない
            return
            
        cached_message_ids = set(self.cached_messages[room_id].keys())
        deleted_message_ids = cached_message_ids - current_message_ids
        
        if deleted_message_ids:
            # 削除されたメッセージをログに記録
            if room_id not in self.deleted_messages:
                self.deleted_messages[room_id] = []
            
            current_time = datetime.now().isoformat()
            
            for message_id in deleted_message_ids:
                deleted_message = self.cached_messages[room_id].get(message_id)
                if deleted_message:
                    deleted_info = {
                        "message_id": message_id,
                        "room_id": room_id,
                        "sender": deleted_message.account.name,
                        "body": deleted_message.body,
                        "send_time": deleted_message.send_time,
                        "deleted_at": current_time
                    }
                    self.deleted_messages[room_id].append(deleted_info)
                    logger.info(f"Detected deleted message {message_id} in room {room_id}")
            
            # 古い削除ログを制限（最新100件まで保持）
            self.deleted_messages[room_id] = self.deleted_messages[room_id][-100:]
    
    async def get_deleted_messages(self, room_id: str = None) -> Dict[str, List[Dict]]:
        """削除されたメッセージのログを取得"""
        if room_id:
            return {room_id: self.deleted_messages.get(room_id, [])}
        else:
            return self.deleted_messages.copy()
    
    async def clear_deleted_messages_log(self, room_id: str = None):
        """削除メッセージログをクリア"""
        if room_id:
            if room_id in self.deleted_messages:
                del self.deleted_messages[room_id]
        else:
            self.deleted_messages.clear()
    
    async def _add_deleted_tag_messages_to_log(self, room_id: str, deleted_tag_messages: List[ChatWorkMessage]):
        """[delete]タグ付きメッセージを削除ログに追加"""
        if room_id not in self.deleted_messages:
            self.deleted_messages[room_id] = []
        
        current_time = datetime.now().isoformat()
        
        for message in deleted_tag_messages:
            # メッセージ本文から[delete]タグを除去
            clean_body = message.body.replace("[delete]", "").replace("[deleted]", "").strip()
            
            deleted_info = {
                "message_id": message.message_id,
                "room_id": room_id,
                "sender": message.account.name,
                "body": clean_body,
                "send_time": message.send_time,
                "deleted_at": current_time,
                "deletion_type": "tag"  # タグによる削除であることを示す
            }
            
            # 重複チェック（同じメッセージIDが既にログにある場合はスキップ）
            if not any(log["message_id"] == message.message_id for log in self.deleted_messages[room_id]):
                self.deleted_messages[room_id].append(deleted_info)
                logger.info(f"Added [delete] tagged message {message.message_id} to deletion log")
        
        # 古い削除ログを制限（最新100件まで保持）
        self.deleted_messages[room_id] = self.deleted_messages[room_id][-100:]
    
    def _determine_basic_category(self, room: Dict[str, Any]) -> str:
        """基本的なルーム情報からカテゴリを推定（高速版）"""
        room_type = room.get('type', 'group')
        room_name = room.get('name', '')
        
        # ダイレクトメッセージ
        if room_type == 'direct':
            return 'TO'  # ChatWorkのTO（個人チャット）に対応
        
        # マイチャット
        if room_type == 'my':
            return 'my_chat'
        
        # グループチャットの場合、名前で簡易判定
        name_lower = room_name.lower()
        
        # クライアント関連キーワード
        if any(keyword in name_lower for keyword in ['クライアント', 'client', '顧客', 'お客様', '案件']):
            return 'クライアント窓口'
        
        # プロジェクト関連
        if any(keyword in name_lower for keyword in ['プロジェクト', 'project', 'pj']):
            return 'projects'
        
        # チーム・部署関連
        if any(keyword in name_lower for keyword in ['チーム', 'team', '部', '課', 'department']):
            return 'teams'
        
        # テスト・開発関連
        if any(keyword in name_lower for keyword in ['テスト', 'test', '開発', 'dev', 'development', 'ai manager']):
            return 'development'
        
        # その他
        return 'others'
    
    def _determine_room_category(self, room: Dict[str, Any]) -> str:
        """ルームタイプや名前からカテゴリを推定（詳細版）"""
        room_type = room.get('type', 'group')
        room_name = room.get('name', '')
        
        # ダイレクトメッセージ
        if room_type == 'direct':
            return 'TO'
        
        # マイチャット
        if room_type == 'my':
            return 'my_chat'
        
        # グループチャットの場合、名前で判定
        name_lower = room_name.lower()
        
        # クライアント関連キーワード
        if any(keyword in name_lower for keyword in ['クライアント', 'client', '顧客', 'お客様', '案件']):
            return 'クライアント窓口'
        
        # プロジェクト関連
        if any(keyword in name_lower for keyword in ['プロジェクト', 'project', 'pj']):
            return 'projects'
        
        # チーム・部署関連
        if any(keyword in name_lower for keyword in ['チーム', 'team', '部', '課', 'department']):
            return 'teams'
        
        # 会議・ミーティング関連
        if any(keyword in name_lower for keyword in ['会議', 'meeting', 'ミーティング', '打ち合わせ']):
            return 'meetings'
        
        # テスト・開発関連
        if any(keyword in name_lower for keyword in ['テスト', 'test', '開発', 'dev', 'development', 'ai manager']):
            return 'development'
        
        # 通知・アナウンス関連
        if any(keyword in name_lower for keyword in ['通知', 'notice', 'アナウンス', 'announce', '連絡']):
            return 'announcements'
        
        # その他
        return 'others'
    
    async def get_room_categories(self) -> Dict[str, List[Dict[str, Any]]]:
        """ルームをカテゴリ別に分類して返す"""
        try:
            rooms = await self.get_rooms()
            
            categories = {
                'monitored': [],
                'TO': [],  # 個人チャット
                'クライアント窓口': [],  # クライアントとのグループチャット
                'projects': [],
                'teams': [],
                'meetings': [],
                'development': [],
                'announcements': [],
                'my_chat': [],
                'others': []
            }
            
            # 監視対象ルームIDを設定から取得
            monitored_room_ids = ['402903381']  # 設定から読み込みを検討
            
            for room in rooms:
                room_id_str = str(room['room_id'])
                
                # 監視対象ルームかどうかを最初にチェック
                if room_id_str in monitored_room_ids:
                    categories['monitored'].append(room)
                else:
                    # カテゴリ別に分類
                    category = room.get('category', 'others')
                    if category in categories:
                        categories[category].append(room)
                    else:
                        categories['others'].append(room)
            
            logger.info(f"Found categories: {list(categories.keys())}")
            return categories
            
        except Exception as e:
            logger.error(f"Error categorizing rooms: {e}")
            return {}
    
    async def debug_room_structure(self, room_id: str) -> Dict[str, Any]:
        """ルームの詳細構造をデバッグ出力用に取得"""
        try:
            room_detail = await self.get_room_info(room_id)
            logger.info(f"Room {room_id} structure: {json.dumps(room_detail, indent=2, ensure_ascii=False)}")
            return room_detail
        except Exception as e:
            logger.error(f"Error getting room structure for {room_id}: {e}")
            return {}
    
    async def test_connection(self) -> bool:
        """接続テスト"""
        try:
            await self.get_me()
            return True
        except Exception as e:
            logger.error(f"Connection test failed: {e}")
            return False