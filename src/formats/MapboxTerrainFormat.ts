import { FloatType } from 'three';
import TextureGenerator from '../utils/TextureGenerator';
import type { DecodeOptions } from './ImageFormat';
import ImageFormat from './ImageFormat';

/**
 * Decoder for [Mapbox Terrain](https://docs.mapbox.com/data/tilesets/reference/mapbox-terrain-dem-v1/) images.
 */
class MapboxTerrainFormat extends ImageFormat {
    readonly isMapboxTerrainFormat: boolean = true;
    constructor() {
        super(true, FloatType);

        this.type = 'MapboxTerrainFormat';
    }

    /**
     * Decode a Mapbox Terrain blob into a
     * [DataTexture](https://threejs.org/docs/?q=texture#api/en/textures/DataTexture) containing
     * the elevation data.
     *
     * @param blob - the data to decode
     * @param options - the decoding options
     */
    async decode(blob: Blob, options?: DecodeOptions) {
        const bitmap = await createImageBitmap(blob);

        const { data, width, height } = TextureGenerator.decodeMapboxTerrainImage(bitmap);

        const { texture, min, max } = TextureGenerator.createDataTexture(
            {
                width,
                height,
                nodata: options?.noDataValue,
            },
            FloatType,
            data,
        );

        return {
            texture,
            min,
            max,
        };
    }
}

export default MapboxTerrainFormat;
