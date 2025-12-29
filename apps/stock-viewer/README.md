# stock-viewer

DuckDB に格納された株式分析データを表示・検索するための Web アプリケーションです。
Hono (Node.js) をバックエンド、Vite + Alpine.js をフロントエンドに使用しています。

## 特徴

- **DuckDB 連携**: ローカルの DuckDB ファイル、または Cloudflare R2 上の DuckDB ファイルを直接参照します。
- **ベクトル検索**: EDINET の事業リスク等のテキストデータを対象としたセマティック検索が可能です（Transformers.js 使用）。
- **高速な表示**: DuckDB のカラムナフォーマットを活かした高速なクエリ実行。
- **軽量フロントエンド**: Alpine.js を使用した、シンプルでリアクティブな UI。

## セットアップ

### 必要条件

- Node.js (v18+)
- pnpm

### インストール

```bash
pnpm install
```

### 環境設定

`.env` ファイルを作成し、以下の変数を設定してください（R2 を使用する場合）。

```env
CLOUDFLARE_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=your_bucket_name
```

## 開発

### サーバーとクライアントの同時起動

```bash
pnpm dev
```

- サーバー: http://localhost:3000
- クライアント (Vite HMR): http://localhost:5173

### ビルド

```bash
pnpm build
```

## テスト

```bash
pnpm test
```

## ディレクトリ構造

- `src/`: サーバーサイドソースコード (Hono, DuckDB 管理)
- `client/`: クライアントサイドソースコード (Alpine.js, Vite)
- `dist/`: ビルド済み出力
- `data/`: (ローカル開発時) DuckDB データベースファイル
