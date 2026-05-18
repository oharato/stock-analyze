# stock-analyze-motherduck

株価データを MotherDuck にアップロードし、ローソク足チャートを Dive で可視化するアプリです。

---

## 構成

```
apps/motherduck/
├── src/
│   ├── upload-price.ts      # 株価 Parquet ファイルを MotherDuck にアップロードするスクリプト
│   └── StockPriceChart.tsx  # 月次平均株価の折れ線チャート（参考実装）
└── .env                     # 環境変数（gitignore 対象）
```

---

## セットアップ

### 環境変数

`.env` ファイルを作成して以下を設定します。

```env
MOTHERDUCK_TOKEN=<MotherDuck のトークン>
MOTHERDUCK_DATABASE=stock_analyze   # 省略可（デフォルト: stock_analyze）
MOTHERDUCK_SCHEMA=main              # 省略可（デフォルト: main）
MOTHERDUCK_TABLE=prices             # 省略可（デフォルト: prices）
MOTHERDUCK_TRUNCATE_BEFORE_LOAD=true  # 省略可（デフォルト: true）
```

トークンは https://app.motherduck.com/ の Settings > Tokens で取得できます。

### 依存パッケージのインストール

```bash
pnpm install
```

---

## データアップロード

```bash
pnpm --filter stock-analyze-motherduck run upload:price
```

`data/processed/prices/` 以下の `.parquet` ファイルをすべて読み込み、MotherDuck の `stock_analyze.main.prices` テーブルにアップロードします。

### テーブルスキーマ

```
date        BIGINT   - UNIXミリ秒タイムスタンプ
dateString  VARCHAR  - 日付文字列 (例: "2024-01-15")
code        VARCHAR  - 銘柄コード (例: "2031")
open        DOUBLE   - 始値
high        DOUBLE   - 高値
low         DOUBLE   - 安値
close       DOUBLE   - 終値
adjClose    DOUBLE   - 調整後終値
volume      BIGINT   - 出来高
```

---

## MotherDuck Dive：日足ローソク足チャート

### Dive URL

https://app.motherduck.com/dives/65d5bc51-4ab4-4437-9399-c4f2a72a2ea9

### 概要

- `stock_analyze.main.prices` を参照
- 全銘柄コードのローソク足チャートを縦に並べて表示
- 直近 **700 日分**の日足データを表示
- **5日・25日・75日移動平均線**を重ねて描画

### 移動平均の算出 SQL

```sql
WITH daily AS (
  SELECT
    code, dateString, open, high, low, close,
    AVG(close) OVER (PARTITION BY code ORDER BY dateString ROWS BETWEEN 4  PRECEDING AND CURRENT ROW) AS ma5,
    AVG(close) OVER (PARTITION BY code ORDER BY dateString ROWS BETWEEN 24 PRECEDING AND CURRENT ROW) AS ma25,
    AVG(close) OVER (PARTITION BY code ORDER BY dateString ROWS BETWEEN 74 PRECEDING AND CURRENT ROW) AS ma75,
    ROW_NUMBER() OVER (PARTITION BY code ORDER BY dateString DESC) AS rn
  FROM "stock_analyze"."main"."prices"
)
SELECT code, dateString, open, high, low, close, ma5, ma25, ma75
FROM daily
WHERE rn <= 700
ORDER BY code, dateString
```

### ローソク足の描画ロジック

Recharts には組み込みのローソク足コンポーネントがないため、`Bar` コンポーネントのカスタム `shape` で実装しています。

カスタムシェイプは `background` プロップ（チャートエリアの `y` 座標と `height`）と Y 軸のドメイン (`[domainMin, domainMax]`) を使って、データ値をピクセル座標に変換します。

```ts
const toY = (val: unknown) =>
  background.y + background.height * (1 - (N(val) - domainMin) / range);
```

- **髭（wick）**：`high` から `low` への垂直線
- **ボディ**：`open` と `close` の間の矩形
- **色**：陽線（close ≥ open）= 緑 `#2d7a00`、陰線 = 赤 `#bc1200`

### Dive の再作成手順

1. 上記 SQL と描画ロジックをもとに `save_dive` で新規作成する
2. または `apps/motherduck/src/` 以下の TSX を参考に MotherDuck の Dive エディタで実装する

---

## GitHub Actions との連携

`.github/workflows/fetch-and-upload-prices.yml` により、毎日 UTC 8:00 に株価データを自動取得・アップロードします。  
Dive は `useSQLQuery` でライブデータを参照するため、アップロード完了後に自動で最新データが反映されます。
