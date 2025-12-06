# Stock Analysis AI - Web Interface

AI を活用した株式分析のための Web インターフェースです。TypeScript、Vite、Alpine.js を使用して構築されています。

## 🚀 特徴

- **モダンな UI/UX**: ダークテーマとグラスモーフィズムを採用した美しいデザイン
- **リアルタイムチャット**: AI アシスタントとの対話型インターフェース
- **レスポンシブデザイン**: モバイルからデスクトップまで対応
- **ローカルストレージ**: チャット履歴の自動保存
- **TypeScript**: 型安全な開発環境
- **Alpine.js**: 軽量でリアクティブな UI フレームワーク

## 📋 必要要件

- Node.js 18 以上
- pnpm (推奨) または npm

## 🛠️ セットアップ

### 依存関係のインストール

```bash
pnpm install
```

### 開発サーバーの起動

```bash
pnpm run dev
```

開発サーバーは `http://localhost:5173` で起動します。

### ビルド

```bash
pnpm run build
```

ビルドされたファイルは `dist` ディレクトリに出力されます。

### プレビュー

```bash
pnpm run preview
```

## 🔧 設定

### API エンドポイントの設定

`src/config.ts` ファイルで API エンドポイントを設定できます：

```typescript
export const config = {
  development: {
    apiEndpoint: 'http://localhost:8787/api/chat',
    useMockAPI: true, // モック API を使用
  },
  production: {
    apiEndpoint: '/api/chat',
    useMockAPI: false, // 実際の API を使用
  },
};
```

### モック API の切り替え

開発中は `useMockAPI: true` に設定することで、バックエンドなしでフロントエンドの開発が可能です。

## 📁 プロジェクト構造

```
stock-analyze-web/
├── src/
│   ├── main.ts          # メインアプリケーションロジック
│   ├── api.ts           # API クライアント
│   ├── config.ts        # 設定ファイル
│   ├── style.css        # スタイルシート
│   └── alpine.d.ts      # Alpine.js の型定義
├── public/              # 静的ファイル
├── index.html           # HTML エントリーポイント
├── package.json         # パッケージ設定
├── tsconfig.json        # TypeScript 設定
└── vite.config.ts       # Vite 設定（オプション）
```

## 🎨 デザインシステム

### カラーパレット

- **Primary**: `hsl(250, 100%, 65%)` - メインカラー
- **Secondary**: `hsl(280, 100%, 70%)` - アクセントカラー
- **Accent**: `hsl(180, 100%, 60%)` - ハイライト

### 主要コンポーネント

- **Glass Card**: グラスモーフィズム効果を持つカードコンポーネント
- **Message Bubbles**: ユーザーと AI のメッセージ表示
- **Input Area**: メッセージ入力エリア
- **Suggestion Cards**: クイックアクセス用のサジェスション

## 🔌 API 統合

### stock-analyze-ai Worker との接続

本番環境では、Cloudflare Workers の `stock-analyze-ai` と連携します：

1. `src/config.ts` で `useMockAPI: false` に設定
2. `apiEndpoint` を適切なエンドポイントに設定
3. CORS 設定が適切に行われていることを確認

### API リクエスト形式

```typescript
POST /api/chat
Content-Type: application/json

{
  "question": "株式に関する質問"
}
```

### API レスポンス形式

```typescript
{
  "answer": "AI からの回答",
  "timestamp": "2025-12-06T09:00:00Z"
}
```

## 🧪 開発

### モック API

開発中は `src/api.ts` のモック API が使用されます。リアルな株式分析のレスポンスをシミュレートします。

### ローカルストレージ

チャット履歴は自動的にブラウザのローカルストレージに保存されます。履歴をクリアするには：

```javascript
// ブラウザのコンソールで実行
localStorage.removeItem('chatHistory');
```

## 🚀 デプロイ

### Cloudflare Pages へのデプロイ

1. ビルドコマンド: `pnpm run build`
2. 出力ディレクトリ: `dist`
3. Node.js バージョン: 18 以上

### 環境変数

必要に応じて環境変数を設定：

- `VITE_API_ENDPOINT`: API エンドポイント URL

## 📝 使用技術

- **TypeScript**: 型安全な JavaScript
- **Vite**: 高速なビルドツール
- **Alpine.js**: 軽量リアクティブフレームワーク
- **CSS Variables**: カスタマイズ可能なデザインシステム

## 🤝 貢献

プルリクエストを歓迎します。大きな変更の場合は、まず Issue を開いて変更内容を議論してください。

## 📄 ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。

## 🔗 関連プロジェクト

- `stock-analyze-ai`: AI Worker バックエンド
- `stock-analyze-mcp`: MCP サーバー
