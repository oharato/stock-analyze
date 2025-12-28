import { createChart, CandlestickSeries, CandlestickData, IChartApi, ISeriesApi, HistogramSeries, HistogramData, LineSeries, LineData } from 'lightweight-charts';
import { PriceData } from '../types';

/**
 * チャート制御クラス
 * Lightweight Charts を使用して株価チャートを描画します。
 */
export class StockChart {
    private chart: IChartApi | null = null;
    private candlestickSeries: ISeriesApi<'Candlestick'> | null = null;
    private volumeSeries: ISeriesApi<'Histogram'> | null = null;
    private sma5Series: ISeriesApi<'Line'> | null = null;
    private sma25Series: ISeriesApi<'Line'> | null = null;
    private sma75Series: ISeriesApi<'Line'> | null = null;

    /**
     * チャートを初期化します。
     */
    init(container: HTMLElement): void {
        if (this.chart) {
            this.destroy();
        }

        this.chart = createChart(container, {
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

        // ローソク足シリーズ
        this.candlestickSeries = this.chart.addSeries(CandlestickSeries, {
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
        });

        // 移動平均線シリーズ
        this.sma5Series = this.chart.addSeries(LineSeries, {
            color: '#2962FF',
            lineWidth: 1,
            title: 'SMA 5',
        });

        this.sma25Series = this.chart.addSeries(LineSeries, {
            color: '#FF6D00',
            lineWidth: 1,
            title: 'SMA 25',
        });

        this.sma75Series = this.chart.addSeries(LineSeries, {
            color: '#F44336',
            lineWidth: 1,
            title: 'SMA 75',
        });

        // 出来高シリーズ（価格スケールを分けて下に表示）
        this.volumeSeries = this.chart.addSeries(HistogramSeries, {
            color: '#26a69a',
            priceFormat: {
                type: 'volume',
            },
            priceScaleId: 'volume', // 独自のスケール
        });

        this.chart.priceScale('volume').applyOptions({
            scaleMargins: {
                top: 0.8, // 上に80%の余白（下に表示）
                bottom: 0,
            },
        });
    }

    /**
     * 単純移動平均 (SMA) を計算します。
     */
    private calculateSMA(data: CandlestickData[], period: number): LineData[] {
        const smaData: LineData[] = [];
        for (let i = period - 1; i < data.length; i++) {
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += data[i - j].close;
            }
            smaData.push({
                time: data[i].time,
                value: sum / period,
            });
        }
        return smaData;
    }

    /**
     * 株価データをセットします。
     */
    setData(rawData: PriceData[]): void {
        if (!this.candlestickSeries || !this.volumeSeries || !this.sma5Series || !this.sma25Series || !this.sma75Series) return;

        const seenDates = new Set<string>();
        const priceData: CandlestickData[] = [];
        const volumeData: HistogramData[] = [];

        // データを古い順に処理
        [...rawData].reverse().forEach(d => {
            let timeStr = '';
            if (typeof d.date === 'number') {
                const s = d.date.toString();
                timeStr = `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}`;
            } else if (typeof d.date === 'string') {
                if (d.date.includes('-')) {
                    timeStr = d.date.split('T')[0];
                } else if (d.date.length === 8) {
                    timeStr = `${d.date.substring(0, 4)}-${d.date.substring(4, 6)}-${d.date.substring(6, 8)}`;
                } else {
                    const date = new Date(parseInt(d.date));
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

        // シリーズにデータをセット
        this.candlestickSeries.setData(priceData);
        this.volumeSeries.setData(volumeData);

        // SMAの計算とセット
        this.sma5Series.setData(this.calculateSMA(priceData, 5));
        this.sma25Series.setData(this.calculateSMA(priceData, 25));
        this.sma75Series.setData(this.calculateSMA(priceData, 75));

        if (this.chart) {
            this.chart.timeScale().fitContent();
        }
    }

    /**
     * チャートをリサイズします。
     */
    resize(width: number, height: number): void {
        if (this.chart) {
            this.chart.resize(width, height);
        }
    }

    /**
     * チャートを破棄します。
     */
    destroy(): void {
        if (this.chart) {
            this.chart.remove();
            this.chart = null;
            this.candlestickSeries = null;
            this.volumeSeries = null;
        }
    }
}

// 後方互換性のためのシングルトンインスタンス
export const Chart = new StockChart();
