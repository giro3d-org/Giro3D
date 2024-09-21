import type GUI from 'lil-gui';
import type Instance from '../core/Instance';
import type ColorMap from '../core/layer/ColorMap';
import Panel from './Panel';

type Mode = 'Elevation' | 'Slope' | 'Aspect';

const modes: Mode[] = ['Elevation', 'Slope', 'Aspect'];

/**
 * Inspector for a {@link ColorMap}.
 */
class ColorMapInspector extends Panel {
    mode: Mode = 'Elevation';

    /**
     * @param gui - The GUI.
     * @param instance - The Giro3D instance.
     * @param layer - The color map owner.
     * @param colorMap - The color map to inspect.
     */
    constructor(gui: GUI, instance: Instance, colorMap: ColorMap | null, notify: () => void) {
        super(gui, instance, 'Color map');

        if (colorMap != null) {
            this.mode = modes[colorMap.mode - 1];

            this.addController(colorMap, 'active').name('Enabled').onChange(notify);

            this.addController(this, 'mode', modes)
                .name('Mode')
                .onChange(v => {
                    colorMap.mode = modes.indexOf(v) + 1;
                    notify();
                });

            this.addController(colorMap, 'min')
                .name('Lower bound')
                .min(-8000)
                .max(8000)
                .onChange(notify);

            this.addController(colorMap, 'max')
                .name('Upper bound')
                .min(-8000)
                .max(8000)
                .onChange(notify);
        }
    }
}

export default ColorMapInspector;
