/**
 * API Client
 * 
 * stock-analyze-ai Worker との通信を管理します
 */

import { API_ENDPOINT, USE_MOCK_API } from './config';

export interface ChatRequest {
    question?: string;
    sql?: string;  // カスタム SQL クエリ
}

export interface TableData {
    columns: string[];
    rows: any[][];
}

export interface ChartData {
    type: 'line' | 'bar' | 'pie';
    labels: string[];
    datasets: {
        label: string;
        data: number[];
        backgroundColor?: string | string[];
        borderColor?: string;
    }[];
}

export interface ChatResponse {
    answer: string;
    timestamp?: string;
    error?: string;
    sql?: string;  // 実行された SQL
    tableData?: TableData;  // テーブルデータ
    chartData?: ChartData;  // グラフデータ
}

/**
 * API レスポンスを処理して ChatResponse に変換する共通関数
 */
function processResponse(data: any): ChatResponse {
    // デバッグ: レスポンス全体を確認
    console.log('[API Raw Response]', data);

    if (data.error) {
        return {
            answer: `エラー: ${data.error}`,
            error: data.error,
        };
    }

    // データを整形
    let answer = '';
    let sql = '';
    let tableData: TableData | undefined;
    let chartData: ChartData | undefined;

    if (data.tool_used === 'execute_sql' && data.data) {
        // SQL を取得（data.data が配列の場合、最初の要素から取得を試みる）
        sql = data.sql || '';

        console.log('[SQL]', sql);
        console.log('[Data]', data.data);

        // カラム名の日本語マッピング
        const columnMapping: Record<string, string> = {
            'code': '銘柄コード',
            'company_name': '会社名',
            'datef': '日付',
            'week_start': '週',
            'month_start': '月',
            'open': '始値',
            'high': '高値',
            'low': '安値',
            'close': '終値',
            'volume': '出来高',
        };

        // 表示するカラムの順序
        const displayColumns = ['code', 'company_name', 'datef', 'week_start', 'month_start', 'open', 'high', 'low', 'close', 'volume'];

        // data.data が配列の場合
        if (Array.isArray(data.data) && data.data.length > 0) {
            const rowCount = data.data.length;
            answer = `SQL クエリを実行しました。\n\n実行結果: ${rowCount} 件のデータを取得しました。`;

            // データのキーを取得
            const rowKeys = Object.keys(data.data[0]);

            // 利用可能なカラムをフィルタリング
            const availableColumns = displayColumns.filter(col => rowKeys.includes(col));

            // テーブルデータを作成
            tableData = {
                columns: availableColumns.map(col => columnMapping[col] || col),
                rows: data.data.map((row: any) =>
                    availableColumns.map((col: string) => String(row[col] ?? ''))
                ),
            };
            console.log('[TableData]', tableData);
        }
        // data.data が {columns, rows} 形式の場合
        else if (data.data.columns && data.data.rows && data.data.rows.length > 0) {
            const rowCount = data.data.rows.length;
            answer = `SQL クエリを実行しました。\n\n実行結果: ${rowCount} 件のデータを取得しました。`;

            // 利用可能なカラムをフィルタリング
            const availableColumns = displayColumns.filter(col => data.data.columns.includes(col));

            tableData = {
                columns: availableColumns.map(col => columnMapping[col] || col),
                rows: data.data.rows.map((row: any) =>
                    availableColumns.map((col: string) => String(row[col] ?? ''))
                ),
            };
            console.log('[TableData]', tableData);
        } else {
            answer += '\n\nデータが見つかりませんでした。';
        }
    } else if (data.result) {
        answer = data.result;
    } else {
        answer = JSON.stringify(data, null, 2);
    }

    return {
        answer,
        sql,
        tableData,
        chartData,
    };
}

/**
 * チャット API を呼び出す
 */
export async function sendChatMessage(question: string): Promise<ChatResponse> {
    // モック API を使用する場合
    if (USE_MOCK_API) {
        return mockAPICall(question);
    }

    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ question }),
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return processResponse(data);
    } catch (error) {
        console.error('API call failed:', error);
        return {
            answer: `エラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
            error: String(error),
        };
    }
}

/**
 * SQL クエリを実行
 */
export async function sendSQLQuery(sql: string): Promise<ChatResponse> {
    // モック API を使用する場合
    if (USE_MOCK_API) {
        return mockSQLCall(sql);
    }

    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sql } as ChatRequest),
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return processResponse(data);
    } catch (error) {
        console.error('SQL query failed:', error);
        throw error;
    }
}

/**
 * モック API コール（開発用）
 */
async function mockAPICall(question: string): Promise<ChatResponse> {
    // ネットワーク遅延をシミュレート
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

    // ランダムにエラーをシミュレート（5%の確率に減少）
    if (Math.random() < 0.05) {
        throw new Error('モックAPIエラー: ネットワークエラーをシミュレートしています');
    }

    // モック SQL クエリ
    const mockSQL = `SELECT date, close_price, volume 
FROM stock_prices 
WHERE symbol = 'AAPL' 
ORDER BY date DESC 
LIMIT 30`;

    // モックテーブルデータ
    const mockTableData: TableData = {
        columns: ['日付', '終値', '出来高', '変動率'],
        rows: [
            ['2025-12-05', '¥15,230', '1,234,567', '+2.5%'],
            ['2025-12-04', '¥14,860', '1,456,789', '+1.2%'],
            ['2025-12-03', '¥14,680', '987,654', '-0.8%'],
            ['2025-12-02', '¥14,800', '1,123,456', '+0.5%'],
            ['2025-12-01', '¥14,730', '1,345,678', '+1.8%'],
        ],
    };

    // モックチャートデータ
    const mockChartData: ChartData = {
        type: 'line',
        labels: ['12/01', '12/02', '12/03', '12/04', '12/05'],
        datasets: [
            {
                label: '株価（円）',
                data: [14730, 14800, 14680, 14860, 15230],
                borderColor: 'hsl(250, 100%, 65%)',
                backgroundColor: 'hsla(250, 100%, 65%, 0.1)',
            },
        ],
    };

    const responses = [
        {
            answer: `「${question}」についてお答えします。\n\n現在の市場データを分析した結果、以下のような傾向が見られます：\n\n📊 **主要指標**\n• 株価: 安定した上昇トレンド\n• 取引量: 平均を20%上回る\n• ボラティリティ: 低〜中程度\n\n📈 **テクニカル分析**\n• RSI: 55（中立圏）\n• MACD: 買いシグナル\n• 移動平均: ゴールデンクロス形成中\n\n💡 **推奨アクション**\n短期的な上昇が期待できます。ただし、利益確定のタイミングには注意が必要です。`,
            sql: mockSQL,
            tableData: mockTableData,
            chartData: mockChartData,
        },
        {
            answer: `ご質問ありがとうございます。\n\n「${question}」に関する分析結果をお伝えします：\n\n🌍 **市場環境**\n• 全体センチメント: ポジティブ\n• 主要指数: 上昇基調\n• 投資家心理: 楽観的\n\n🏢 **セクター分析**\n• テクノロジー: ⬆️ 強気\n• 金融: ⬆️ 好調\n• エネルギー: ➡️ 横ばい\n• ヘルスケア: ⬆️ 上昇中`,
            sql: `SELECT sector, avg(price_change_pct) as avg_change\nFROM stock_prices\nGROUP BY sector\nORDER BY avg_change DESC`,
            tableData: {
                columns: ['セクター', '平均変動率', 'トレンド'],
                rows: [
                    ['テクノロジー', '+3.2%', '⬆️'],
                    ['金融', '+2.1%', '⬆️'],
                    ['ヘルスケア', '+1.5%', '⬆️'],
                    ['エネルギー', '+0.2%', '➡️'],
                ],
            },
            chartData: {
                type: 'bar' as const,
                labels: ['テクノロジー', '金融', 'ヘルスケア', 'エネルギー'],
                datasets: [
                    {
                        label: '平均変動率（%）',
                        data: [3.2, 2.1, 1.5, 0.2],
                        backgroundColor: [
                            'hsl(250, 100%, 65%)',
                            'hsl(280, 100%, 70%)',
                            'hsl(180, 100%, 60%)',
                            'hsl(40, 95%, 60%)',
                        ],
                    },
                ],
            },
        },
    ];

    return responses[Math.floor(Math.random() * responses.length)];
}

/**
 * モック SQL コール（開発用）
 */
async function mockSQLCall(sql: string): Promise<ChatResponse> {
    // ネットワーク遅延をシミュレート
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));

    // SQL を解析してモックデータを生成
    const isSelectQuery = sql.trim().toUpperCase().startsWith('SELECT');

    if (!isSelectQuery) {
        throw new Error('現在は SELECT クエリのみサポートしています');
    }

    // モックテーブルデータ
    const mockTableData: TableData = {
        columns: ['symbol', 'date', 'close_price', 'volume'],
        rows: [
            ['AAPL', '2025-12-05', 15230, 1234567],
            ['AAPL', '2025-12-04', 14860, 1456789],
            ['AAPL', '2025-12-03', 14680, 987654],
            ['GOOGL', '2025-12-05', 28450, 2345678],
            ['GOOGL', '2025-12-04', 27980, 2123456],
        ],
    };

    // モックチャートデータ
    const mockChartData: ChartData = {
        type: 'line',
        labels: ['12/03', '12/04', '12/05'],
        datasets: [
            {
                label: 'AAPL',
                data: [14680, 14860, 15230],
                borderColor: 'hsl(250, 100%, 65%)',
            },
            {
                label: 'GOOGL',
                data: [27800, 27980, 28450],
                borderColor: 'hsl(180, 100%, 60%)',
            },
        ],
    };

    return {
        answer: `✅ SQL クエリを実行しました。\n\n${mockTableData.rows.length} 件のレコードを取得しました。\n\n以下のテーブルとグラフでデータを確認できます。`,
        sql: sql,
        tableData: mockTableData,
        chartData: mockChartData,
    };
}
