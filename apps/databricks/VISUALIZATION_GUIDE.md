# Databricks での株価チャート作成ガイド

アップロードした Parquet ファイルを使って、Databricks 上でグラフを作成する手順です。

## 1. データのテーブル化 (Databricks Notebook または SQL Editor)

まず、Volume にアップロードされた複数の Parquet ファイルをまとめて読み込み、クエリ可能な Delta テーブルを作成します。

### SQL を使用する場合

```sql
-- カタログとスキーマは環境に合わせて変更してください
USE CATALOG main;
USE SCHEMA default;

-- 1. Parquetファイルを読み込むための一時ビューを作成
-- パスはアップロード先に合わせてください (/Volumes/<catalog>/<schema>/<volume>/<path>)
CREATE OR REPLACE TEMPORARY VIEW raw_stock_prices_parquet
USING PARQUET
OPTIONS (path "/Volumes/main/default/prices/*.parquet");

-- 2. 高速化のために Delta テーブルとして保存
CREATE OR REPLACE TABLE stock_prices AS
SELECT
  code,
  -- dateカラムがミリ秒Unixタイムスタンプ(INT64)の場合の変換
  -- Parquetの型がTIMESTAMP_MILLISならそのままでOKですが、念のためキャスト例
  try_cast(date / 1000 as timestamp) as trade_date,
  open,
  high,
  low,
  close,
  adjClose,
  volume
FROM raw_stock_prices_parquet;

-- データの確認
SELECT * FROM stock_prices LIMIT 10;
```

### Python (PySpark) を使用する場合

```python
# パスは環境に合わせて変更してください
source_path = "/Volumes/main/default/prices/*.parquet"

# Parquet 読み込み
df = spark.read.parquet(source_path)

# Delta テーブルとして保存 (テーブル名: stock_prices)
df.write.format("delta").mode("overwrite").saveAsTable("main.default.stock_prices")

display(df)
```

## 2. グラフの作成

### SQL Editor の場合

1. クエリを実行します。
   ```sql
   SELECT trade_date, close, code 
   FROM stock_prices 
   WHERE code = '1301' -- 特定の銘柄に絞る
   ORDER BY trade_date;
   ```
2. 結果ペインの「+」ボタンを押し、「Visualization」を選択します。
3. Visualization Type で **Line** (折れ線グラフ) を選択します。
   - **X Column**: `trade_date`
   - **Y Column**: `close`
   - **Group by**: `code` (複数の銘柄を出す場合)

### Notebook (Python) の場合

### Python (Plotly) によるチャート作成 (日足・週足・月足 + 移動平均線 + 出来高)

以下のスクリプトは、指定した銘柄ごとに「日足(直近60日)」「週足(直近300日相当)」「月足(直近1500日相当)」の3つのチャートを作成し、それぞれに移動平均線(5, 25, 75)と出来高を表示します。

```python
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import pyspark.sql.functions as F
from pyspark.sql.window import Window
import datetime

# --- 設定 ---
TARGET_CODES = ['1301', '3031'] # 表示したい銘柄コードのリスト
# ------------

# データの読み込み
df = spark.table("main.default.stock_prices").filter(F.col("code").isin(TARGET_CODES))

# 日付正規化: dateString (YYYY-MM-DD) を優先して Timestamp に変換
if "dateString" in df.columns:
    df = df.withColumn("trade_date", F.to_timestamp(F.col("dateString"), "yyyy-MM-dd"))
elif "date" in df.columns:
    # date がミリ秒UNIXタイムスタンプ(BIGINT)の場合のフォールバック
    df = df.withColumn("trade_date", (F.col("date").cast("double") / 1000).cast("timestamp"))
else:
    raise ValueError("dateString column not found")

# 移動平均線を計算する関数
def add_moving_averages(df_in, windows=[5, 25, 75]):
    w = Window.partitionBy("code").orderBy("trade_date")
    for window_size in windows:
        df_in = df_in.withColumn(f"ma_{window_size}", F.avg("close").over(w.rowsBetween(-window_size + 1, 0)))
    return df_in

# 集計とフィルタリングを行う関数
def process_data(df_base, interval, days_to_show):
    # 1. 集計 (Agg)
    if interval == 'DAILY':
        df_agg = df_base.select("code", "trade_date", "open", "high", "low", "close", "volume")
    elif interval == 'WEEKLY':
        df_agg = df_base.withColumn("year_week", F.date_trunc("week", "trade_date")) \
            .groupBy("code", "year_week").agg(
                F.first("open").alias("open"),
                F.max("high").alias("high"),
                F.min("low").alias("low"),
                F.last("close").alias("close"),
                F.sum("volume").alias("volume"),
                F.min("trade_date").alias("trade_date")
            )
    elif interval == 'MONTHLY':
        df_agg = df_base.withColumn("year_month", F.date_trunc("month", "trade_date")) \
            .groupBy("code", "year_month").agg(
                F.first("open").alias("open"),
                F.max("high").alias("high"),
                F.min("low").alias("low"),
                F.last("close").alias("close"),
                F.sum("volume").alias("volume"),
                F.min("trade_date").alias("trade_date")
            )

    # 2. 移動平均線の計算 (期間フィルタリング前に行う)
    df_ma = add_moving_averages(df_agg, [5, 25, 75])

    # 3. 期間フィルタリング (表示用)
    # 最新日付を取得
    max_date_row = df_ma.select(F.max("trade_date")).collect()[0][0]
    if not max_date_row:
        return None
    cutoff_date = max_date_row - datetime.timedelta(days=days_to_show)
    
    return df_ma.filter(F.col("trade_date") >= cutoff_date).orderBy("trade_date").toPandas()

# メイン処理: 銘柄ごとに作図
for code in TARGET_CODES:
    # 各期間のデータを準備
    df_d = process_data(df.filter(F.col("code") == code), 'DAILY', 60)
    df_w = process_data(df.filter(F.col("code") == code), 'WEEKLY', 300)
    df_m = process_data(df.filter(F.col("code") == code), 'MONTHLY', 1500)
    
    if df_d is None or df_d.empty:
        print(f"No data for {code}")
        continue

    # 3段のサブプロット作成
    fig = make_subplots(
        rows=3, cols=1, 
        shared_xaxes=False,
        vertical_spacing=0.1,
        subplot_titles=[
            f"{code} Daily (Last 60 days)", 
            f"{code} Weekly (Last 300 days)", 
            f"{code} Monthly (Last 1500 days)"
        ],
        specs=[[{"secondary_y": True}], [{"secondary_y": True}], [{"secondary_y": True}]]
    )

    # 各期間のデータをプロットするヘルパー
    def add_charts(sub_df, row_idx):
        # Candlestick
        fig.add_trace(go.Candlestick(
            x=sub_df['trade_date'], open=sub_df['open'], high=sub_df['high'], low=sub_df['low'], close=sub_df['close'],
            name='OHLC'
        ), row=row_idx, col=1, secondary_y=False)

        # Moving Averages
        colors = {5: 'orange', 25: 'purple', 75: 'green'}
        for ma in [5, 25, 75]:
            fig.add_trace(go.Scatter(
                x=sub_df['trade_date'], y=sub_df[f'ma_{ma}'], 
                mode='lines', name=f'MA{ma}', line=dict(color=colors[ma], width=1)
            ), row=row_idx, col=1, secondary_y=False)

        # Volume
        fig.add_trace(go.Bar(
            x=sub_df['trade_date'], y=sub_df['volume'], name='Volume',
            marker_color='silver', opacity=0.5
        ), row=row_idx, col=1, secondary_y=True)

        # Adjust Volume Axis
        if not sub_df['volume'].empty:
            max_vol = sub_df['volume'].max()
            fig.update_yaxes(range=[0, max_vol * 4], showgrid=False, secondary_y=True, row=row_idx, col=1)
        
        # Hide Range Slider for cleaner look
        fig.update_xaxes(rangeslider_visible=False, row=row_idx, col=1)

    # プロット実行
    add_charts(df_d, 1)
    if df_w is not None and not df_w.empty: add_charts(df_w, 2)
    if df_m is not None and not df_m.empty: add_charts(df_m, 3)

    fig.update_layout(height=1200, title_text=f"Multi-Timeframe Analysis: {code}", showlegend=False)
    fig.show()
```

### (推奨) `lightweight-charts-python` を使用した完全版スクリプト

TradingView の Lightweight Charts を使用して、より高機能なチャートを表示します。
日足・週足・月足の切り替えではなく、全てのチャートを順に表示する構成です。

1. **ライブラリのインストール**:
   ```bash
   %pip install lightweight-charts
   ```

2. **実行コード**:

```python
from lightweight_charts import Chart
import pandas as pd
import pyspark.sql.functions as F
from pyspark.sql.window import Window
import datetime

# --- 設定 ---
TARGET_CODES = ['1301', '3031'] # 表示したい銘柄コード
# ------------

# 1. データ読み込み & 日付変換
df = spark.table("main.default.stock_prices").filter(F.col("code").isin(TARGET_CODES))

if "dateString" in df.columns:
    df = df.withColumn("trade_date", F.to_timestamp(F.col("dateString"), "yyyy-MM-dd"))
elif "date" in df.columns:
    df = df.withColumn("trade_date", (F.col("date").cast("double") / 1000).cast("timestamp"))
else:
    raise ValueError("dateString or date column not found")

# 2. 移動平均計算関数
def add_moving_averages(df_in, windows=[5, 25, 75]):
    w = Window.partitionBy("code").orderBy("trade_date")
    for window_size in windows:
        df_in = df_in.withColumn(f"ma_{window_size}", F.avg("close").over(w.rowsBetween(-window_size + 1, 0)))
    return df_in

# 3. 集計・整形関数
def process_data(df_base, interval, days_to_show):
    # Aggregation
    if interval == 'DAILY':
        df_agg = df_base.select("code", "trade_date", "open", "high", "low", "close", "volume")
    elif interval == 'WEEKLY':
        df_agg = df_base.withColumn("year_week", F.date_trunc("week", "trade_date")) \
            .groupBy("code", "year_week").agg(
                F.first("open").alias("open"), F.max("high").alias("high"), F.min("low").alias("low"), F.last("close").alias("close"),
                F.sum("volume").alias("volume"), F.min("trade_date").alias("trade_date")
            )
    elif interval == 'MONTHLY':
        df_agg = df_base.withColumn("year_month", F.date_trunc("month", "trade_date")) \
            .groupBy("code", "year_month").agg(
                F.first("open").alias("open"), F.max("high").alias("high"), F.min("low").alias("low"), F.last("close").alias("close"),
                F.sum("volume").alias("volume"), F.min("trade_date").alias("trade_date")
            )

    # MA Calculation
    df_ma = add_moving_averages(df_agg, [5, 25, 75])

    # Filtering
    max_date_row = df_ma.select(F.max("trade_date")).collect()[0][0]
    if not max_date_row: return None
    cutoff_date = max_date_row - datetime.timedelta(days=days_to_show)
    
    # Convert to Pandas & Rename for lightweight-charts
    pdf = df_ma.filter(F.col("trade_date") >= cutoff_date).orderBy("trade_date").toPandas()
    
    # Rename MA columns to match line names (MA5, MA25...) to avoid NameError
    rename_dict = {'trade_date': 'date'}
    for ma in [5, 25, 75]:
        rename_dict[f'ma_{ma}'] = f'MA{ma}'
        
    return pdf.rename(columns=rename_dict)

# 4. メイン描画処理 (安定動作のため1つのチャートのみ表示)
# 注意: Databricks Notebook環境では複数のChartインスタンスをループで作成すると
# "AssertionError: cannot start a process twice" エラーになる場合があります。
# そのため、ここでは変数を指定して1つのチャートを描画する形式にします。

target_code = '1301'
target_label = 'Daily' # Daily, Weekly, Monthly
days = 100 # 期間

# データ取得
data = process_data(df.filter(F.col("code") == target_code), target_label.upper(), days)

if data is not None and not data.empty:
    print(f"--- {target_code} {target_label} Chart ({len(data)} rows) ---")

    # Chart 初期化
    # toolbox=False で軽量化
    chart = Chart(width=800, height=500, toolbox=False)
    chart.legend(True)
    chart.topbar.textbox('title', f'{target_code} {target_label}')

    # データセット
    chart.set(data)

    # 移動平均線の追加
    ma_colors = {5: 'orange', 25: '#A020F0', 75: '#008000'}
    for ma in [5, 25, 75]:
        ma_name = f'MA{ma}'
        if ma_name in data.columns:
            line = chart.create_line(name=ma_name, color=ma_colors[ma], width=1)
            line.set(data)

    # 表示 (同期的に表示)
    chart.show()
else:
    print("No data found.")

```



このスクリプトは以下の処理を行います：
1. **集計**: `date_trunc` 関数を使用して、週次・月次の始値(first)、高値(max)、安値(min)、終値(last)を正確に計算します。
2. **描画**: Plotly を使用して、指定した複数の銘柄のチャートを縦に並べて表示します。スライダーでのズームも可能です。

