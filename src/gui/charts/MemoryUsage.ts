import type { ChartData, ChartDataset, ScatterDataPoint } from 'chart.js';
import { Chart } from 'chart.js';
import type GUI from 'lil-gui';
import type { WebGLInfo } from 'three';
import type Instance from '../../core/Instance';
import { GlobalRenderTargetPool } from '../../renderer/RenderTargetPool';
import ChartPanel, { pushTrim } from './ChartPanel';

const MAX_DATA_POINTS = 20;

class MemoryUsage extends ChartPanel {
    render: typeof WebGLInfo.prototype.render;
    memory: typeof WebGLInfo.prototype.memory;
    labels: string[];
    textures: ChartDataset<'line', ScatterDataPoint[]>;
    geometries: ChartDataset<'line', ScatterDataPoint[]>;
    renderTargets: ChartDataset<'line', ScatterDataPoint[]>;
    programs: ChartDataset<'line', ScatterDataPoint[]>;
    data: ChartData<'line', ScatterDataPoint[], string>;
    private _onRenderTargetPoolCleanup: () => void;
    chart: Chart;

    /**
     * Creates an instance of MemoryUsage.
     *
     * @param parentGui - The parent GUI.
     * @param instance - The giro3D instance.
     */
    constructor(parentGui: GUI, instance: Instance) {
        super(parentGui, instance, 'Memory');

        this.render = instance.renderer.info.render;
        this.memory = instance.renderer.info.memory;
        this._onRenderTargetPoolCleanup = this.updateValues.bind(this);
        GlobalRenderTargetPool.addEventListener('cleanup', this._onRenderTargetPoolCleanup);
        this.labels = [];

        this.textures = {
            label: 'Textures',
            data: [],
            fill: false,
            borderWidth: 2,
            pointRadius: 0,
            backgroundColor: '#FF000030',
            borderColor: '#FF000080',
            yAxisID: 'y',
        };

        this.renderTargets = {
            label: 'RenderTargetPool',
            data: [],
            fill: false,
            borderWidth: 2,
            pointRadius: 0,
            backgroundColor: '#00FF0030',
            borderColor: '#00FF0080',
            yAxisID: 'y',
        };

        this.programs = {
            label: 'WebGLProgram',
            data: [],
            fill: false,
            borderWidth: 2,
            pointRadius: 0,
            backgroundColor: '#F0F25030',
            borderColor: '#F0F250FF',
            yAxisID: 'y',
        };

        this.geometries = {
            label: 'Geometries',
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
            datasets: [this.textures, this.geometries, this.renderTargets, this.programs],
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
                        text: 'three.js object count',
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
                            precision: 0,
                            color: '#FF5000',
                        },
                    },
                    y1: {
                        position: 'right',
                        ticks: {
                            precision: 0,
                            color: '#0050FF',
                        },
                    },
                },
            },
        });
    }

    dispose(): void {
        GlobalRenderTargetPool.removeEventListener('cleanup', this._onRenderTargetPoolCleanup);
    }

    updateValues() {
        if (this.isClosed()) {
            return;
        }

        const frame = this.render.frame;
        pushTrim(this.textures.data, { x: frame, y: this.memory.textures }, MAX_DATA_POINTS);
        pushTrim(this.geometries.data, { x: frame, y: this.memory.geometries }, MAX_DATA_POINTS);
        pushTrim(
            this.programs.data,
            { x: frame, y: this.instance.renderer.info.programs?.length ?? 0 },
            MAX_DATA_POINTS,
        );
        pushTrim(
            this.renderTargets.data,
            { x: frame, y: GlobalRenderTargetPool.count },
            MAX_DATA_POINTS,
        );
        pushTrim(this.labels, '', MAX_DATA_POINTS);

        this.chart.update();
    }
}

export default MemoryUsage;
