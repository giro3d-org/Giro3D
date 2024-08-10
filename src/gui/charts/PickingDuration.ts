import type { ChartData, ScatterDataPoint } from 'chart.js';
import { Chart } from 'chart.js';
import type GUI from 'lil-gui';
import type { WebGLInfo } from 'three';
import type Instance from '../../core/Instance';
import ChartPanel, { pushTrim } from './ChartPanel';

const MAX_DATA_POINTS = 30;

class PickingDuration extends ChartPanel {
    render: typeof WebGLInfo.prototype.render;
    data: ChartData<'bar', ScatterDataPoint[], string>;
    chart: Chart;
    updateStart: number;
    renderStart: number;
    frame: number;

    constructor(parentGui: GUI, instance: Instance) {
        super(parentGui, instance, 'Picking duration (µs)');

        this.render = instance.renderer.info.render;

        const pickingDuration = {
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
            datasets: [pickingDuration],
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
                        text: 'Picking duration (µs)',
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
        this.frame = 0;

        instance.addEventListener('picking-end', ({ elapsed }) => {
            pushTrim(
                pickingDuration.data,
                { x: this.frame++, y: Math.round(elapsed * 1_000_000) },
                MAX_DATA_POINTS,
            );

            this.updateValues();
        });
    }

    updateValues() {
        if (this.isClosed()) {
            return;
        }

        this.chart.update();
    }
}

export default PickingDuration;
