# ChatWork AI Manager

ChatWork APIと連携したAI駆動のメッセージ監視・タスク管理システム

![ChatWork AI Manager](docs/screenshot.png)

## 🚀 機能

### 🎯 コア機能
- **リアルタイムメッセージ監視**: 指定したルームの新しいメッセージを自動監視
- **AI分析エンジン**: メッセージからタスク抽出、質問検出、優先度判定
- **スマートアラート**: 未返信メッセージをダッシュボードで可視化
- **タスク管理**: 抽出されたタスクをアプリ内で管理（ChatWorkへの自動投稿なし）
- **非同期処理**: 高パフォーマンスな並行処理

### 🖥️ インターフェース
- **Web Dashboard**: モダンなWebベースのダッシュボード
- **デスクトップアプリ**: Electron製のネイティブアプリケーション
- **REST API**: 外部連携用のAPIエンドポイント
- **WebSocket**: リアルタイム更新

### 🤖 AI分析機能
- **タスク検出**: 依頼・作業・確認系の文言を自動識別
- **優先度判定**: 緊急・通常・低優先度の自動分類
- **期限抽出**: 「明日まで」「来週」等の期限表現を解析
- **感情分析**: ポジティブ・ネガティブ・ニュートラルの判定
- **返信必要性**: メンション・質問・タスクの有無で自動判定

## 📦 インストール

### 必要環境
- Python 3.8+
- Node.js 18+ (デスクトップアプリ用)
- ChatWork APIトークン

### 1. リポジトリのクローン
```bash
git clone https://github.com/USERNAME/chatwork-ai-manager.git
cd chatwork-ai-manager
```

### 2. Python依存関係のインストール
```bash
pip install -r requirements.txt
```

### 3. 環境変数の設定
```bash
cp .env.example .env
```

`.env`ファイルを編集し、あなたのChatWork APIトークンとルームIDを設定：
```env
CHATWORK_API_TOKEN=your_actual_chatwork_api_token
MONITORED_ROOMS=your_room_id1,your_room_id2
```

**注意**: 実際のAPIトークンやルームIDは絶対にGitにコミットしないでください。

### 4. 起動方法

#### Web版（推奨）
```bash
# FastAPIサーバー起動
python -m uvicorn web.api_server:app --host 127.0.0.1 --port 8000

# ブラウザで http://127.0.0.1:8000 にアクセス
```

#### デスクトップアプリ版
```bash
cd desktop
npm install
npm start
```

## 🎮 使用方法

### 基本的な使い方

1. **ChatWork APIトークンの取得**
   - ChatWorkにログイン → 右上アイコン → API設定
   - 新しいAPIトークンを作成

2. **監視対象ルームの設定**
   - ルームIDを`.env`の`MONITORED_ROOMS`に設定
   - 複数ルームはカンマ区切りで指定

3. **アプリケーションの起動**
   - Web版またはデスクトップアプリを起動
   - ダッシュボードでリアルタイム監視状況を確認

### ダッシュボード機能

#### 📊 サマリーカード
- 監視中ルーム数
- 処理済みメッセージ数
- 未処理アラート数
- 高優先度アラート数

#### 🔔 アラート管理
- 未返信メッセージの一覧表示
- 優先度別のフィルタリング
- 返信済みマーク機能
- 強制チェック実行

#### 💬 メッセージ閲覧
- ルーム別メッセージ表示
- リアルタイム更新
- 送信者・時刻情報

#### 🧠 分析ツール
- 任意テキストの分析テスト
- タスク・質問・メンション抽出
- 優先度・感情・信頼度表示

## ⚙️ 設定

### 基本設定

| 項目 | 環境変数 | デフォルト | 説明 |
|------|----------|------------|------|
| APIトークン | `CHATWORK_API_TOKEN` | - | ChatWork APIトークン（必須） |
| 監視ルーム | `MONITORED_ROOMS` | - | 監視対象ルームID（カンマ区切り） |
| 監視間隔 | `MONITORING_INTERVAL_SECONDS` | 30 | メッセージチェック間隔（秒） |

### アラート設定

| 項目 | 環境変数 | デフォルト | 説明 |
|------|----------|------------|------|
| 高優先度閾値 | `HIGH_PRIORITY_THRESHOLD_MINUTES` | 30 | 高優先度アラート閾値（分） |
| 通常優先度閾値 | `NORMAL_PRIORITY_THRESHOLD_HOURS` | 2 | 通常優先度アラート閾値（時間） |
| 低優先度閾値 | `LOW_PRIORITY_THRESHOLD_HOURS` | 24 | 低優先度アラート閾値（時間） |

### AI分析設定

| 項目 | 環境変数 | デフォルト | 説明 |
|------|----------|------------|------|
| AIプロバイダー | `AI_PROVIDER` | builtin | AI分析エンジン（builtin/openai/anthropic） |
| OpenAI APIキー | `OPENAI_API_KEY` | - | OpenAI GPT使用時（オプション） |
| Anthropic APIキー | `ANTHROPIC_API_KEY` | - | Claude使用時（オプション） |

## 🔧 開発

### プロジェクト構造
```
chatwork-ai-manager/
├── src/                     # Pythonコア
│   ├── main.py             # メインアプリケーション
│   ├── chatwork_api.py     # ChatWork API クライアント
│   ├── task_analyzer.py    # AI分析エンジン
│   ├── alert_system.py     # アラートシステム
│   └── config.py           # 設定管理
├── web/                    # Web UI
│   └── api_server.py       # FastAPIサーバー
├── static/                 # フロントエンド
│   ├── index.html          # メインHTML
│   ├── css/dashboard.css   # スタイル
│   └── js/dashboard.js     # JavaScript
├── desktop/                # Electronアプリ
│   ├── main.js             # メインプロセス
│   ├── preload.js          # プリロードスクリプト
│   └── package.json        # 依存関係
└── tests/                  # テスト
```

### 開発サーバーの起動
```bash
# バックエンド（自動リロード）
python -m uvicorn web.api_server:app --reload

# デスクトップアプリ（開発モード）
cd desktop && npm run dev
```

### テストの実行
```bash
# Pythonテスト
pytest tests/

# JavaScript/Electronテスト
cd desktop && npm test
```

### ビルド
```bash
# デスクトップアプリのビルド
cd desktop
npm run build          # 全プラットフォーム
npm run build-win      # Windows
npm run build-mac      # macOS
npm run build-linux    # Linux
```

## 📚 API リファレンス

### REST API エンドポイント

#### システム状態
```http
GET /api/status
```
レスポンス：
```json
{
  "system": {
    "is_running": true,
    "processed_messages_count": 150,
    "monitored_rooms": 3
  },
  "alerts": {
    "total": 5,
    "by_priority": {"high": 1, "normal": 3, "low": 1}
  }
}
```

#### メッセージ分析
```http
POST /api/analyze
Content-Type: application/json

{
  "body": "明日までに資料を作成してください",
  "account_name": "田中太郎"
}
```

#### アラート管理
```http
GET /api/alerts                    # アラート一覧
POST /api/alerts/force-check       # 強制チェック
POST /api/alerts/mark-replied      # 返信済みマーク
```

### WebSocket API

#### 接続
```javascript
const ws = new WebSocket('ws://localhost:8000/ws');
```

#### イベント受信
```javascript
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'new_message':
      // 新しいメッセージ通知
      break;
    case 'status_update':
      // ステータス更新
      break;
  }
};
```

## 🤝 コントリビューション

1. このリポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチをプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は[LICENSE](LICENSE)ファイルを参照してください。

## 🆘 サポート

- **ドキュメント**: [Wiki](https://github.com/USERNAME/chatwork-ai-manager/wiki)
- **バグ報告**: [Issues](https://github.com/USERNAME/chatwork-ai-manager/issues)
- **ディスカッション**: [Discussions](https://github.com/USERNAME/chatwork-ai-manager/discussions)

## 🎯 ロードマップ

- [ ] 機械学習によるより高度な分析
- [ ] Slack/Teams等の他チャットツール対応
- [ ] モバイルアプリ版
- [ ] チーム向けダッシュボード
- [ ] カスタマイズ可能な分析ルール

---

**Made with ❤️ for better team communication**