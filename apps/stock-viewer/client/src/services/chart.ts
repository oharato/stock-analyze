import {
    createChart,
    CandlestickSeries,
    CandlestickData,
    IChartApi,
    ISeriesApi,
    HistogramSeries,
    HistogramData,
    LineSeries,
    LineData,
    MouseEventParams
} from 'lightweight-charts';
import { PriceData } from '../types';

/**
 * チャート制御クラス
 * Lightweight Charts を使用して株価チャートを描画します。
 */
export class StockChart {
    private chart: IChartApi | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private candlestickSeries: ISeriesApi<'Candlestick'> | null = null;
    private volumeSeries: ISeriesApi<'Histogram'> | null = null;
    private sma5Series: ISeriesApi<'Line'> | null = null;
    private sma25Series: ISeriesApi<'Line'> | null = null;
    private sma75Series: ISeriesApi<'Line'> | null = null;
    private legendElement: HTMLElement | null = null;
    private isMinimized = false;

    // データ保持 (凡例表示用)
    private priceDataPoints: CandlestickData[] = [];
    private sma5DataPoints: LineData[] = [];
    private sma25DataPoints: LineData[] = [];
    private sma75DataPoints: LineData[] = [];
    private volumeDataPoints: HistogramData[] = [];

    /**
     * チャートを初期化します。
     */
    init(container: HTMLElement): void {
        if (this.chart) {
            this.destroy();
        }

        // コンテナの準備
        container.innerHTML = '';
        container.style.position = 'relative';

        const width = container.clientWidth || 400;
        const height = container.clientHeight || 200;

        this.chart = createChart(container, {
            width,
            height,
            layout: {
                background: { color: '#131722' },
                textColor: '#d1d4dc',
            },
            grid: {
                vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
                horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
            },
            rightPriceScale: {
                borderColor: 'rgba(197, 203, 206, 0.8)',
            },
            timeScale: {
                borderColor: 'rgba(197, 203, 206, 0.8)',
                timeVisible: true,
                secondsVisible: false,
            },
        });

        // 凡例要素の作成
        this.legendElement = document.createElement('div');
        this.legendElement.className = 'chart-legend';
        this.legendElement.style.pointerEvents = 'auto'; // トグルボタンクリックのため
        container.appendChild(this.legendElement);

        // ResizeObserver
        this.resizeObserver = new ResizeObserver(entries => {
            if (entries.length === 0 || !this.chart) return;
            const { width, height } = entries[0].contentRect;
            this.chart.resize(width, height);
        });
        this.resizeObserver.observe(container);

        // 各シリーズの初期化
        this.candlestickSeries = this.chart.addSeries(CandlestickSeries, {
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
        });

        this.sma5Series = this.chart.addSeries(LineSeries, { color: '#2962FF', lineWidth: 1 });
        this.sma25Series = this.chart.addSeries(LineSeries, { color: '#FF6D00', lineWidth: 1 });
        this.sma75Series = this.chart.addSeries(LineSeries, { color: '#F44336', lineWidth: 1 });

        this.volumeSeries = this.chart.addSeries(HistogramSeries, {
            color: '#26a69a',
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume',
        });

        this.chart.priceScale('volume').applyOptions({
            scaleMargins: { top: 0.8, bottom: 0 },
        });

        // クロスヘアの移動に連動
        this.chart.subscribeCrosshairMove(param => {
            this.updateLegend(param);
        });
    }

    /**
     * 株価データをセットします。
     */
    setData(rawData: PriceData[]): void {
        if (!this.candlestickSeries || !this.volumeSeries || !this.sma5Series || !this.sma25Series || !this.sma75Series) return;

        const seenDates = new Set<string>();
        const priceData: CandlestickData[] = [];
        const volumeData: HistogramData[] = [];

        // データを時間順にソート (lightweight-charts の要件)
        const sortedRaw = [...rawData].sort((a, b) => {
            const dateA = typeof a.date === 'number' ? a.date : parseInt(String(a.date).replace(/-/g, ''));
            const dateB = typeof b.date === 'number' ? b.date : parseInt(String(b.date).replace(/-/g, ''));
            return dateA - dateB;
        });

        sortedRaw.forEach(d => {
            let timeStr = '';
            const dt = d.date;
            if (typeof dt === 'number') {
                const s = dt.toString();
                if (s.length === 8) {
                    // yyyymmdd
                    timeStr = `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}`;
                } else {
                    // timestamp (ms)
                    const date = new Date(dt);
                    if (!isNaN(date.getTime())) {
                        timeStr = date.toISOString().split('T')[0];
                    }
                }
            } else if (typeof dt === 'string') {
                if (dt.includes('-')) {
                    timeStr = dt.split('T')[0];
                } else if (dt.length === 8) {
                    // yyyymmdd
                    timeStr = `${dt.substring(0, 4)}-${dt.substring(4, 6)}-${dt.substring(6, 8)}`;
                } else {
                    // possibly numeric string timestamp
                    const date = new Date(parseInt(dt));
                    if (!isNaN(date.getTime())) {
                        timeStr = date.toISOString().split('T')[0];
                    }
                }
            }
            if (timeStr && !seenDates.has(timeStr)) {
                seenDates.add(timeStr);
                const open = parseFloat(String(d.open));
                const high = parseFloat(String(d.high));
                const low = parseFloat(String(d.low));
                const close = parseFloat(String(d.close));
                const volume = parseFloat(String(d.volume || 0));

                if (!isNaN(open) && !isNaN(high) && !isNaN(low) && !isNaN(close)) {
                    priceData.push({ time: timeStr, open, high, low, close });
                    volumeData.push({
                        time: timeStr,
                        value: volume,
                        color: close >= open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'
                    });
                }
            }
        });

        // 内部保持用のデータを更新
        this.priceDataPoints = priceData;
        this.volumeDataPoints = volumeData;
        this.sma5DataPoints = this.calculateSMA(priceData, 5);
        this.sma25DataPoints = this.calculateSMA(priceData, 25);
        this.sma75DataPoints = this.calculateSMA(priceData, 75);

        // シリーズにデータをセット
        this.candlestickSeries.setData(this.priceDataPoints);
        this.volumeSeries.setData(this.volumeDataPoints);
        this.sma5Series.setData(this.sma5DataPoints);
        this.sma25Series.setData(this.sma25DataPoints);
        this.sma75Series.setData(this.sma75DataPoints);

        // 初期状態で最新の凡例を表示
        this.updateLegend({});

        if (this.chart) {
            this.chart.timeScale().fitContent();
        }
    }

    /**
     * SMA (単純移動平均) を計算
     */
    private calculateSMA(data: CandlestickData[], period: number): LineData[] {
        const sma: LineData[] = [];
        for (let i = period - 1; i < data.length; i++) {
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += data[i - j].close;
            }
            sma.push({ time: data[i].time, value: sum / period });
        }
        return sma;
    }

    /**
     * 凡例を更新
     */
    private updateLegend(param: MouseEventParams | {}): void {
        if (!this.legendElement) return;

        let dataCS: any = null;
        let dataV: any = null;
        let data5: any = null;
        let data25: any = null;
        let data75: any = null;

        const p = param as MouseEventParams;

        // クロスヘアが有効な場合はその地点のデータを取得
        if (p.time && p.seriesData) {
            if (this.candlestickSeries) dataCS = p.seriesData.get(this.candlestickSeries);
            if (this.volumeSeries) dataV = p.seriesData.get(this.volumeSeries);
            if (this.sma5Series) data5 = p.seriesData.get(this.sma5Series);
            if (this.sma25Series) data25 = p.seriesData.get(this.sma25Series);
            if (this.sma75Series) data75 = p.seriesData.get(this.sma75Series);

            // 内部データからの検索 (フォールバック)
            if (!dataCS && this.priceDataPoints.length > 0) {
                const timeStr = typeof p.time === 'string' ? p.time :
                    (p.time as any).year ? `${(p.time as any).year}-${String((p.time as any).month).padStart(2, '0')}-${String((p.time as any).day).padStart(2, '0')}` : '';
                if (timeStr) {
                    dataCS = this.priceDataPoints.find(d => d.time === timeStr);
                    dataV = this.volumeDataPoints.find(d => d.time === timeStr);
                    data5 = this.sma5DataPoints.find(d => d.time === timeStr);
                    data25 = this.sma25DataPoints.find(d => d.time === timeStr);
                    data75 = this.sma75DataPoints.find(d => d.time === timeStr);
                }
            }
        }
        // カーソルがない場合は最新の値を表示
        else if (this.priceDataPoints.length > 0) {
            dataCS = this.priceDataPoints[this.priceDataPoints.length - 1];
            dataV = this.volumeDataPoints[this.volumeDataPoints.length - 1];
            data5 = this.sma5DataPoints[this.sma5DataPoints.length - 1];
            data25 = this.sma25DataPoints[this.sma25DataPoints.length - 1];
            data75 = this.sma75DataPoints[this.sma75DataPoints.length - 1];
        }

        // 最小化状態のレンダリング
        if (this.isMinimized) {
            this.renderMinimized();
            return;
        }

        // フォーマット処理
        const formatValue = (v: any) => (v && typeof v.value === 'number') ? v.value.toFixed(2) : '-';
        const formatPrice = (v: any) => (v !== undefined && v !== null) ? v.toFixed(2) : '-';

        const o = formatPrice(dataCS?.open);
        const h = formatPrice(dataCS?.high);
        const l = formatPrice(dataCS?.low);
        const c = formatPrice(dataCS?.close);
        const v = dataV ? dataV.value.toLocaleString() : '-';
        const priceColor = (dataCS && dataCS.close >= dataCS.open) ? '#26a69a' : '#ef5350';

        this.legendElement.innerHTML = `
            <div class="legend-ohlc" style="pointer-events: none">
                <span class="legend-toggle-btn" style="pointer-events: auto" onclick="this.dispatchEvent(new CustomEvent('toggle-legend', {bubbles: true}))">Hide</span>
                <span style="color: ${priceColor}">O: ${o}</span>
                <span style="color: ${priceColor}">H: ${h}</span>
                <span style="color: ${priceColor}">L: ${l}</span>
                <span style="color: ${priceColor}">C: ${c}</span>
                <span style="color: #787b86">V: ${v}</span>
            </div>
            <div class="legend-item" style="color: #2962FF">SMA 5: ${formatValue(data5)}</div>
            <div class="legend-item" style="color: #FF6D00">SMA 25: ${formatValue(data25)}</div>
            <div class="legend-item" style="color: #F44336">SMA 75: ${formatValue(data75)}</div>
        `;

        this.attachToggleListener();
    }

    private renderMinimized(): void {
        if (!this.legendElement) return;
        this.legendElement.innerHTML = `
            <div style="display: flex; align-items: center; pointer-events: none">
                <span class="legend-toggle-btn" style="pointer-events: auto" onclick="this.dispatchEvent(new CustomEvent('toggle-legend', {bubbles: true}))">Show</span>
                <span style="font-size: 10px;">📈 SMA 5/25/75</span>
            </div>
        `;
        this.attachToggleListener();
    }

    private attachToggleListener(): void {
        if (!this.legendElement || this.legendElement.hasAttribute('data-listener-attached')) return;
        this.legendElement.setAttribute('data-listener-attached', 'true');
        this.legendElement.addEventListener('toggle-legend', (e) => {
            e.stopPropagation();
            this.isMinimized = !this.isMinimized;
            this.updateLegend({});
        });
    }

    /**
     * チャートのリサイズ
     */
    resize(width: number, height: number): void {
        if (this.chart) {
            this.chart.resize(width, height);
        }
    }

    /**
     * 破棄処理
     */
    destroy(): void {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        if (this.legendElement && this.legendElement.parentElement) {
            this.legendElement.parentElement.removeChild(this.legendElement);
            this.legendElement = null;
        }
        if (this.chart) {
            this.chart.remove();
            this.chart = null;
        }
        this.candlestickSeries = null;
        this.volumeSeries = null;
        this.sma5Series = null;
        this.sma25Series = null;
        this.sma75Series = null;
        this.priceDataPoints = [];
        this.volumeDataPoints = [];
        this.sma5DataPoints = [];
        this.sma25DataPoints = [];
        this.sma75DataPoints = [];
    }
}

// シングルトンインスタンス
export const ChartInstance = new StockChart();
