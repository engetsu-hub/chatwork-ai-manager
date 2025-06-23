# コントリビューションガイド

ChatWork AI Managerへのコントリビューションをありがとうございます！

## 開発環境のセットアップ

1. このリポジトリをフォーク
2. ローカルにクローン
3. 仮想環境を作成: `python -m venv venv`
4. 依存関係をインストール: `pip install -r requirements.txt`
5. 環境変数を設定: `cp .env.example .env`

## 開発フロー

1. 新しいブランチを作成: `git checkout -b feature/your-feature-name`
2. 変更を実装
3. テストを実行: `pytest tests/`
4. コードフォーマットを適用: `black .`
5. コミット: `git commit -m "Add: your feature description"`
6. プッシュ: `git push origin feature/your-feature-name`
7. プルリクエストを作成

## コーディング規約

### Python
- PEP 8に従う
- `black`でフォーマット
- 型ヒントを使用
- docstringを記述

### JavaScript
- ES6+を使用
- camelCase命名規則
- セミコロンを使用
- 2スペースインデント

## テスト

- 新機能には必ずテストを追加
- テストカバレッジは80%以上を維持
- `pytest tests/`で全テストが通ることを確認

## コミットメッセージ

以下の形式でコミットメッセージを記述してください：

```
<type>: <description>

[optional body]
```

### Types
- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメント
- `style`: コードフォーマット
- `refactor`: リファクタリング
- `test`: テスト追加/修正
- `chore`: その他

## プルリクエスト

- 明確なタイトルと説明を記載
- 関連するIssueをリンク
- レビューアーを指定
- CI/CDが通ることを確認

## 質問・サポート

- [Discussions](https://github.com/USERNAME/chatwork-ai-manager/discussions)で質問
- [Issues](https://github.com/USERNAME/chatwork-ai-manager/issues)でバグ報告