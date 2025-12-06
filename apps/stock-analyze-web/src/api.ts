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
            body: JSON.stringify({ question } as ChatRequest),
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        const data: ChatResponse = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        return data;
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
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

        const data: ChatResponse = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        return data;
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
