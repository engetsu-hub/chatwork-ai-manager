import asyncio
import logging
from typing import Dict, List, Optional, Set
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import json

from .chatwork_api import ChatWorkAPI, ChatWorkMessage
from .task_analyzer import MessageAnalysis

logger = logging.getLogger(__name__)


@dataclass
class PendingAlert:
    """未処理アラート情報"""
    message: ChatWorkMessage
    analysis: MessageAnalysis
    added_at: datetime
    alerts_sent: int = 0
    last_alert_at: Optional[datetime] = None
    escalation_level: int = 0


@dataclass
class AlertConfig:
    """アラート設定"""
    high_priority_threshold_minutes: int = 30
    normal_priority_threshold_hours: int = 2
    low_priority_threshold_hours: int = 24
    escalation_intervals: List[int] = field(default_factory=lambda: [60, 180, 360])  # 分
    max_escalation_level: int = 3


class AlertSystem:
    """アラートシステム"""
    
    def __init__(self, chatwork_api: ChatWorkAPI, config):
        self.chatwork_api = chatwork_api
        self.config = config
        self.alert_config = AlertConfig()
        self.pending_alerts: Dict[str, PendingAlert] = {}
        self.is_running = False
        self.scheduler_task = None
        
        # 設定から閾値を読み込み
        if hasattr(config, 'high_priority_threshold_minutes'):
            self.alert_config.high_priority_threshold_minutes = config.high_priority_threshold_minutes
        if hasattr(config, 'normal_priority_threshold_hours'):
            self.alert_config.normal_priority_threshold_hours = config.normal_priority_threshold_hours
        if hasattr(config, 'low_priority_threshold_hours'):
            self.alert_config.low_priority_threshold_hours = config.low_priority_threshold_hours
    
    async def schedule_alert(self, message: ChatWorkMessage, analysis: MessageAnalysis):
        """アラートをスケジュール"""
        try:
            alert_id = f"{message.room_id}_{message.message_id}"
            
            pending_alert = PendingAlert(
                message=message,
                analysis=analysis,
                added_at=datetime.now()
            )
            
            self.pending_alerts[alert_id] = pending_alert
            
            logger.info(f"Scheduled alert for message {alert_id} with priority {analysis.priority}")
            
        except Exception as e:
            logger.error(f"Error scheduling alert: {e}")
    
    async def mark_as_replied(self, room_id: str, message_id: str):
        """返信済みとしてマーク"""
        alert_id = f"{room_id}_{message_id}"
        
        if alert_id in self.pending_alerts:
            del self.pending_alerts[alert_id]
            logger.info(f"Marked alert {alert_id} as replied")
    
    async def start_scheduler(self):
        """アラートスケジューラーを開始"""
        self.is_running = True
        logger.info("Starting alert scheduler...")
        
        while self.is_running:
            try:
                await self._check_pending_alerts()
                await asyncio.sleep(60)  # 1分ごとにチェック
                
            except Exception as e:
                logger.error(f"Error in alert scheduler: {e}")
                await asyncio.sleep(60)
    
    async def stop(self):
        """アラートシステムを停止"""
        self.is_running = False
        if self.scheduler_task:
            self.scheduler_task.cancel()
        logger.info("Alert system stopped")
    
    async def _check_pending_alerts(self):
        """未処理アラートをチェック"""
        current_time = datetime.now()
        alerts_to_send = []
        
        for alert_id, alert in self.pending_alerts.items():
            if self._should_send_alert(alert, current_time):
                alerts_to_send.append((alert_id, alert))
        
        # アラートを送信
        for alert_id, alert in alerts_to_send:
            await self._send_alert(alert_id, alert)
    
    def _should_send_alert(self, alert: PendingAlert, current_time: datetime) -> bool:
        """アラートを送信すべきか判定"""
        time_since_added = current_time - alert.added_at
        
        # 初回アラートの閾値チェック
        if alert.alerts_sent == 0:
            threshold = self._get_threshold_for_priority(alert.analysis.priority)
            return time_since_added >= threshold
        
        # エスカレーションチェック
        if alert.last_alert_at and alert.escalation_level < self.alert_config.max_escalation_level:
            escalation_interval = timedelta(
                minutes=self.alert_config.escalation_intervals[
                    min(alert.escalation_level, len(self.alert_config.escalation_intervals) - 1)
                ]
            )
            return (current_time - alert.last_alert_at) >= escalation_interval
        
        return False
    
    def _get_threshold_for_priority(self, priority: str) -> timedelta:
        """優先度に応じた閾値を取得"""
        if priority == "high":
            return timedelta(minutes=self.alert_config.high_priority_threshold_minutes)
        elif priority == "normal":
            return timedelta(hours=self.alert_config.normal_priority_threshold_hours)
        else:  # low
            return timedelta(hours=self.alert_config.low_priority_threshold_hours)
    
    async def _send_alert(self, alert_id: str, alert: PendingAlert):
        """アラートを送信"""
        try:
            message_text = await self._generate_alert_message(alert)
            
            # アラートメッセージを送信（ChatWorkへの投稿は無効化）
            # await self.chatwork_api.send_message(alert.message.room_id, message_text)
            logger.info(f"Alert generated (not sent): {message_text[:100]}...")
            
            # アラート記録を更新
            alert.alerts_sent += 1
            alert.last_alert_at = datetime.now()
            alert.escalation_level += 1
            
            logger.info(f"Sent alert {alert_id} (attempt {alert.alerts_sent})")
            
        except Exception as e:
            logger.error(f"Error sending alert {alert_id}: {e}")
    
    async def _generate_alert_message(self, alert: PendingAlert) -> str:
        """アラートメッセージを生成"""
        message = alert.message
        analysis = alert.analysis
        
        # 優先度に応じた絵文字
        priority_emoji = {
            "high": "🚨",
            "normal": "⚠️",
            "low": "ℹ️"
        }
        
        emoji = priority_emoji.get(analysis.priority, "⚠️")
        
        # 経過時間を計算
        time_elapsed = datetime.now() - alert.added_at
        time_str = self._format_time_elapsed(time_elapsed)
        
        # エスカレーションレベルに応じたメッセージ
        escalation_text = ""
        if alert.escalation_level > 0:
            escalation_text = f" (エスカレーション {alert.escalation_level}回目)"
        
        # メッセージ本文（長い場合は切り詰め）
        original_message = message.body[:100]
        if len(message.body) > 100:
            original_message += "..."
        
        alert_message = f"""[info][title]{emoji} 未返信メッセージのお知らせ{escalation_text}[/title]
差出人: {message.account.name}
経過時間: {time_str}
優先度: {analysis.priority}

元メッセージ:
{original_message}

分析結果:
{analysis.summary}"""
        
        # タスクが含まれている場合は追加情報
        if analysis.tasks:
            alert_message += f"\n\n抽出されたタスク: {len(analysis.tasks)}件"
            for i, task in enumerate(analysis.tasks[:3], 1):  # 最大3件まで表示
                alert_message += f"\n{i}. {task.description[:50]}..."
        
        # 質問が含まれている場合は追加情報
        if analysis.questions:
            alert_message += f"\n\n質問: {len(analysis.questions)}件"
        
        # メンションを追加
        if analysis.mentions:
            mention_text = " ".join(f"[To:{account_id}]" for account_id in analysis.mentions)
            alert_message = mention_text + "\n\n" + alert_message
        
        alert_message += "[/info]"
        
        return alert_message
    
    def _format_time_elapsed(self, time_elapsed: timedelta) -> str:
        """経過時間をフォーマット"""
        total_minutes = int(time_elapsed.total_seconds() / 60)
        hours = total_minutes // 60
        minutes = total_minutes % 60
        days = hours // 24
        hours = hours % 24
        
        if days > 0:
            return f"{days}日{hours}時間{minutes}分"
        elif hours > 0:
            return f"{hours}時間{minutes}分"
        else:
            return f"{minutes}分"
    
    async def get_pending_count(self) -> int:
        """未処理アラート数を取得"""
        return len(self.pending_alerts)
    
    async def get_pending_alerts_summary(self) -> Dict:
        """未処理アラートのサマリーを取得"""
        summary = {
            "total": len(self.pending_alerts),
            "by_priority": {"high": 0, "normal": 0, "low": 0},
            "by_room": {},
            "oldest_alert": None
        }
        
        oldest_time = None
        oldest_alert = None
        
        for alert in self.pending_alerts.values():
            # 優先度別カウント
            priority = alert.analysis.priority
            summary["by_priority"][priority] += 1
            
            # ルーム別カウント
            room_id = alert.message.room_id
            if room_id not in summary["by_room"]:
                summary["by_room"][room_id] = 0
            summary["by_room"][room_id] += 1
            
            # 最古のアラート
            if oldest_time is None or alert.added_at < oldest_time:
                oldest_time = alert.added_at
                oldest_alert = alert
        
        if oldest_alert:
            summary["oldest_alert"] = {
                "room_id": oldest_alert.message.room_id,
                "message_id": oldest_alert.message.message_id,
                "sender": oldest_alert.message.account.name,
                "added_at": oldest_alert.added_at.isoformat(),
                "time_elapsed": self._format_time_elapsed(datetime.now() - oldest_alert.added_at)
            }
        
        return summary
    
    async def force_check_alerts(self) -> List[str]:
        """強制的にアラートチェックを実行"""
        try:
            await self._check_pending_alerts()
            return [alert_id for alert_id in self.pending_alerts.keys()]
        except Exception as e:
            logger.error(f"Error in force check alerts: {e}")
            return []
    
    async def clear_old_alerts(self, hours: int = 48):
        """古いアラートをクリア"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        old_alerts = []
        
        for alert_id, alert in list(self.pending_alerts.items()):
            if alert.added_at < cutoff_time:
                old_alerts.append(alert_id)
                del self.pending_alerts[alert_id]
        
        if old_alerts:
            logger.info(f"Cleared {len(old_alerts)} old alerts")
        
        return old_alerts