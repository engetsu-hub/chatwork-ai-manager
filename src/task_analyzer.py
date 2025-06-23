import re
import asyncio
import logging
from typing import List, Dict, Optional, Any
from dataclasses import dataclass
from datetime import datetime, timedelta
import json

from .chatwork_api import ChatWorkMessage

logger = logging.getLogger(__name__)


@dataclass
class TaskInfo:
    """抽出されたタスク情報"""
    description: str
    assignees: List[int]
    deadline: Optional[int] = None
    priority: str = "normal"
    estimated_time: Optional[str] = None


@dataclass
class MessageAnalysis:
    """メッセージ分析結果"""
    requires_reply: bool
    priority: str  # "high", "normal", "low"
    tasks: List[TaskInfo]
    questions: List[str]
    mentions: List[int]
    deadline: Optional[int] = None
    sentiment: str = "neutral"  # "positive", "negative", "neutral"
    summary: str = ""
    confidence_score: float = 0.0


class TaskAnalyzer:
    """タスク分析エンジン"""
    
    def __init__(self, config):
        self.config = config
        
        # タスク関連のパターン
        self.task_patterns = [
            r'(?:お願い|依頼|タスク|TODO|やること|作業|実装|修正|対応)(?:し|を|が)',
            r'(?:〜してください|〜して下さい|〜してもらえ|〜お願いします)',
            r'(?:確認|チェック|レビュー|テスト|検証)(?:を|して|お願い)',
            r'(?:作成|制作|開発|実装|設計)(?:を|して|してください)',
            r'(?:調査|調べ|検討|考え)(?:て|を|してください)'
        ]
        
        # 質問パターン
        self.question_patterns = [
            r'[？?]$',
            r'(?:どう|どの|どこ|いつ|なぜ|どうして|どのように)',
            r'(?:ですか|でしょうか|ましょうか|ませんか)$',
            r'(?:教えて|知りたい|分かる|わかる|聞きたい)'
        ]
        
        # 緊急度キーワード
        self.urgency_keywords = {
            "high": ["緊急", "至急", "ASAP", "今すぐ", "即", "急ぎ", "重要", "クリティカル"],
            "medium": ["なるべく早く", "できれば", "可能であれば", "お早めに"],
            "low": ["時間があるとき", "お手すきで", "ゆっくり", "いつでも"]
        }
        
        # 返信不要パターン
        self.no_reply_patterns = [
            r'(?:共有|報告|連絡|お知らせ|FYI|参考|完了|終了)',
            r'(?:ありがとう|感謝|了解|承知|OK|おっけー)',
            r'(?:お疲れさま|お疲れ様|お先に)'
        ]
        
        # 感情分析キーワード
        self.sentiment_keywords = {
            "positive": ["ありがとう", "素晴らしい", "良い", "いいね", "完璧", "最高", "助かり"],
            "negative": ["問題", "困った", "遅れ", "失敗", "ダメ", "最悪", "緊急", "トラブル"]
        }
    
    async def analyze(self, message: ChatWorkMessage) -> MessageAnalysis:
        """メッセージを総合分析"""
        try:
            logger.info(f"Analyzing message from {message.account.name}")
            
            # 各種分析を並行実行
            tasks = await asyncio.gather(
                self._extract_tasks(message.body),
                self._detect_questions(message.body),
                self._extract_mentions(message.body),
                self._determine_priority(message.body),
                self._extract_deadline(message.body),
                self._analyze_sentiment(message.body)
            )
            
            extracted_tasks, questions, mentions, priority, deadline, sentiment = tasks
            
            # 返信必要性を判定
            requires_reply = self._should_respond(message.body, {
                "mentions": mentions,
                "questions": questions,
                "tasks": extracted_tasks,
                "priority": priority
            })
            
            # サマリーを生成
            summary = self._generate_summary(message.body, extracted_tasks, questions, priority)
            
            # 信頼度スコアを計算
            confidence_score = self._calculate_confidence_score(
                message.body, extracted_tasks, questions, mentions
            )
            
            analysis = MessageAnalysis(
                requires_reply=requires_reply,
                priority=priority,
                tasks=extracted_tasks,
                questions=questions,
                mentions=mentions,
                deadline=deadline,
                sentiment=sentiment,
                summary=summary,
                confidence_score=confidence_score
            )
            
            logger.info(f"Analysis completed: {len(extracted_tasks)} tasks, "
                       f"requires_reply={requires_reply}, priority={priority}")
            
            return analysis
            
        except Exception as e:
            logger.error(f"Error analyzing message: {e}")
            # エラー時はデフォルトの分析結果を返す
            return MessageAnalysis(
                requires_reply=False,
                priority="normal",
                tasks=[],
                questions=[],
                mentions=[],
                summary="分析エラー"
            )
    
    async def _extract_tasks(self, text: str) -> List[TaskInfo]:
        """タスクを抽出"""
        tasks = []
        lines = text.split('\n')
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # タスクパターンにマッチするかチェック
            is_task = any(re.search(pattern, line, re.IGNORECASE) for pattern in self.task_patterns)
            
            if is_task:
                task = await self._parse_task_line(line)
                if task:
                    tasks.append(task)
        
        # 箇条書きのタスクも検出
        bullet_tasks = await self._extract_bullet_tasks(text)
        tasks.extend(bullet_tasks)
        
        return tasks
    
    async def _parse_task_line(self, line: str) -> Optional[TaskInfo]:
        """タスク行を解析"""
        try:
            # 基本的なタスク情報を抽出
            description = line.strip()
            
            # メンションから担当者を抽出
            mentions = self._extract_mentions_from_text(line)
            
            # 期限を抽出
            deadline = await self._extract_deadline_from_text(line)
            
            # 優先度を判定
            priority = await self._determine_priority_from_text(line)
            
            # 見積もり時間を抽出
            estimated_time = self._extract_estimated_time(line)
            
            return TaskInfo(
                description=description,
                assignees=mentions,
                deadline=deadline,
                priority=priority,
                estimated_time=estimated_time
            )
            
        except Exception as e:
            logger.error(f"Error parsing task line: {e}")
            return None
    
    async def _extract_bullet_tasks(self, text: str) -> List[TaskInfo]:
        """箇条書きタスクを抽出"""
        bullet_pattern = r'^[\s]*[・•●○▪▫□☐\-\*]\s*(.+)'
        tasks = []
        
        for match in re.finditer(bullet_pattern, text, re.MULTILINE):
            task_text = match.group(1).strip()
            
            # タスクらしい内容かチェック
            if len(task_text) > 5 and not any(re.search(pattern, task_text) for pattern in self.no_reply_patterns):
                task = await self._parse_task_line(task_text)
                if task:
                    tasks.append(task)
        
        return tasks
    
    async def _detect_questions(self, text: str) -> List[str]:
        """質問を検出"""
        questions = []
        sentences = re.split(r'[。\n]', text)
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            
            if any(re.search(pattern, sentence) for pattern in self.question_patterns):
                questions.append(sentence)
        
        return questions
    
    async def _extract_mentions(self, text: str) -> List[int]:
        """メンションを抽出"""
        return self._extract_mentions_from_text(text)
    
    def _extract_mentions_from_text(self, text: str) -> List[int]:
        """テキストからメンションを抽出"""
        mention_pattern = r'\[To:(\d+)\]'
        mentions = []
        
        for match in re.finditer(mention_pattern, text):
            account_id = int(match.group(1))
            mentions.append(account_id)
        
        return list(set(mentions))  # 重複除去
    
    async def _determine_priority(self, text: str) -> str:
        """優先度を判定"""
        return await self._determine_priority_from_text(text)
    
    async def _determine_priority_from_text(self, text: str) -> str:
        """テキストから優先度を判定"""
        text_lower = text.lower()
        
        for priority, keywords in self.urgency_keywords.items():
            if any(keyword in text_lower for keyword in keywords):
                return priority
        
        # 複数の疑問符や感嘆符も緊急度の指標
        if len(re.findall(r'[!！]', text)) >= 2:
            return "high"
        
        return "normal"
    
    async def _extract_deadline(self, text: str) -> Optional[int]:
        """期限を抽出"""
        return await self._extract_deadline_from_text(text)
    
    async def _extract_deadline_from_text(self, text: str) -> Optional[int]:
        """テキストから期限を抽出"""
        deadline_patterns = [
            (r'(\d{4})[年\/\-](\d{1,2})[月\/\-](\d{1,2})日?', 'full'),
            (r'(\d{1,2})[月\/](\d{1,2})日?', 'monthday'),
            (r'(\d{1,2})日', 'day'),
            (r'今日', 'today'),
            (r'明日', 'tomorrow'),
            (r'今週', 'thisweek'),
            (r'来週', 'nextweek')
        ]
        
        for pattern, date_type in deadline_patterns:
            match = re.search(pattern, text)
            if match:
                return self._parse_deadline_match(match, date_type)
        
        return None
    
    def _parse_deadline_match(self, match, date_type: str) -> Optional[int]:
        """期限マッチを日付に変換"""
        try:
            now = datetime.now()
            
            if date_type == 'today':
                deadline = now.replace(hour=23, minute=59, second=59)
            elif date_type == 'tomorrow':
                deadline = now + timedelta(days=1)
                deadline = deadline.replace(hour=23, minute=59, second=59)
            elif date_type == 'thisweek':
                days_until_sunday = 6 - now.weekday()
                deadline = now + timedelta(days=days_until_sunday)
                deadline = deadline.replace(hour=23, minute=59, second=59)
            elif date_type == 'nextweek':
                days_until_next_sunday = 13 - now.weekday()
                deadline = now + timedelta(days=days_until_next_sunday)
                deadline = deadline.replace(hour=23, minute=59, second=59)
            elif date_type == 'monthday':
                month = int(match.group(1))
                day = int(match.group(2))
                deadline = datetime(now.year, month, day, 23, 59, 59)
                if deadline < now:
                    deadline = deadline.replace(year=deadline.year + 1)
            elif date_type == 'full':
                year = int(match.group(1))
                month = int(match.group(2))
                day = int(match.group(3))
                deadline = datetime(year, month, day, 23, 59, 59)
            else:
                return None
            
            return int(deadline.timestamp())
            
        except (ValueError, OverflowError) as e:
            logger.error(f"Error parsing deadline: {e}")
            return None
    
    async def _analyze_sentiment(self, text: str) -> str:
        """感情分析"""
        text_lower = text.lower()
        
        positive_count = sum(1 for word in self.sentiment_keywords["positive"] if word in text_lower)
        negative_count = sum(1 for word in self.sentiment_keywords["negative"] if word in text_lower)
        
        if positive_count > negative_count:
            return "positive"
        elif negative_count > positive_count:
            return "negative"
        else:
            return "neutral"
    
    def _should_respond(self, text: str, analysis_data: Dict) -> bool:
        """返信必要性を判定"""
        # 返信不要パターンにマッチする場合
        if any(re.search(pattern, text, re.IGNORECASE) for pattern in self.no_reply_patterns):
            return False
        
        # 以下の条件のいずれかに該当する場合は返信必要
        return (
            len(analysis_data["mentions"]) > 0 or      # メンションされている
            len(analysis_data["questions"]) > 0 or     # 質問が含まれている
            len(analysis_data["tasks"]) > 0 or         # タスクが含まれている
            analysis_data["priority"] == "high"        # 高優先度
        )
    
    def _generate_summary(self, text: str, tasks: List[TaskInfo], questions: List[str], priority: str) -> str:
        """分析サマリーを生成"""
        elements = []
        
        if tasks:
            elements.append(f"タスク{len(tasks)}件")
        if questions:
            elements.append(f"質問{len(questions)}件")
        if priority == "high":
            elements.append("高優先度")
        
        if elements:
            return f"検出: {', '.join(elements)}"
        else:
            return "通常メッセージ"
    
    def _calculate_confidence_score(self, text: str, tasks: List[TaskInfo], 
                                  questions: List[str], mentions: List[int]) -> float:
        """信頼度スコアを計算"""
        score = 0.0
        
        # テキストの長さによる基本スコア
        base_score = min(len(text) / 100, 1.0) * 0.3
        score += base_score
        
        # タスク検出による加点
        if tasks:
            score += min(len(tasks) * 0.2, 0.4)
        
        # 質問検出による加点
        if questions:
            score += min(len(questions) * 0.15, 0.3)
        
        # メンション検出による加点
        if mentions:
            score += 0.2
        
        return min(score, 1.0)
    
    def _extract_estimated_time(self, text: str) -> Optional[str]:
        """見積もり時間を抽出"""
        time_patterns = [
            r'(\d+)\s*時間',
            r'(\d+)\s*分',
            r'(\d+)\s*日',
            r'(\d+)\s*週間'
        ]
        
        for pattern in time_patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(0)
        
        return None