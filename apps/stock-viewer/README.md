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

## ページ一覧

| URL | 説明 |
|-----|------|
| `/` | テーブル一覧・汎用クエリビューアー |
| `/companies.html` | 企業一覧（セクター・市場フィルター付き） |
| `/company.html?code=xxxx` | 企業詳細（日足/週足/月足チャート、財務情報、EDINET） |
| `/candlestick.html` | **日足ローソク足チャート（セクター別）** |
| `/edinet.html` | EDINET ベクトル検索 |
| `/fundamentals.html` | 財務データ一覧 |
| `/large_shareholdings.html` | 大量保有報告一覧 |

## 日足チャートページ（セクター別）

`/candlestick.html` では、セクター33分類のドロップダウンから業種を選択すると、そのセクターに属する全銘柄の日足ローソク足チャート（直近700日）と移動平均線（MA5/MA25/MA75）を一覧表示します。

- URLパラメータ `?sector33=xxx` でブックマーク・リロード対応
- `IntersectionObserver` によるスクロール連動の遅延チャート初期化（多銘柄でも軽快）
- プライム→スタンダード→グロース→その他の順でソート

### 利用するAPIエンドポイント

| エンドポイント | 説明 |
|--------------|------|
| `GET /api/sectors` | sector33 一覧を返す |
| `GET /api/sector-charts?sector33=xxx&days=700` | セクター内全銘柄の企業情報と価格データを一括返却 |

## ディレクトリ構造

- `src/`: サーバーサイドソースコード (Hono, DuckDB 管理)
- `client/`: クライアントサイドソースコード (Alpine.js, Vite)
- `dist/`: ビルド済み出力
- `data/`: (ローカル開発時) DuckDB データベースファイル
