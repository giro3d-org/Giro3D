import CogSource, {
    type ChannelMapping,
    type CogCacheOptions,
    type CogSourceOptions,
} from './CogSource';
import ImageSource, {
    type CustomContainsFn,
    type GetImageOptions,
    type ImageResponse,
    type ImageResult,
    type ImageSourceEvents,
    type ImageSourceOptions,
} from './ImageSource';
import PotreeSource from './PotreeSource';
import StaticImageSource, {
    type StaticImageSourceEvents,
    type StaticImageSourceOptions,
} from './StaticImageSource';
import TiledImageSource, { type TiledImageSourceOptions } from './TiledImageSource';
import Tiles3DSource from './Tiles3DSource';
import VectorSource, { type VectorSourceOptions } from './VectorSource';
import VectorTileSource, { type VectorTileSourceOptions } from './VectorTileSource';
import WmsSource, { type WmsSourceOptions } from './WmsSource';
import WmtsSource, { type WmtsFromCapabilitiesOptions, type WmtsSourceOptions } from './WmtsSource';

/**
 * Data sources.
 */
export {
    ImageSource,
    ImageSourceOptions,
    GetImageOptions,
    ImageResponse,
    CustomContainsFn,
    ImageResult,
    ImageSourceEvents,
    Tiles3DSource,
    VectorSource,
    VectorSourceOptions,
    VectorTileSource,
    VectorTileSourceOptions,
    PotreeSource,
    TiledImageSource,
    TiledImageSourceOptions,
    CogSource,
    CogSourceOptions,
    CogCacheOptions,
    ChannelMapping,
    WmtsSource,
    WmtsSourceOptions,
    WmtsFromCapabilitiesOptions,
    WmsSource,
    WmsSourceOptions,
    StaticImageSource,
    StaticImageSourceOptions,
    StaticImageSourceEvents,
};
