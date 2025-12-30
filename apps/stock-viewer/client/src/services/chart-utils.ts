import { CandlestickData, LineData, HistogramData } from 'lightweight-charts';
import { PriceData } from '../types';

/**
 * Rawデータをチャート用データに変換
 */
export function parsePriceData(rawData: PriceData[]): {
    priceData: CandlestickData[];
    volumeData: HistogramData[];
} {
    const seenDates = new Set<string>();
    const priceData: CandlestickData[] = [];
    const volumeData: HistogramData[] = [];

    // データを時間順にソート
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

    return { priceData, volumeData };
}

/**
 * SMA (単純移動平均) を計算
 */
export function calculateSMA(data: CandlestickData[], period: number): LineData[] {
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
