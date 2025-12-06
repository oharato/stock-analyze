/**
 * Chart Component
 * 
 * Chart.js を使用してデータを可視化します
 */

import {
    Chart,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    LineController,
    BarController,
    PieController,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';
import type { ChartData } from './api';

// Chart.js のコンポーネントを登録
Chart.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    LineController,
    BarController,
    PieController,
    Title,
    Tooltip,
    Legend,
    Filler
);


/**
 * チャートを作成
 */
export function createChart(canvas: HTMLCanvasElement, chartData: ChartData): Chart {
    return new Chart(canvas, {
        type: chartData.type,
        data: {
            labels: chartData.labels,
            datasets: chartData.datasets.map(dataset => ({
                ...dataset,
                fill: chartData.type === 'line',
                tension: 0.4,
            })),
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: 'hsl(0, 0%, 75%)',
                        font: {
                            family: 'Inter, sans-serif',
                        },
                    },
                },
                tooltip: {
                    backgroundColor: 'hsla(240, 15%, 12%, 0.95)',
                    titleColor: 'hsl(0, 0%, 98%)',
                    bodyColor: 'hsl(0, 0%, 75%)',
                    borderColor: 'hsl(250, 100%, 65%)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                },
            },
            scales: chartData.type !== 'pie' ? {
                x: {
                    grid: {
                        color: 'hsla(0, 0%, 100%, 0.05)',
                    },
                    ticks: {
                        color: 'hsl(0, 0%, 75%)',
                    },
                },
                y: {
                    grid: {
                        color: 'hsla(0, 0%, 100%, 0.05)',
                    },
                    ticks: {
                        color: 'hsl(0, 0%, 75%)',
                    },
                },
            } : undefined,
        },
    });
}

/**
 * チャートを更新
 */
export function updateChart(chart: Chart, chartData: ChartData): void {
    chart.data.labels = chartData.labels;
    chart.data.datasets = chartData.datasets.map(dataset => ({
        ...dataset,
        fill: chartData.type === 'line',
        tension: 0.4,
    }));
    chart.update();
}

/**
 * チャートを破棄
 */
export function destroyChart(chart: Chart): void {
    chart.destroy();
}
