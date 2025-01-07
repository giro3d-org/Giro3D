import type GUI from 'lil-gui';
import ColorMap from '../core/ColorMap';
import type Instance from '../core/Instance';
import Panel from './Panel';

type Mode = 'Elevation' | 'Slope' | 'Aspect';

const modes: Mode[] = ['Elevation', 'Slope', 'Aspect'];

const DEFAULT_COLORMAP = new ColorMap({ colors: [], min: 0, max: 1 });

/**
 * Inspector for a {@link ColorMap}.
 */
class ColorMapInspector extends Panel {
    private readonly _notify: () => void;
    private readonly _colorMapFn: () => ColorMap | null;

    get colorMap() {
        return this._colorMapFn() ?? DEFAULT_COLORMAP;
    }

    get mode() {
        return modes[this.colorMap.mode - 1];
    }

    set mode(v: Mode) {
        this.colorMap.mode = modes.indexOf(v) + 1;
    }

    /**
     * @param gui - The GUI.
     * @param instance - The Giro3D instance.
     * @param layer - The color map owner.
     * @param colorMapFn - The color map to inspect.
     */
    constructor(
        gui: GUI,
        instance: Instance,
        colorMapFn: () => ColorMap | null,
        notify: () => void,
    ) {
        super(gui, instance, 'Color map');
        this._notify = notify;
        this._colorMapFn = colorMapFn;

        this.addController(this.colorMap, 'active').name('Enabled').onChange(notify);

        this.addController(this, 'mode', modes).name('Mode').onChange(notify);

        this.addController(this.colorMap, 'min')
            .name('Lower bound')
            .min(-8000)
            .max(8000)
            .onChange(notify);
        this.addController(this.colorMap, 'max')
            .name('Upper bound')
            .min(-8000)
            .max(8000)
            .onChange(notify);
    }

    updateControllers(): void {
        const disabled = this._colorMapFn() == null;
        this._controllers.forEach(c => c.disable(disabled));
        super.updateControllers();
    }
}

export default ColorMapInspector;
