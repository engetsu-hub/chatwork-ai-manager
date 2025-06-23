import os
from typing import List, Optional
from dataclasses import dataclass
from pathlib import Path

# .envファイルを読み込み
env_path = Path(__file__).parent.parent / '.env'
if env_path.exists():
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                key, value = line.split('=', 1)
                os.environ[key] = value


@dataclass
class Config:
    """設定クラス"""
    
    # ChatWork API設定
    chatwork_token: str = os.getenv("CHATWORK_API_TOKEN", "")
    
    # 監視設定
    monitored_rooms: List[str] = None
    monitoring_interval: int = int(os.getenv("MONITORING_INTERVAL_SECONDS", "30"))
    error_retry_interval: int = int(os.getenv("ERROR_RETRY_INTERVAL_SECONDS", "60"))
    
    # アラート設定
    high_priority_threshold_minutes: int = int(os.getenv("HIGH_PRIORITY_THRESHOLD_MINUTES", "30"))
    normal_priority_threshold_hours: int = int(os.getenv("NORMAL_PRIORITY_THRESHOLD_HOURS", "2"))
    low_priority_threshold_hours: int = int(os.getenv("LOW_PRIORITY_THRESHOLD_HOURS", "24"))
    
    # AI分析設定
    openai_api_key: Optional[str] = os.getenv("OPENAI_API_KEY")
    anthropic_api_key: Optional[str] = os.getenv("ANTHROPIC_API_KEY")
    ai_provider: str = os.getenv("AI_PROVIDER", "builtin")  # "openai", "anthropic", "builtin"
    
    # ログ設定
    log_level: str = os.getenv("LOG_LEVEL", "INFO")
    log_file: Optional[str] = os.getenv("LOG_FILE")
    
    def __post_init__(self):
        # 監視対象ルームの設定
        if self.monitored_rooms is None:
            rooms_str = os.getenv("MONITORED_ROOMS", "")
            if rooms_str:
                self.monitored_rooms = [room.strip() for room in rooms_str.split(",")]
            else:
                self.monitored_rooms = []
        
        # 設定検証
        if not self.chatwork_token:
            raise ValueError("CHATWORK_API_TOKEN is required")
        
        if not self.monitored_rooms:
            raise ValueError("MONITORED_ROOMS is required")
    
    @classmethod
    def from_file(cls, config_file: str) -> "Config":
        """設定ファイルから読み込み"""
        import json
        
        with open(config_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return cls(**data)