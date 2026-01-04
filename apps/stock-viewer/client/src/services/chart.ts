import {
    createChart,
    CandlestickSeries,
    IChartApi,
    HistogramSeries,
    LineSeries,
} from 'lightweight-charts';
import { PriceData } from '../types';
import { parsePriceData, calculateSMA } from './chart-utils';
import { LegendManager, LegendSeries, LegendData } from './chart-legend';

/**
 * チャート制御クラス
 * Lightweight Charts を使用して株価チャートを描画します。
 */
export class StockChart {
    private chart: IChartApi | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private legendManager: LegendManager | null = null;

    // シリーズ保持
    private series: LegendSeries = {
        candlestick: null,
        volume: null,
        sma5: null,
        sma25: null,
        sma75: null
    };

    // データ保持
    private dataPoints: LegendData = {
        priceData: [],
        volumeData: [],
        sma5Data: [],
        sma25Data: [],
        sma75Data: []
    };

    private handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Control' && this.chart) {
            this.chart.applyOptions({ handleScale: { mouseWheel: true } });
        }
    };

    private handleKeyUp = (e: KeyboardEvent) => {
        if (e.key === 'Control' && this.chart) {
            this.chart.applyOptions({ handleScale: { mouseWheel: false } });
        }
    };

    /**
     * チャートを初期化します。
     */
    init(container: HTMLElement): void {
        if (this.chart) {
            this.destroy();
        }

        container.innerHTML = '';
        container.style.position = 'relative';

        this.chart = createChart(container, {
            width: container.clientWidth || 400,
            height: container.clientHeight || 200,
            layout: { background: { color: '#131722' }, textColor: '#d1d4dc' },
            grid: {
                vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
                horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
            },
            rightPriceScale: { borderColor: 'rgba(197, 203, 206, 0.8)' },
            timeScale: {
                borderColor: 'rgba(197, 203, 206, 0.8)',
                timeVisible: true,
                secondsVisible: false,
            },
            handleScale: {
                mouseWheel: false, // デフォルトで無効化
            },
        });

        // キーイベントの登録
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);

        // 凡例マネージャの初期化
        this.legendManager = new LegendManager(container);

        // 各シリーズの初期化
        this.series.candlestick = this.chart.addSeries(CandlestickSeries, {
            upColor: '#26a69a', downColor: '#ef5350', borderVisible: false,
            wickUpColor: '#26a69a', wickDownColor: '#ef5350',
        });
        this.series.sma5 = this.chart.addSeries(LineSeries, { color: '#2962FF', lineWidth: 1 });
        this.series.sma25 = this.chart.addSeries(LineSeries, { color: '#FF6D00', lineWidth: 1 });
        this.series.sma75 = this.chart.addSeries(LineSeries, { color: '#F44336', lineWidth: 1 });
        this.series.volume = this.chart.addSeries(HistogramSeries, {
            color: '#26a69a', priceFormat: { type: 'volume' }, priceScaleId: 'volume',
        });

        this.chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

        this.chart.subscribeCrosshairMove(param => {
            this.legendManager?.update(param, this.series, this.dataPoints);
        });

        this.resizeObserver = new ResizeObserver(entries => {
            if (entries.length > 0 && this.chart) {
                const { width, height } = entries[0].contentRect;
                this.chart.resize(width, height);
            }
        });
        this.resizeObserver.observe(container);
    }

    /**
     * 株価データをセットします。
     */
    setData(rawData: PriceData[]): void {
        const { priceData, volumeData } = parsePriceData(rawData);

        this.dataPoints = {
            priceData,
            volumeData,
            sma5Data: calculateSMA(priceData, 5),
            sma25Data: calculateSMA(priceData, 25),
            sma75Data: calculateSMA(priceData, 75)
        };

        if (this.series.candlestick) this.series.candlestick.setData(this.dataPoints.priceData);
        if (this.series.volume) this.series.volume.setData(this.dataPoints.volumeData);
        if (this.series.sma5) this.series.sma5.setData(this.dataPoints.sma5Data);
        if (this.series.sma25) this.series.sma25.setData(this.dataPoints.sma25Data);
        if (this.series.sma75) this.series.sma75.setData(this.dataPoints.sma75Data);

        this.legendManager?.update({}, this.series, this.dataPoints);
        this.chart?.timeScale().fitContent();
    }

    /**
     * 破棄処理
     */
    destroy(): void {
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);

        this.resizeObserver?.disconnect();
        this.legendManager?.destroy();
        this.chart?.remove();

        this.chart = null;
        this.resizeObserver = null;
        this.legendManager = null;
        this.series = { candlestick: null, volume: null, sma5: null, sma25: null, sma75: null };
        this.dataPoints = { priceData: [], volumeData: [], sma5Data: [], sma25Data: [], sma75Data: [] };
    }
}

export const ChartInstance = new StockChart();
