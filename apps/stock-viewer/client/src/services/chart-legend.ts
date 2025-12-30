import { MouseEventParams, CandlestickData, LineData, HistogramData, ISeriesApi } from 'lightweight-charts';

export interface LegendData {
    priceData: CandlestickData[];
    sma5Data: LineData[];
    sma25Data: LineData[];
    sma75Data: LineData[];
    volumeData: HistogramData[];
}

export interface LegendSeries {
    candlestick: ISeriesApi<'Candlestick'> | null;
    volume: ISeriesApi<'Histogram'> | null;
    sma5: ISeriesApi<'Line'> | null;
    sma25: ISeriesApi<'Line'> | null;
    sma75: ISeriesApi<'Line'> | null;
}

/**
 * 凡例管理クラス
 */
export class LegendManager {
    private element: HTMLElement | null = null;
    private isMinimized = false;

    // 最新のデータを保持して自己更新できるようにする
    private lastParam: MouseEventParams | {} = {};
    private lastSeries: LegendSeries | null = null;
    private lastData: LegendData | null = null;

    constructor(container: HTMLElement) {

        this.element = document.createElement('div');
        this.element.className = 'chart-legend';
        this.element.style.pointerEvents = 'auto';
        container.appendChild(this.element);
        this.attachToggleListener();
    }

    /**
     * 凡例を非表示にマウント解除
     */
    destroy(): void {
        if (this.element && this.element.parentElement) {
            this.element.parentElement.removeChild(this.element);
            this.element = null;
        }
    }

    /**
     * 凡例を更新
     */
    update(param: MouseEventParams | {}, series: LegendSeries, data: LegendData): void {
        this.lastParam = param;
        this.lastSeries = series;
        this.lastData = data;

        if (!this.element) return;


        let dataCS: any = null;
        let dataV: any = null;
        let data5: any = null;
        let data25: any = null;
        let data75: any = null;

        const p = param as MouseEventParams;

        // クロスヘアが有効な場合はその地点のデータを取得
        if (p.time && p.seriesData) {
            if (series.candlestick) dataCS = p.seriesData.get(series.candlestick);
            if (series.volume) dataV = p.seriesData.get(series.volume);
            if (series.sma5) data5 = p.seriesData.get(series.sma5);
            if (series.sma25) data25 = p.seriesData.get(series.sma25);
            if (series.sma75) data75 = p.seriesData.get(series.sma75);

            // 内部データからの検索 (フォールバック)
            if (!dataCS && data.priceData.length > 0) {
                const timeStr = this.formatTime(p.time);
                if (timeStr) {
                    dataCS = data.priceData.find(d => d.time === timeStr);
                    dataV = data.volumeData.find(d => d.time === timeStr);
                    data5 = data.sma5Data.find(d => d.time === timeStr);
                    data25 = data.sma25Data.find(d => d.time === timeStr);
                    data75 = data.sma75Data.find(d => d.time === timeStr);
                }
            }
        }
        // カーソルがない場合は最新の値を表示
        else if (data.priceData.length > 0) {
            dataCS = data.priceData[data.priceData.length - 1];
            dataV = data.volumeData[data.volumeData.length - 1];
            data5 = data.sma5Data[data.sma5Data.length - 1];
            data25 = data.sma25Data[data.sma25Data.length - 1];
            data75 = data.sma75Data[data.sma75Data.length - 1];
        }

        if (this.isMinimized) {
            this.renderMinimized();
            return;
        }

        this.renderFull(dataCS, dataV, data5, data25, data75);
    }

    private formatTime(time: any): string {
        if (typeof time === 'string') return time;
        if (time && time.year) {
            return `${time.year}-${String(time.month).padStart(2, '0')}-${String(time.day).padStart(2, '0')}`;
        }
        return '';
    }

    private renderFull(dataCS: any, dataV: any, data5: any, data25: any, data75: any): void {
        const formatValue = (v: any) => (v && typeof v.value === 'number') ? v.value.toFixed(2) : '-';
        const formatPrice = (v: any) => (v !== undefined && v !== null) ? (typeof v === 'number' ? v.toFixed(2) : v) : '-';

        const o = formatPrice(dataCS?.open);
        const h = formatPrice(dataCS?.high);
        const l = formatPrice(dataCS?.low);
        const c = formatPrice(dataCS?.close);
        const v = dataV ? dataV.value.toLocaleString() : '-';
        const priceColor = (dataCS && dataCS.close >= dataCS.open) ? '#26a69a' : '#ef5350';

        this.element!.innerHTML = `
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
    }

    private renderMinimized(): void {
        this.element!.innerHTML = `
            <div style="display: flex; align-items: center; pointer-events: none">
                <span class="legend-toggle-btn" style="pointer-events: auto" onclick="this.dispatchEvent(new CustomEvent('toggle-legend', {bubbles: true}))">Show</span>
                <span style="font-size: 10px;">📈 SMA 5/25/75</span>
            </div>
        `;
    }

    private attachToggleListener(): void {
        if (!this.element) return;
        this.element.addEventListener('toggle-legend', (e) => {
            e.stopPropagation();
            this.isMinimized = !this.isMinimized;
            if (this.lastSeries && this.lastData) {
                this.update(this.lastParam, this.lastSeries, this.lastData);
            }
        });
    }
}

