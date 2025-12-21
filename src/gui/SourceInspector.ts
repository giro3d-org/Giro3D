/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type GUI from 'lil-gui';
import type TileSource from 'ol/source/Tile.js';

import UrlTile from 'ol/source/UrlTile.js';

import type Instance from '../core/Instance';
import type ImageSource from '../sources/ImageSource';

import CoordinateSystem from '../core/geographic/CoordinateSystem';
import * as MemoryUsage from '../core/MemoryUsage';
import { isGeoTIFFSource } from '../sources/GeoTIFFSource';
import { isTiledImageSource } from '../sources/TiledImageSource';
import { isVectorSource } from '../sources/VectorSource';
import VideoSource from '../sources/VideoSource';
import { isWmsSource } from '../sources/WmsSource';
import Panel from './Panel';

/**
 * Inspector for a source.
 *
 */
class SourceInspector extends Panel {
    public source: ImageSource;
    public url?: string;
    public cogChannels = '[0]';
    public subtype?: string;
    public resolutions?: number;
    public cpuMemoryUsage = 'unknown';
    public gpuMemoryUsage = 'unknown';
    public loadedPercent = '';

    private get crs(): CoordinateSystem {
        try {
            return this.source.getCrs() ?? CoordinateSystem.unknown;
        } catch {
            return CoordinateSystem.unknown;
        }
    }

    /**
     * @param gui - The GUI.
     * @param instance - The Giro3D instance.
     * @param source - The source.
     */
    public constructor(gui: GUI, instance: Instance, source: ImageSource) {
        super(gui, instance, 'Source');

        this.source = source;

        this.addControllers(source);
    }

    private addControllers(source: ImageSource): void {
        this.addController(source, 'type').name('Type');
        this.addController(source, 'colorSpace').name('Color space');
        this.addController(source, 'datatype').name('Data type');
        this.addController(source, 'flipY').name('Flip Y');
        this.addController(source, 'synchronous').name('Synchronous');
        this.addController(this.crs, 'id').name('CRS');
        this.addController(source, 'update').name('Update');

        this.addController(this, 'cpuMemoryUsage').name('Memory usage (CPU)');
        this.addController(this, 'gpuMemoryUsage').name('Memory usage (GPU)');

        if (isGeoTIFFSource(source)) {
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
        } else if (isTiledImageSource(source)) {
            this.addController(this, 'loadedPercent').name('Loaded/Requested');
            this.processOpenLayersSource(source.source);
        } else if (isVectorSource(source)) {
            this.addController(source, 'featureCount').name('Feature count');
        } else if (source instanceof VideoSource) {
            const video = source.video;
            if (video) {
                this.populateVideoSource(source);
            } else {
                source.addEventListener('loaded', () => this.populateVideoSource(source));
            }
        } else if (isWmsSource(source)) {
            this.addController(this, 'loadedPercent').name('Loaded/Requested');
        }
    }

    private populateVideoSource(source: VideoSource): void {
        const video = source.video;
        if (video) {
            this.addController(video, 'duration');
            this.addController(video, 'play');
            this.addController(video, 'pause');
        }
    }

    public override updateValues(): void {
        const ctx: MemoryUsage.GetMemoryUsageContext = {
            renderer: this.instance.renderer,
            objects: new Map(),
        };
        this.source.getMemoryUsage(ctx);
        const memUsage = MemoryUsage.aggregateMemoryUsage(ctx);
        this.cpuMemoryUsage = MemoryUsage.format(memUsage.cpuMemory);
        this.gpuMemoryUsage = MemoryUsage.format(memUsage.gpuMemory);

        if (isTiledImageSource(this.source)) {
            const loaded = this.source.info.loadedTiles;
            const requested = this.source.info.requestedTiles;
            const ratio = Math.ceil(100 * (loaded / requested));
            this.loadedPercent = `${loaded}/${requested} (${ratio}%)`;
        } else if (isWmsSource(this.source)) {
            const loaded = this.source.info.loadedImages;
            const requested = this.source.info.requestedImages;
            const ratio = Math.ceil(100 * (loaded / requested));
            this.loadedPercent = `${loaded}/${requested} (${ratio}%)`;
        }

        this._controllers.forEach(c => c.updateDisplay());
    }

    public processOpenLayersSource(source: TileSource): void {
        // default value in case we can't process the constructor name
        this.subtype = 'Unknown';

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
