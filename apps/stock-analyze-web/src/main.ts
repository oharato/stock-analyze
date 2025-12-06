import './style.css';
import Alpine from 'alpinejs';
import { sendChatMessage, sendSQLQuery, type ChatResponse, type TableData, type ChartData } from './api';
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

// チャットアプリケーションのデータと機能
Alpine.data('chatApp', () => ({
  messages: [] as any as Message[],
  inputText: '',
  isLoading: false,
  mode: 'chat',  // チャットモードまたはSQLモード
  charts: new Map() as any as Map<string, ApexCharts>,  // メッセージIDとチャートのマップ

  init() {
    console.log('Stock Analysis AI initialized');
    // ローカルストレージから履歴を復元
    this.loadHistory();
  },

  // モード切り替え
  switchMode(newMode: string) {
    this.mode = newMode;
    this.inputText = '';
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
    this.mode = 'sql';
    this.inputText = sql;
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
