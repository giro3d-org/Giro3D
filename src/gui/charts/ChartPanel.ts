import {
    BarController,
    BarElement,
    Chart,
    Filler,
    Legend,
    LinearScale,
    LineController,
    LineElement,
    PointElement,
    Title,
} from 'chart.js';
import type GUI from 'lil-gui';
import type Instance from '../../core/Instance';
import Panel from '../Panel';

/**
 * Pushes the value in the array, removing old values in array length exceeds MAX_DATA_POINTS.
 *
 * @param array - The array
 * @param value - The value
 * @param limit - The limit of the array size, before trimming.
 */
export function pushTrim<T>(array: Array<T>, value: T, limit: number) {
    if (array.length > limit) {
        array.shift();
    }
    array.push(value);
}

/**
 * Base class for all chart panels.
 */
abstract class ChartPanel extends Panel {
    ctx: HTMLCanvasElement;

    constructor(parentGui: GUI, instance: Instance, name: string) {
        super(parentGui, instance, name);

        Chart.register(
            LinearScale,
            LineController,
            PointElement,
            LineElement,
            BarElement,
            BarController,
            Title,
            Legend,
            Filler,
        );

        this.ctx = document.createElement('canvas');

        const children = this.gui.domElement.getElementsByClassName('children');
        children[0].appendChild(this.ctx);
    }
}

export default ChartPanel;
