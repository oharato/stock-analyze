import './style.css';
import Alpine from 'alpinejs';
import { sendChatMessage, sendSQLQuery, fetchEdinetList, fetchEdinetDetail, type ChatResponse, type TableData, type ChartData } from './api';
import { createChart, destroyChart } from './chart';
import ApexCharts from 'apexcharts';

// Alpine.js をグローバルに設定
declare global {
  interface Window {
    Alpine: typeof Alpine;
  }
}

window.Alpine = Alpine;

// メッセージの型定義
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  time: string;
  sql?: string;
  tableData?: TableData;
  chartData?: ChartData;
}

// EDINET Doc Interface
interface EdinetDoc {
  year: number;
  net_sales: number;
  operating_income: number;
  net_income: number;
  earnings_per_share: number;
  doc_id: string;
  date: string;
}

// チャットアプリケーションのデータと機能
Alpine.data('chatApp', () => ({
  messages: [] as any as Message[],
  inputText: '',
  isLoading: false,
  mode: 'chat',  // チャットモードまたはSQLモード
  charts: new Map() as any as Map<string, ApexCharts>,  // メッセージIDとチャートのマップ

  // EDINET State
  edinetMode: 'search' as 'search' | 'detail',
  edinetTicker: '',
  edinetDocs: [] as any[],
  selectedDoc: null as any,
  edinetCharts: {} as Record<string, ApexCharts>,

  init() {
    console.log('Stock Analysis AI initialized');
    // ローカルストレージから履歴を復元
    this.loadHistory();
  },

  // モード切り替え
  switchMode(newMode: string) {
    this.mode = newMode;
    if (newMode !== 'edinet') {
      // Optional: reset EDINET state or keep it cached
    } else {
      // Focus input if empty
      if (!this.edinetTicker) {
        setTimeout(() => {
          const input = document.querySelector('.edinet-interface input') as HTMLInputElement;
          if (input) input.focus();
        }, 100);
      }
    }
  },

  // メッセージ送信
  async sendMessage() {
    const text = this.inputText.trim();
    if (!text || this.isLoading) return;

    if (this.mode === 'sql') {
      await this.executeSQLQuery(text);
    } else {
      await this.sendChatMessage(text);
    }
  },

  // ... (sendChatMessage, executeSQLQuery unchanged) ...
  // チャットメッセージ送信
  async sendChatMessage(text: string) {
    // ユーザーメッセージを追加
    const userMessage: Message = {
      id: this.generateId(),
      role: 'user',
      content: text,
      time: this.getCurrentTime(),
    };

    this.messages.push(userMessage);
    this.inputText = '';
    this.scrollToBottom();

    // AIレスポンスを取得
    this.isLoading = true;

    try {
      const response: ChatResponse = await sendChatMessage(text);

      const assistantMessage: Message = {
        id: this.generateId(),
        role: 'assistant',
        content: response.answer,
        time: this.getCurrentTime(),
        sql: response.sql,
        tableData: response.tableData,
        chartData: response.chartData,
      };

      this.messages.push(assistantMessage);
      this.scrollToBottom();
      this.saveHistory();

      // チャートを作成
      if (response.chartData) {
        setTimeout(() => this.renderChart(assistantMessage.id, response.chartData!), 100);
      }
    } catch (error) {
      console.error('Error getting AI response:', error);

      const errorMessage: Message = {
        id: this.generateId(),
        role: 'assistant',
        content: '申し訳ございません。エラーが発生しました。もう一度お試しください。',
        time: this.getCurrentTime(),
      };

      this.messages.push(errorMessage);
      this.scrollToBottom();
    } finally {
      this.isLoading = false;
    }
  },

  // SQL クエリ実行
  async executeSQLQuery(sql: string) {
    // ユーザーメッセージを追加
    const userMessage: Message = {
      id: this.generateId(),
      role: 'user',
      content: `\`\`\`sql\n${sql}\n\`\`\``,
      time: this.getCurrentTime(),
    };

    this.messages.push(userMessage);
    this.inputText = '';
    this.scrollToBottom();

    // SQL を実行
    this.isLoading = true;

    try {
      const response: ChatResponse = await sendSQLQuery(sql);

      const assistantMessage: Message = {
        id: this.generateId(),
        role: 'assistant',
        content: response.answer,
        time: this.getCurrentTime(),
        sql: response.sql,
        tableData: response.tableData,
        chartData: response.chartData,
      };

      this.messages.push(assistantMessage);
      this.scrollToBottom();
      this.saveHistory();

      // チャートを作成
      if (response.chartData) {
        setTimeout(() => this.renderChart(assistantMessage.id, response.chartData!), 100);
      }
    } catch (error) {
      console.error('Error executing SQL:', error);

      const errorMessage: Message = {
        id: this.generateId(),
        role: 'assistant',
        content: `❌ SQL エラー: ${error instanceof Error ? error.message : 'クエリの実行に失敗しました'}`,
        time: this.getCurrentTime(),
      };

      this.messages.push(errorMessage);
      this.scrollToBottom();
    } finally {
      this.isLoading = false;
    }
  },

  // --- EDINET Logic ---

  async fetchEdinetData() {
    if (!this.edinetTicker) return;
    this.isLoading = true;
    this.edinetMode = 'search';
    this.selectedDoc = null;

    try {
      // Using new API
      const result = await fetchEdinetList(this.edinetTicker);

      if (result && result.rows.length > 0) {
        // Convert rows to objects
        const cols = result.columns;
        this.edinetDocs = result.rows.map((row: any[]) => {
          const obj: any = {};
          cols.forEach((col: string, idx: number) => { obj[col] = row[idx]; });
          return obj;
        });

        // Render Charts
        setTimeout(() => this.renderEdinetCharts(), 100);
      } else {
        this.edinetDocs = [];
        alert('データが見つかりませんでした。証券コードを確認してください。');
      }

    } catch (error) {
      console.error('EDINET fetch error:', error);
      alert('データ取得に失敗しました。');
    } finally {
      this.isLoading = false;
    }
  },

  renderEdinetCharts() {
    // ... existing ...
    if (this.edinetCharts['sales']) this.edinetCharts['sales'].destroy();
    if (this.edinetCharts['profit']) this.edinetCharts['profit'].destroy();
    // ... unchanged ...
    const docs = this.edinetDocs as EdinetDoc[];
    const years = docs.map(d => d.year);
    const sales = docs.map(d => d.net_sales);
    const opIncome = docs.map(d => d.operating_income);
    const netIncome = docs.map(d => d.net_income);
    const eps = docs.map(d => d.earnings_per_share);
    // ... rest is same ...
    // Chart 1
    const optionsSales = {
      chart: { type: 'bar', height: 300, toolbar: { show: false }, foreColor: '#cbd5e1' },
      theme: { mode: 'dark' },
      series: [
        { name: '売上高', data: sales },
        { name: '営業利益', data: opIncome }
      ],
      xaxis: { categories: years },
      yaxis: {
        labels: {
          formatter: (val: number) => this.formatLargeNumber(val)
        }
      },
      tooltip: {
        y: {
          formatter: (val: number) => this.formatLargeNumber(val)
        }
      },
      colors: ['#008FFB', '#00E396'],
      dataLabels: { enabled: false },
      title: { text: undefined }
    };
    const chartSales = new ApexCharts(document.querySelector("#edinet-chart-sales"), optionsSales);
    chartSales.render();
    this.edinetCharts['sales'] = chartSales;

    // Chart 2
    const optionsProfit = {
      chart: { type: 'line', height: 300, toolbar: { show: false }, foreColor: '#cbd5e1' },
      theme: { mode: 'dark' },
      series: [
        { name: '当期純利益', type: 'column', data: netIncome },
        { name: 'EPS', type: 'line', data: eps }
      ],
      xaxis: { categories: years },
      yaxis: [
        {
          title: { text: '純利益' },
          labels: { formatter: (val: number) => this.formatLargeNumber(val) }
        },
        {
          opposite: true,
          title: { text: 'EPS' },
          labels: { formatter: (val: number) => val.toFixed(1) }
        }
      ],
      tooltip: {
        y: {
          formatter: (val: number, { seriesIndex }: any) => {
            return seriesIndex === 0 ? this.formatLargeNumber(val) : val.toFixed(2);
          }
        }
      },
      colors: ['#FEB019', '#FF4560'],
      dataLabels: { enabled: false }
    };
    const chartProfit = new ApexCharts(document.querySelector("#edinet-chart-profit"), optionsProfit);
    chartProfit.render();
    this.edinetCharts['profit'] = chartProfit;
  },

  async selectDoc(doc: any) {
    this.isLoading = true;
    try {
      const result = await fetchEdinetDetail(doc.doc_id);

      if (result && result.rows.length > 0) {
        const cols = result.columns;
        const row = result.rows[0];
        const detail: any = {};
        cols.forEach((col: string, idx: number) => { detail[col] = row[idx]; });

        this.selectedDoc = detail;
        this.edinetMode = 'detail';
      }
    } catch (e) {
      console.error(e);
      alert('詳細取得エラー');
    } finally {
      this.isLoading = false;
    }
  },

  formatCurrency(val: any) {
    if (val === undefined || val === null) return '-';
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(Number(val));
  },

  formatLargeNumber(val: number): string {
    if (val === undefined || val === null) return '-';
    const abs = Math.abs(val);
    if (abs >= 100000000) {
      return (val / 100000000).toFixed(1) + '億円';
    } else if (abs >= 1000000) {
      return (val / 1000000).toFixed(0) + '百万円';
    }
    return val.toLocaleString();
  },

  // サジェスションから送信
  sendSuggestion(text: string) {
    this.inputText = text;
    this.sendMessage();
  },

  // Enter キーハンドラー
  handleEnter(event: KeyboardEvent) {
    if (event.shiftKey) {
      // Shift+Enter で改行
      return;
    }
    // Enter のみで送信
    this.sendMessage();
  },

  // チャートをレンダリング
  renderChart(messageId: string, chartData: ChartData) {
    const element = document.getElementById(`chart-${messageId}`);
    if (!element) {
      console.warn(`Chart container not found for message ${messageId}`);
      return;
    }

    // 既存のチャートを破棄
    const existingChart = this.charts.get(messageId);
    if (existingChart) {
      destroyChart(existingChart);
    }

    // 新しいチャートを作成
    const chart = createChart(element, chartData);
    this.charts.set(messageId, chart);
  },

  // SQL をコピー
  copySQLToInput(sql: string) {
    // If copying SQL, maybe switch to SQL mode?
    if (this.mode !== 'sql') this.switchMode('sql'); // Ensure SQL mode

    // Copy to input
    this.inputText = sql;
    // Format if necessary

    // 入力欄にフォーカス
    setTimeout(() => {
      const input = (this as any).$refs?.input as HTMLTextAreaElement | undefined;
      if (input) {
        input.focus();
      }
    }, 100);
  },

  // ユーティリティ関数
  generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  getCurrentTime(): string {
    const now = new Date();
    return now.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  scrollToBottom() {
    // Alpine の $nextTick の代わりに setTimeout を使用
    setTimeout(() => {
      const messagesArea = (this as any).$refs?.messagesArea as HTMLElement | undefined;
      if (messagesArea) {
        messagesArea.scrollTop = messagesArea.scrollHeight;
      }
    }, 0);
  },

  // ローカルストレージ管理
  saveHistory() {
    try {
      // チャートデータは保存しない（再レンダリングが必要）
      const messagesToSave = this.messages.map(msg => ({
        ...msg,
        chartData: undefined,  // チャートデータは除外
      }));
      localStorage.setItem('chatHistory', JSON.stringify(messagesToSave));
    } catch (error) {
      console.error('Failed to save history:', error);
    }
  },

  loadHistory() {
    try {
      const saved = localStorage.getItem('chatHistory');
      if (saved) {
        this.messages = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  },

  clearHistory() {
    // すべてのチャートを破棄
    this.charts.forEach(chart => destroyChart(chart));
    this.charts.clear();

    this.messages = [];
    localStorage.removeItem('chatHistory');
  },
}));

// Alpine.js を起動
Alpine.start();
