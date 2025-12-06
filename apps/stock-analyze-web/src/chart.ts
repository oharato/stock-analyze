import ApexCharts from 'apexcharts';
import type { ChartData } from './api';

export function createChart(element: HTMLElement, chartData: ChartData): ApexCharts {
    const isCandle = chartData.type === 'candlestick';

    const options: ApexCharts.ApexOptions = {
        series: chartData.series,
        chart: {
            type: chartData.type as any, // 'candlestick', 'line', 'bar', etc.
            height: 350,
            foreColor: '#9ca3af', // gray-400
            background: 'transparent',
            toolbar: {
                show: true,
                tools: {
                    download: false,
                    selection: true,
                    zoom: true,
                    zoomin: true,
                    zoomout: true,
                    pan: true,
                    reset: true
                }
            }
        },
        grid: {
            borderColor: '#374151', // gray-700
            strokeDashArray: 4,
        },
        plotOptions: {
            candlestick: {
                colors: {
                    upward: '#10b981',   // green-500
                    downward: '#ef4444'  // red-500
                }
            }
        },
        title: {
            text: isCandle ? 'Chart' : undefined,
            align: 'left'
        },
        xaxis: {
            type: 'datetime',
            tooltip: {
                enabled: true
            }
        },
        yaxis: {
            tooltip: {
                enabled: true
            }
        },
        theme: {
            mode: 'dark'
        }
    };

    const chart = new ApexCharts(element, options);
    chart.render();
    return chart;
}

export function updateChart(chart: ApexCharts, chartData: ChartData): void {
    chart.updateSeries(chartData.series);
}

export function destroyChart(chart: ApexCharts): void {
    chart.destroy();
}
