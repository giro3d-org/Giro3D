import type { ChartData, ChartDataset, ScatterDataPoint } from 'chart.js';
import { Chart } from 'chart.js';
import type GUI from 'lil-gui';
import type Instance from '../../core/Instance';
import type RequestQueue from '../../core/RequestQueue';
import { DefaultQueue } from '../../core/RequestQueue';
import ChartPanel, { pushTrim } from './ChartPanel';

const MAX_DATA_POINTS = 20;

class RequestQueueChart extends ChartPanel {
    labels: string[];
    queue: RequestQueue;
    currentRequests: ChartDataset<'line', ScatterDataPoint[]>;
    pendingRequests: ChartDataset<'line', ScatterDataPoint[]>;
    data: ChartData<'line', ScatterDataPoint[], string>;
    chart: Chart;

    /**
     * Creates an instance of RequestQueueChart.
     *
     * @param parentGui - The parent GUI.
     * @param instance - The giro3D instance.
     */
    constructor(parentGui: GUI, instance: Instance) {
        super(parentGui, instance, 'Request queue');

        this.labels = [];
        this.queue = DefaultQueue;

        this.currentRequests = {
            label: 'Executing',
            data: [],
            fill: false,
            borderWidth: 2,
            pointRadius: 0,
            backgroundColor: '#FF000030',
            borderColor: '#FF000080',
            yAxisID: 'y',
        };

        this.pendingRequests = {
            label: 'Pending',
            data: [],
            fill: false,
            borderWidth: 2,
            pointRadius: 0,
            backgroundColor: '#0050FF30',
            borderColor: '#0050FFFF',
            yAxisID: 'y1',
        };

        this.data = {
            labels: this.labels,
            datasets: [this.currentRequests, this.pendingRequests],
        };

        this.chart = new Chart(this.ctx, {
            type: 'line',
            data: this.data,
            options: {
                animation: false,
                parsing: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                    },
                    title: {
                        display: true,
                        text: 'Requests queue',
                    },
                },
                scales: {
                    x: {
                        display: false,
                        bounds: 'data',
                        type: 'linear',
                    },
                    y: {
                        bounds: 'data',
                        type: 'linear',
                        suggestedMin: 0,
                        position: 'left',
                        ticks: {
                            color: '#FF5000',
                            precision: 0,
                        },
                    },
                    y1: {
                        position: 'right',
                        ticks: {
                            color: '#0050FF',
                            precision: 0,
                        },
                    },
                },
            },
        });
    }

    updateValues() {
        if (this.isClosed()) {
            return;
        }

        const t = performance.now();
        const q = this.queue;

        pushTrim(this.currentRequests.data, { x: t, y: q.concurrentRequests }, MAX_DATA_POINTS);
        pushTrim(this.pendingRequests.data, { x: t, y: q.pendingRequests }, MAX_DATA_POINTS);
        pushTrim(this.labels, '', MAX_DATA_POINTS);

        this.chart.update();
    }
}

export default RequestQueueChart;
