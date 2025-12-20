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
    type: 'line' | 'bar' | 'pie' | 'candlestick';
    labels?: string[]; // For line/bar/pie
    series: {          // ApexCharts structure
        name: string;
        type?: string;
        data: number[] | { x: any; y: any }[];
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
        sql = data.sql || '';
        let rawRows: any[] = [];
        let rowKeys: string[] = [];

        // Normalize data to Array of Objects
        if (Array.isArray(data.data) && data.data.length > 0) {
            rawRows = data.data;
            rowKeys = Object.keys(rawRows[0]);
        } else if (data.data.rows && data.data.columns) {
            rowKeys = data.data.columns;
            rawRows = data.data.rows.map((r: any[]) => {
                const obj: any = {};
                rowKeys.forEach((col, i) => obj[col] = r[i]);
                return obj;
            });
        }

        if (rawRows.length > 0) {
            const rowCount = rawRows.length;
            answer = `SQL クエリを実行しました。\n\n実行結果: ${rowCount} 件のデータを取得しました。`;

            // 1. Table Data Processing
            const columnMapping: Record<string, string> = {
                'code': '銘柄コード', 'company_name': '会社名', 'datef': '日付', 'date': '日付',
                'week_start': '週', 'month_start': '月',
                'open': '始値', 'high': '高値', 'low': '安値', 'close': '終値', 'volume': '出来高',
            };
            const displayColumns = ['code', 'company_name', 'date', 'datef', 'week_start', 'month_start', 'open', 'high', 'low', 'close', 'volume'];
            const availableColumns = displayColumns.filter(col => rowKeys.includes(col));

            tableData = {
                columns: availableColumns.map(col => columnMapping[col] || col),
                rows: rawRows.map((row: any) =>
                    availableColumns.map((col: string) => String(row[col] ?? ''))
                ),
            };

            // 2. Chart Data Processing (Auto-detect Candlestick)
            const hasOHLC = ['open', 'high', 'low', 'close'].every(k => rowKeys.includes(k));
            const dateKey = rowKeys.find(k => ['week_start', 'month_start', 'datef', 'date'].includes(k));

            if (hasOHLC && dateKey) {
                // ApexCharts Candlestick Format: [{ x: date, y: [open, high, low, close] }]
                const candleData = rawRows.map((row: any) => {
                    let d = row[dateKey!];
                    // Handle stringified epoch ms (e.g., "1735689600000")
                    if (typeof d === 'string' && /^\d+$/.test(d) && d.length > 10) {
                        d = Number(d);
                    }
                    return {
                        x: new Date(d).getTime(),
                        y: [row.open, row.high, row.low, row.close].map(Number)
                    };
                }).sort((a: any, b: any) => a.x - b.x);

                // Calculate Moving Averages (Simple)
                const closePrices = candleData.map((d: any) => d.y[3]);
                const sma5 = closePrices.map((_, i, arr) => {
                    if (i < 4) return null;
                    const sum = arr.slice(i - 4, i + 1).reduce((a: number, b: number) => a + b, 0);
                    return { x: candleData[i].x, y: sum / 5 };
                }).filter((d: any) => d !== null);

                const sma25 = closePrices.map((_, i, arr) => {
                    if (i < 24) return null;
                    const sum = arr.slice(i - 24, i + 1).reduce((a: number, b: number) => a + b, 0);
                    return { x: candleData[i].x, y: sum / 25 };
                }).filter((d: any) => d !== null);

                // Volume Data
                let volumeData: any[] = [];
                if (rowKeys.includes('volume')) {
                    volumeData = rawRows.map((row: any) => ({
                        x: new Date(row[dateKey!]).getTime(),
                        y: Number(row.volume)
                    })).sort((a: any, b: any) => a.x - b.x);
                }

                chartData = {
                    type: 'candlestick', // Base type
                    series: [
                        {
                            name: '株価',
                            type: 'candlestick',
                            data: candleData
                        },
                        {
                            name: '5日移動平均',
                            type: 'line',
                            data: sma5 as { x: any; y: any }[]
                        },
                        {
                            name: '25日移動平均',
                            type: 'line',
                            data: sma25 as { x: any; y: any }[]
                        }
                    ]
                };

                // Create a separate series/logic for volume if needed, 
                // but usually mixed charts handled by series type overrides.
                // ApexCharts 'candlestick' type supports mixed line/bar/area.
                if (volumeData.length > 0) {
                    chartData!.series.push({
                        name: '出来高',
                        type: 'bar',
                        data: volumeData
                    });
                }
            }
        } else {
            answer += '\n\nデータが見つかりませんでした。';
        }
    } else if (data.result) {
        answer = data.result;
    } else {
        // Fallback for generic JSON
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
 * EDINET API Calls
 */

export async function fetchEdinetList(ticker: string): Promise<TableData | null> {
    try {
        const response = await fetch(`${API_ENDPOINT}/edinet/list`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ticker }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const json = await response.json();
        const data = json.data;

        // Mcp tool implementation returns JSON string in content[0].text
        // Our backend parses it. If DuckDB query returns array of objects:
        if (Array.isArray(data) && data.length > 0) {
            const columns = Object.keys(data[0]);
            const rows = data.map((item: any) => columns.map(col => item[col]));
            return { columns, rows };
        } else if (Array.isArray(data)) {
            return { columns: [], rows: [] };
        }

        return null;

    } catch (error) {
        console.error('fetchEdinetList failed:', error);
        throw error;
    }
}

export async function fetchEdinetDetail(docId: string): Promise<TableData | null> {
    try {
        const response = await fetch(`${API_ENDPOINT}/edinet/detail`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ doc_id: docId }),
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const json = await response.json();
        const data = json.data;

        if (Array.isArray(data) && data.length > 0) {
            const columns = Object.keys(data[0]);
            const rows = data.map((item: any) => columns.map(col => item[col]));
            return { columns, rows };
        }
        // If getting single object (not array) for detail? 
        // DuckDB query `SELECT * FROM ... WHERE doc_id = ...` returns array of 1 object usually.
        return null;
    } catch (error) {
        console.error('fetchEdinetDetail failed:', error);
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
        series: [
            {
                name: '株価（円）',
                data: [14730, 14800, 14680, 14860, 15230],
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
                series: [
                    {
                        name: '平均変動率（%）',
                        data: [3.2, 2.1, 1.5, 0.2],
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
        series: [
            {
                name: 'AAPL',
                data: [14680, 14860, 15230],
            },
            {
                name: 'GOOGL',
                data: [27800, 27980, 28450],
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
