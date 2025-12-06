# Stock Analysis AI - 機能追加ガイド

## 🎉 新機能

### 1. **データビジュアライゼーション**

#### 📊 テーブル表示
AI の回答に含まれる株価データを美しいテーブル形式で表示します。

**特徴:**
- スティッキーヘッダー（スクロール時も見出しが固定）
- ホバーエフェクト
- レスポンシブデザイン
- ダークテーマに最適化

#### 📈 グラフ表示
Chart.js を使用して、データを視覚的に表示します。

**サポートされるグラフタイプ:**
- 📉 **折れ線グラフ** (`line`): 時系列データの推移
- 📊 **棒グラフ** (`bar`): カテゴリ別の比較
- 🥧 **円グラフ** (`pie`): 構成比の表示

**特徴:**
- インタラクティブなツールチップ
- ダークテーマに最適化された配色
- スムーズなアニメーション
- レスポンシブ対応

---

### 2. **SQL 表示機能**

AI が実行した SQL クエリを表示します。

**機能:**
- SQL の構文ハイライト（シアン色）
- 読みやすいフォーマット
- 「編集」ボタンで SQL モードにコピー

**使い方:**
1. AI が回答を返すと、実行された SQL が表示されます
2. 「📝 編集」ボタンをクリック
3. SQL モードに切り替わり、SQL がエディタにコピーされます
4. SQL を編集して再実行できます

---

### 3. **SQL エディタモード**

カスタム SQL クエリを直接入力・実行できます。

**機能:**
- SQL クエリの直接実行
- 結果をテーブルとグラフで表示
- クエリ履歴の保存
- エラーハンドリング

**使い方:**

#### モードの切り替え:
```
💬 チャットモード ⟷ 🔍 SQL モード
```

#### SQL モードでの操作:
1. 画面上部の「🔍 SQL モード」をクリック
2. SQL クエリを入力
3. 「実行」ボタンをクリック
4. 結果がテーブルとグラフで表示されます

#### サンプル SQL:
```sql
-- 最新の株価データを取得
SELECT * FROM stock_prices 
ORDER BY date DESC 
LIMIT 10;

-- 銘柄別の平均株価
SELECT symbol, AVG(close_price) as avg_price 
FROM stock_prices 
GROUP BY symbol;

-- セクター別のパフォーマンス
SELECT sector, 
       AVG(price_change_pct) as avg_change,
       COUNT(*) as stock_count
FROM stock_prices
GROUP BY sector
ORDER BY avg_change DESC;
```

---

## 🎨 UI/UX の改善

### モードトグル
- 2つのモード間をシームレスに切り替え
- アクティブなモードを視覚的に表示
- スムーズなトランジション

### メッセージ表示
- SQL、テーブル、グラフを統合表示
- 折りたたみ可能なセクション
- スクロール最適化

### コードブロック
- SQL とコードの構文ハイライト
- モノスペースフォント
- コピーボタン

---

## 📊 データ構造

### ChatResponse インターフェース

```typescript
interface ChatResponse {
  answer: string;           // AI の回答テキスト
  timestamp?: string;       // タイムスタンプ
  error?: string;          // エラーメッセージ
  sql?: string;            // 実行された SQL
  tableData?: TableData;   // テーブルデータ
  chartData?: ChartData;   // グラフデータ
}
```

### TableData インターフェース

```typescript
interface TableData {
  columns: string[];       // カラム名の配列
  rows: any[][];          // 行データの2次元配列
}
```

### ChartData インターフェース

```typescript
interface ChartData {
  type: 'line' | 'bar' | 'pie';  // グラフタイプ
  labels: string[];               // X軸のラベル
  datasets: {
    label: string;                // データセット名
    data: number[];               // データ値
    backgroundColor?: string | string[];  // 背景色
    borderColor?: string;         // 線の色
  }[];
}
```

---

## 🔧 技術詳細

### 使用ライブラリ

```json
{
  "dependencies": {
    "alpinejs": "^3.15.2",
    "chart.js": "^4.5.1"
  }
}
```

### ファイル構成

```
src/
├── main.ts          # メインアプリケーション（拡張済み）
├── api.ts           # API クライアント（拡張済み）
├── chart.ts         # Chart.js ラッパー（新規）
├── config.ts        # 設定ファイル
└── style.css        # スタイルシート（拡張済み）
```

### Chart.js の設定

```typescript
// chart.ts で Chart.js を設定
import {
  Chart,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

// ダークテーマに最適化された設定
Chart.register(/* ... */);
```

---

## 💡 使用例

### 例1: チャットモードで株価を質問

**ユーザー:**
```
トヨタ自動車の最近の株価動向を教えてください
```

**AI の回答:**
- 📝 テキストによる分析
- 🔍 実行された SQL の表示
- 📊 株価データのテーブル
- 📈 株価推移のグラフ

---

### 例2: SQL モードでデータを分析

**SQL クエリ:**
```sql
SELECT date, close_price, volume 
FROM stock_prices 
WHERE symbol = 'AAPL' 
ORDER BY date DESC 
LIMIT 30
```

**結果:**
- ✅ 実行成功メッセージ
- 📊 30件のデータをテーブル表示
- 📈 株価推移のグラフ

---

### 例3: SQL を編集して再実行

1. AI の回答に表示された SQL の「📝 編集」をクリック
2. SQL モードに切り替わり、SQL がエディタにコピーされる
3. SQL を編集（例: `LIMIT 30` → `LIMIT 50`）
4. 「実行」ボタンをクリック
5. 更新された結果が表示される

---

## 🎯 モック API のデータ

開発中は、以下のモックデータが使用されます：

### テーブルデータ例:
```typescript
{
  columns: ['日付', '終値', '出来高', '変動率'],
  rows: [
    ['2025-12-05', '¥15,230', '1,234,567', '+2.5%'],
    ['2025-12-04', '¥14,860', '1,456,789', '+1.2%'],
    // ...
  ]
}
```

### グラフデータ例:
```typescript
{
  type: 'line',
  labels: ['12/01', '12/02', '12/03', '12/04', '12/05'],
  datasets: [{
    label: '株価（円）',
    data: [14730, 14800, 14680, 14860, 15230],
    borderColor: 'hsl(250, 100%, 65%)',
  }]
}
```

---

## 🚀 本番環境での使用

### API レスポンス形式

バックエンド（`stock-analyze-ai`）は、以下の形式でレスポンスを返す必要があります：

```json
{
  "answer": "AI の回答テキスト",
  "sql": "SELECT * FROM stock_prices WHERE ...",
  "tableData": {
    "columns": ["date", "close_price", "volume"],
    "rows": [
      ["2025-12-05", 15230, 1234567],
      ["2025-12-04", 14860, 1456789]
    ]
  },
  "chartData": {
    "type": "line",
    "labels": ["12/04", "12/05"],
    "datasets": [{
      "label": "株価",
      "data": [14860, 15230]
    }]
  }
}
```

### SQL クエリのリクエスト形式

```json
{
  "sql": "SELECT * FROM stock_prices LIMIT 10"
}
```

---

## 📝 今後の拡張案

### 1. エクスポート機能
- CSV エクスポート
- Excel エクスポート
- PDF レポート生成

### 2. 高度なグラフ
- ローソク足チャート
- 複数系列の比較
- ズーム・パン機能

### 3. SQL エディタの強化
- シンタックスハイライト
- オートコンプリート
- クエリ履歴

### 4. データフィルタリング
- テーブルのソート
- 列のフィルタリング
- ページネーション

---

## 🐛 トラブルシューティング

### グラフが表示されない

**原因:** Canvas 要素が見つからない

**解決策:**
- メッセージが完全にレンダリングされるまで待つ
- `setTimeout` で遅延を追加（現在は100ms）

### テーブルが崩れる

**原因:** データが多すぎる

**解決策:**
- レスポンシブデザインが適用されているか確認
- モバイルでは横スクロールが有効

### SQL エラー

**原因:** 無効な SQL クエリ

**解決策:**
- SELECT クエリのみサポート（モック API）
- 本番環境では適切なバリデーションを実装

---

## 📚 参考リンク

- [Chart.js ドキュメント](https://www.chartjs.org/)
- [Alpine.js ドキュメント](https://alpinejs.dev/)
- [SQL チュートリアル](https://www.w3schools.com/sql/)

---

**開発サーバーで今すぐ試せます！** 🚀

```bash
pnpm run dev
# http://localhost:5173
```
