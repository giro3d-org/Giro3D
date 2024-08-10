import type { ChartData, ScatterDataPoint } from 'chart.js';
import { Chart } from 'chart.js';
import type GUI from 'lil-gui';
import type { WebGLInfo } from 'three';
import type Instance from '../../core/Instance';
import ChartPanel, { pushTrim } from './ChartPanel';

const MAX_DATA_POINTS = 30;

class FrameDuration extends ChartPanel {
    render: typeof WebGLInfo.prototype.render;
    data: ChartData<'bar', ScatterDataPoint[], string>;
    chart: Chart;
    updateStart: number;
    renderStart: number;

    constructor(parentGui: GUI, instance: Instance) {
        super(parentGui, instance, 'Frame duration (ms)');

        this.render = instance.renderer.info.render;

        const totalFrameLength = {
            label: 'Total',
            tension: 0.2,
            data: [] as ScatterDataPoint[],
            fill: false,
            borderWidth: 2,
            pointRadius: 0,
            backgroundColor: '#FF000030',
            borderColor: '#FF000080',
        };

        const renderTime = {
            label: 'Render',
            tension: 0.2,
            data: [] as ScatterDataPoint[],
            fill: false,
            borderWidth: 2,
            pointRadius: 0,
            backgroundColor: '#0050FF30',
            borderColor: '#0050FFFF',
        };

        const labels: string[] = [];

        this.data = {
            labels,
            datasets: [renderTime, totalFrameLength],
        };

        this.chart = new Chart(this.ctx, {
            type: 'bar',
            data: this.data,
            options: {
                animation: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                    },
                    title: {
                        display: true,
                        text: 'Frame duration (ms)',
                    },
                },
                scales: {
                    x: {
                        stacked: true,
                        display: 'auto',
                        bounds: 'data',
                        type: 'linear',
                    },
                    y: {
                        stacked: true,
                        bounds: 'data',
                        type: 'linear',
                        suggestedMin: 0,
                        ticks: {
                            precision: 0,
                        },
                    },
                },
            },
        });

        this.updateStart = -1;
        this.renderStart = -1;

        instance.addEventListener('update-start', () => {
            this.updateStart = performance.now();
        });

        instance.addEventListener('update-end', e => {
            const now = performance.now();
            pushTrim(
                totalFrameLength.data,
                { x: e.frame, y: now - this.updateStart },
                MAX_DATA_POINTS,
            );

            pushTrim(labels, '', MAX_DATA_POINTS);
        });

        instance.addEventListener('before-render', () => {
            this.renderStart = performance.now();
        });

        instance.addEventListener('after-render', e => {
            const now = performance.now();
            pushTrim(renderTime.data, { x: e.frame, y: now - this.renderStart }, MAX_DATA_POINTS);
        });
    }

    updateValues() {
        if (this.isClosed()) {
            return;
        }

        this.chart.update();
    }
}

export default FrameDuration;
