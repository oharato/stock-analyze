# バッチ処理仕様書 & データベース構造

`stock-analyze-collector` アプリケーションにおけるデータ取得および統合バッチの仕様と、DuckDB上のテーブル構造について記載します。

## 1. EDINET データ取得・ベクトル化バッチ

EDINETから有価証券報告書を取得し、定性情報を抽出・ベクトル化して保存します。

### コマンド
```bash
pnpm run run:fetch-edinet --ticker=<TICKER> --years=<YEARS>
```

### 引数
- `--ticker`: 取得対象の銘柄コード（例: `7203`）。現在は単一コードのみ公式サポート（将来的に `all` 対応予定）。
- `--years`: 過去何年分を取得するか（例: `5`）。

### 処理フロー
1.  **ドキュメント検索**: 指定された銘柄について、過去（現在から約800日前まで）の「有価証券報告書」を検索します。
2.  **XBRL取得**: 該当するドキュメントのXBRLデータをダウンロードします。
3.  **テキスト抽出**:
    - **事業等のリスク (Business Risks)**
    - **経営者による財政状態、経営成績及びキャッシュ・フローの状況の分析 (MD&A)**
    - ※HTMLタグの除去および正規化を行います。
4.  **ベクトル化**:
    - ライブラリ: `@xenova/transformers`
    - モデル: `Xenova/paraphrase-multilingual-MiniLM-L12-v2`
    - パラメータ: `pooling: 'mean'`, `normalize: true`
    - **GPU高速化**: 環境変数 `USE_GPU=true` を設定することで GPU モードが有効になります（要環境設定）。
5.  **保存**: `data/raw/edinet` ディレクトリに Parquet 形式で保存します（JSON文字列として保存されるフィールドあり）。

### 出力ファイル形式 (Parquet)
ファイル名: `{ticker}-{date}-{docID}.parquet`
(Parquetファイル内スキーマは `apps/stock-analyze-collector/src/utils/schema-definitions.ts` 参照)

---

## 2. 株価データ取得バッチ

Yahoo Financeから株価データを取得し、Parquet形式で保存します。

### コマンド
```bash
pnpm run run:fetch-stock-prices [options]
```

### 引数
- `--code`: 取得対象の銘柄コード。省略時は全銘柄。
- `--year`: 取得対象の年。
- `--force`: 既存データをスキップせず強制取得するか。

### 処理概要
- `data/processed/prices/code={code}/{year}-{month}.parquet` に保存されます。

---

## 3. 財務データ取得バッチ

IR BANKから財務データを取得し、Parquet形式で保存します。

### コマンド
```bash
pnpm run run:fetch-latest-fundamentals
pnpm run run:fetch-past-fundamentals
```

### 処理概要
- 最新および過去の財務データを取得します。
- **キャッシュ**: `data/raw/fundamentals` に API レスポンスを Parquet 形式でキャッシュします（内部JSON）。
- **統合データ**: `data/processed/fundamentals/code={code}/fundamentals.parquet` に統合・保存されます。
- **注意**: カラム名はソース(IR BANK)の定義に依存し、日本語の財務項目名が含まれる場合があります。

---

## 4. データ統合バッチ

収集された各種データ（株価、財務情報、EDINET情報）を DuckDB データベースに統合します。

### コマンド
```bash
pnpm run run:consolidate-data
```

### 処理概要
- **Semantic Data Fabric (SDF)** を使用してデータ統合パイプラインを定義・実行します。
- **定義ファイル**: `sdf/src/sources.sql` (データソース定義) および `sdf/src/models.sql` (データモデル・変換定義)。
- **SDF** が `data/processed` 配下の各種ファイル (Parquet/JSON) を読み込み、統合テーブル (`prices`, `fundamentals`, `edinet`) を構築します。
- 実行エンジンには DuckDB が使用されます。

---

## 5. DuckDB テーブル構造

### `companies` テーブル
銘柄マスターデータを格納します。

| カラム名 | データ型 | 説明 |
| :--- | :--- | :--- |
| `code` | `VARCHAR` | 銘柄コード。 |
| `name` | `VARCHAR` | 銘柄名。 |
| `market` | `VARCHAR` | 市場区分。 |
| `sector33` | `VARCHAR` | 33業種区分。 |
| `sector17` | `VARCHAR` | 17業種区分。 |
| `scale` | `VARCHAR` | 規模区分。 |

### `prices` テーブル
株価データ（日足）を格納します。

| カラム名 | データ型 | 説明 |
| :--- | :--- | :--- |
| `code` | `VARCHAR` | 銘柄コード。 |
| `datef` | `DATE` | 日付。|
| `open` | `DOUBLE` | 始値。 |
| `high` | `DOUBLE` | 高値。 |
| `low` | `DOUBLE` | 安値。 |
| `close` | `DOUBLE` | 終値。 |
| `adjClose` | `DOUBLE` | 調整後終値。 |
| `volume` | `BIGINT` | 出来高。 |

### `fundamentals` テーブル
財務データを格納します。

| カラム名 | データ型 | 説明 |
| :--- | :--- | :--- |
| `code` | `VARCHAR` | 銘柄コード。 |
| `year` | `VARCHAR` | 年度 (例: 2024)。 |
| `*` | `DOUBLE/VARCHAR` | その他、IR BANKから取得した財務項目（日本語カラム名）。 |

### `edinet` テーブル
EDINETから取得した定性情報およびそのベクトルデータを格納します。

| カラム名 | データ型 | 説明 |
| :--- | :--- | :--- |
| `code` | `VARCHAR` | 銘柄コード (Ticker)。JSONの `ticker` フィールドまたはファイル名から抽出。 |
| `year` | `BIGINT` | 対象年度 (年)。 |
| `date` | `DATE` | 提出日。 |
| `docId` | `VARCHAR` | EDINET書類ID。 |
| `business_risks` | `VARCHAR` | 「事業等のリスク」全文。 |
| `business_risks_vector` | `DOUBLE[]` | 「事業等のリスク」の埋め込みベクトル。 |
| `mda` | `VARCHAR` | 「経営者による財政状態... (MD&A)」全文。 |
| `mda_vector` | `DOUBLE[]` | 「MD&A」の埋め込みベクトル。 |
| `corporate_governance` | `VARCHAR` | 「コーポレート・ガバナンスの状況等」全文。 |
| `corporate_governance_vector` | `DOUBLE[]` | 「コーポレート・ガバナンス」の埋め込みベクトル。 |
| `research_and_development` | `VARCHAR` | 「研究開発活動」全文。 |
| `research_and_development_vector` | `DOUBLE[]` | 「研究開発活動」の埋め込みベクトル。 |
| `net_sales` | `BIGINT` | 売上高。 |
| `operating_income` | `BIGINT` | 営業利益。 |
| `ordinary_income` | `BIGINT` | 経常利益。 |
| `net_income` | `BIGINT` | 当期純利益。 |
| `net_assets` | `BIGINT` | 純資産。 |
| `total_assets` | `BIGINT` | 総資産。 |
| `earnings_per_share` | `DOUBLE` | EPS。 |
| `book_value_per_share` | `DOUBLE` | BPS。 |
| `equity_to_total_assets_ratio` | `DOUBLE` | 自己資本比率。 |
| `rate_of_return_on_equity` | `DOUBLE` | ROE。 |
| `filename` | `VARCHAR` | ソースファイルのパス。 |

> **Note**: `DOUBLE[]` は DuckDB における `LIST(DOUBLE)` 型です。SQL で類似性検索（コサイン類似度など）を行う際は `array_cosine_similarity` 関数などが利用可能です。

---

## 環境構築と依存関係

本バッチは以下のネイティブ依存関係を含みます。`pnpm` 設定でビルドが許可されています。
- `better-sqlite3`: DuckDB以外のローカルデータ処理用（一部ツールで使用）。
- `sharp`: `@xenova/transformers` の画像処理依存関係（本プロジェクトではテキストのみですが依存関係として必要）。

### 動作環境
- Node.js v18+ (v20+ 推奨)
- Linux (WSL2等)
