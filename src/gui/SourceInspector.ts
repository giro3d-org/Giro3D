import type GUI from 'lil-gui';
import type TileSource from 'ol/source/Tile.js';
import UrlTile from 'ol/source/UrlTile.js';
import type Instance from '../core/Instance';
import * as MemoryUsage from '../core/MemoryUsage';
import GeoTIFFSource from '../sources/GeoTIFFSource';
import type ImageSource from '../sources/ImageSource';
import TiledImageSource from '../sources/TiledImageSource';
import VectorSource from '../sources/VectorSource';
import Panel from './Panel';

/**
 * Inspector for a source.
 *
 */
class SourceInspector extends Panel {
    source: ImageSource;
    url?: string;
    cogChannels = '[0]';
    subtype?: string;
    crs?: string;
    resolutions?: number;
    cpuMemoryUsage = 'unknown';
    gpuMemoryUsage = 'unknown';
    loadedPercent = '';

    /**
     * @param gui - The GUI.
     * @param instance - The Giro3D instance.
     * @param source - The source.
     */
    constructor(gui: GUI, instance: Instance, source: ImageSource) {
        super(gui, instance, 'Source');

        this.source = source;

        this.addControllers(source);
    }

    private addControllers(source: ImageSource) {
        const obj = { crs: source.getCrs() ?? 'unknown' };

        this.addController(source, 'type').name('Type');
        this.addController(source, 'colorSpace').name('Color space');
        this.addController(source, 'datatype').name('Data type');
        this.addController(source, 'flipY').name('Flip Y');
        this.addController(source, 'synchronous').name('Synchronous');
        this.addController(obj, 'crs').name('CRS');
        this.addController(source, 'update').name('Update');

        this.addController(this, 'cpuMemoryUsage').name('Memory usage (CPU)');
        this.addController(this, 'gpuMemoryUsage').name('Memory usage (GPU)');

        if (source instanceof GeoTIFFSource) {
            this.url = source.url.toString();
            this.addController(this, 'url').name('URL');
            if (source.channels != null) {
                this.cogChannels = JSON.stringify(source.channels);
                this.addController(this, 'cogChannels')
                    .name('Channel mapping')
                    .onChange(v => {
                        const channels = JSON.parse(v);
                        source.channels = channels;
                        this.instance.notifyChange();
                    });
            }
        } else if (source instanceof TiledImageSource) {
            this.addController(this, 'loadedPercent').name('Loaded/Requested');
            this.processOpenLayersSource(source.source);
        } else if (source instanceof VectorSource) {
            this.addController(source, 'featureCount').name('Feature count');
        }
    }

    updateValues(): void {
        const ctx: MemoryUsage.GetMemoryUsageContext = {
            renderer: this.instance.renderer,
            objects: new Map(),
        };
        this.source.getMemoryUsage(ctx);
        const memUsage = MemoryUsage.aggregateMemoryUsage(ctx);
        this.cpuMemoryUsage = MemoryUsage.format(memUsage.cpuMemory);
        this.gpuMemoryUsage = MemoryUsage.format(memUsage.gpuMemory);

        if (this.source instanceof TiledImageSource) {
            const loaded = this.source.info.loadedTiles;
            const requested = this.source.info.requestedTiles;
            const ratio = Math.ceil(100 * (loaded / requested));
            this.loadedPercent = `${loaded}/${requested} (${ratio}%)`;
        }

        this._controllers.forEach(c => c.updateDisplay());
    }

    processOpenLayersSource(source: TileSource) {
        const proj = source.getProjection();

        // default value in case we can't process the constructor name
        this.subtype = 'Unknown';

        if (proj) {
            this.crs = proj.getCode();
            this.addController(this, 'crs').name('CRS');
        }

        const res = source.getResolutions();
        if (res) {
            this.resolutions = res.length;
            this.addController(this, 'resolutions').name('Zoom levels');
        }

        if (source instanceof UrlTile) {
            const ti = source as UrlTile;
            const urls = ti.getUrls();
            if (urls && urls.length > 0) {
                this.url = urls[0];
            }
            this.addController(this, 'url').name('Main URL');
        }

        if (source.constructor.name) {
            this.subtype = source.constructor.name;
        }
        this.addController(this, 'subtype').name('Inner source');
    }
}

export default SourceInspector;
