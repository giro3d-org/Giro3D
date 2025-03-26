import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem';
import Extent from '@giro3d/giro3d/core/geographic/Extent';
import AggregateImageSource from '@giro3d/giro3d/sources/AggregateImageSource';
import type { GetImageOptions, ImageResponse } from '@giro3d/giro3d/sources/ImageSource';
import ImageSource from '@giro3d/giro3d/sources/ImageSource';
import { describe, expect, it, vitest } from 'vitest';

class SubSource extends ImageSource {
    private readonly _extent: Extent;

    override getCrs() {
        return this._extent.crs;
    }

    override getExtent(): Extent {
        return this._extent;
    }

    override getImages(_options: GetImageOptions): Array<ImageResponse> {
        return [];
    }

    constructor(extent: Extent) {
        super({});

        this._extent = extent;
    }
}

describe('constructor', () => {
    it('should throw if the source array is empty', () => {
        expect(() => new AggregateImageSource({ sources: [] })).toThrow();
    });
});

it('should be transparent', () => {
    const extent1 = new Extent(CoordinateSystem.epsg3857, 0, 10, 0, 10);
    const extent2 = new Extent(CoordinateSystem.epsg3857, 11, 20, 11, 20);

    const source1 = new SubSource(extent1);
    const source2 = new SubSource(extent2);

    const source = new AggregateImageSource({ sources: [source1, source2] });

    expect(source.transparent).toEqual(true);
});

describe('contains', () => {
    it('should return true if any sub-source contains the extent', () => {
        const extent1 = new Extent(CoordinateSystem.epsg3857, 0, 10, 0, 10);
        const extent2 = new Extent(CoordinateSystem.epsg3857, 11, 20, 11, 20);
        const extent3 = new Extent(CoordinateSystem.epsg3857, -10, -1, 11, 20);

        const source1 = new SubSource(extent1);
        const source2 = new SubSource(extent2);

        const source = new AggregateImageSource({ sources: [source1, source2] });

        expect(source.contains(extent1)).toEqual(true);
        expect(source.contains(extent2)).toEqual(true);
        expect(source.contains(Extent.unionMany(extent1, extent2)!)).toEqual(true);

        expect(source.contains(extent3)).toEqual(false);
    });
});

describe('getCrs', () => {
    it('should return the CRS of the first source', () => {
        const extent1 = new Extent(CoordinateSystem.epsg3857, 0, 10, 0, 10);
        const extent2 = new Extent(CoordinateSystem.epsg3857, 11, 20, 11, 20);

        const source1 = new SubSource(extent1);
        const source2 = new SubSource(extent2);

        const source = new AggregateImageSource({ sources: [source1, source2] });

        expect(source.getCrs()).toEqual(CoordinateSystem.epsg3857);
    });
});

describe('getExtent', () => {
    it('should return the union of the extens of all the sources', () => {
        const extent1 = new Extent(CoordinateSystem.epsg3857, 0, 10, 0, 10);
        const extent2 = new Extent(CoordinateSystem.epsg3857, 11, 20, 11, 20);

        const source1 = new SubSource(extent1);
        const source2 = new SubSource(extent2);

        const source = new AggregateImageSource({ sources: [source1, source2] });

        expect(source.getExtent()).toEqual(Extent.unionMany(extent1, extent2));
    });
});

describe('initialize', () => {
    it('should initialize all the sources', async () => {
        const extent1 = new Extent(CoordinateSystem.epsg3857, 0, 10, 0, 10);
        const extent2 = new Extent(CoordinateSystem.epsg3857, 11, 20, 11, 20);

        const source1 = new SubSource(extent1);
        const source2 = new SubSource(extent2);

        source1.initialize = vitest.fn();
        source2.initialize = vitest.fn();

        const source = new AggregateImageSource({ sources: [source1, source2] });

        await source.initialize({ targetProjection: CoordinateSystem.epsg3857 });

        expect(source1.initialize).toHaveBeenCalledTimes(1);
        expect(source2.initialize).toHaveBeenCalledTimes(1);
    });
});

describe('dispose', () => {
    it('should dispose all the sources', () => {
        const extent1 = new Extent(CoordinateSystem.epsg3857, 0, 10, 0, 10);
        const extent2 = new Extent(CoordinateSystem.epsg3857, 11, 20, 11, 20);

        const source1 = new SubSource(extent1);
        const source2 = new SubSource(extent2);

        source1.dispose = vitest.fn();
        source2.dispose = vitest.fn();

        const source = new AggregateImageSource({ sources: [source1, source2] });

        source.dispose();

        expect(source1.dispose).toHaveBeenCalledTimes(1);
        expect(source2.dispose).toHaveBeenCalledTimes(1);
    });
});

describe('updated event', () => {
    it('should call its own updated event when any of the sub-source is updated all the sources', () => {
        const extent1 = new Extent(CoordinateSystem.epsg3857, 0, 10, 0, 10);
        const extent2 = new Extent(CoordinateSystem.epsg3857, 11, 20, 11, 20);

        const source1 = new SubSource(extent1);
        const source2 = new SubSource(extent2);

        const source = new AggregateImageSource({ sources: [source1, source2] });
        const listener = vitest.fn();

        source.addEventListener('updated', listener);

        source1.update();

        expect(listener).toHaveBeenCalledTimes(1);

        source2.update();

        expect(listener).toHaveBeenCalledTimes(2);
    });
});

describe('source', () => {
    it('should return an immutable list of the sources', () => {
        const extent1 = new Extent(CoordinateSystem.epsg3857, 0, 10, 0, 10);
        const extent2 = new Extent(CoordinateSystem.epsg3857, 11, 20, 11, 20);

        const source1 = new SubSource(extent1);
        const source2 = new SubSource(extent2);

        source1.getImages = vitest.fn().mockReturnValue([]);
        source2.getImages = vitest.fn().mockReturnValue([]);

        const source = new AggregateImageSource({ sources: [source1, source2] });

        expect(source.sources).toEqual([source1, source2]);
        expect(Object.isFrozen(source.sources)).toEqual(true);
    });
});

describe('setSourceVisibility', () => {
    it('should raise the updated event on the extent of the sub-source', () => {
        const extent1 = new Extent(CoordinateSystem.epsg3857, 0, 10, 0, 10);
        const extent2 = new Extent(CoordinateSystem.epsg3857, 11, 20, 11, 20);

        const source1 = new SubSource(extent1);
        const source2 = new SubSource(extent2);

        const source = new AggregateImageSource({ sources: [source1, source2] });

        const listener = vitest.fn();
        source.addEventListener('updated', listener);

        source.setSourceVisibility(source1, false);
        source.setSourceVisibility(source1, false);
        source.setSourceVisibility(source1, false);
        source.setSourceVisibility(source1, false);

        expect(listener).toHaveBeenCalledTimes(1);

        source.setSourceVisibility(source2, false);
        source.setSourceVisibility(source2, false);
        source.setSourceVisibility(source2, false);
        source.setSourceVisibility(source2, false);

        expect(listener).toHaveBeenCalledTimes(2);
    });
});

describe('getImages', () => {
    it('should call getImages on all visible sub-sources', () => {
        const extent1 = new Extent(CoordinateSystem.epsg3857, 0, 10, 0, 10);
        const extent2 = new Extent(CoordinateSystem.epsg3857, 11, 20, 11, 20);

        const source1 = new SubSource(extent1);
        const source2 = new SubSource(extent2);
        const source3 = new SubSource(extent2);

        source1.getImages = vitest.fn().mockReturnValue([]);
        source2.getImages = vitest.fn().mockReturnValue([]);
        source3.getImages = vitest.fn().mockReturnValue([]);

        const source = new AggregateImageSource({ sources: [source1, source2, source3] });

        const extent = Extent.unionMany(extent1, extent2)!;
        const id = 'foo';
        const width = 555;
        const height = 576;

        source.setSourceVisibility(source3, false);

        source.getImages({ extent, width, height, id, createReadableTextures: false });

        expect(source1.getImages).toHaveBeenCalledTimes(1);
        expect(source2.getImages).toHaveBeenCalledTimes(1);
        expect(source3.getImages).not.toHaveBeenCalled();
    });
});
