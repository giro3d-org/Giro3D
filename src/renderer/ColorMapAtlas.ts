import {
    NearestFilter,
    RGBAFormat,
    UnsignedByteType,
    type Texture,
    type WebGLRenderer,
} from 'three';
import type ColorMap from '../core/ColorMap';
import Rect from '../core/Rect';
import WebGLComposer from './composition/WebGLComposer';

/**
 * Combines color map textures into a single one.
 * This is necessary to avoid consuming too many texture units.
 */
class ColorMapAtlas {
    private readonly _renderer: WebGLRenderer;
    private readonly _colorMaps: Map<ColorMap, { offset: number; texture: string }> = new Map();
    private _texture: Texture | null = null;
    private _dirty = false;
    private _disposed = false;

    /**
     * @param renderer - The renderer
     */
    constructor(renderer: WebGLRenderer) {
        this._renderer = renderer;
    }

    /**
     * Adds a color map to the atlas.
     *
     * @param colorMap - The color map.
     */
    add(colorMap: ColorMap) {
        this._colorMaps.set(colorMap, { offset: 0, texture: '' });
        this._dirty = true;
    }

    /**
     * Removes a color map from the atlas.
     *
     * @param colorMap - The color map.
     */
    remove(colorMap: ColorMap) {
        this._colorMaps.delete(colorMap);
        this._dirty = true;
    }

    forceUpdate() {
        this._dirty = true;
    }

    update() {
        // The atlas should be re-rendered if any colormap texture has changed.
        for (const [colorMap, info] of this._colorMaps.entries()) {
            const texture = colorMap.getTexture();
            if (texture.uuid !== info.texture) {
                this._dirty = true;
                break;
            }
        }
    }

    private createTexture() {
        this._texture?.dispose();
        this._texture = null;

        if (this._colorMaps.size === 0) {
            return;
        }

        // The atlas width is the width of the biggest color map.
        const atlasWidth = Math.max(...[...this._colorMaps.keys()].map(c => c.colors.length));
        // Use 3 pixels in height per color map, to avoid filtering artifacts when using
        // tightly packed 1-pixel textures.
        const atlasHeight = this._colorMaps.size * 3;

        const atlas = new WebGLComposer({
            extent: new Rect(0, 1, 0, 1),
            width: atlasWidth,
            height: atlasHeight,
            webGLRenderer: this._renderer,
            minFilter: NearestFilter,
            magFilter: NearestFilter,
            reuseTexture: false,
            textureDataType: UnsignedByteType,
            pixelFormat: RGBAFormat,
        });

        const height = 1 / this._colorMaps.size;
        let yMin = 0;

        for (const [colorMap, info] of this._colorMaps.entries()) {
            const yMax = yMin + height;

            // Each color map will be rendered as an horizontal stripe of width 100% and height 1/N
            // of the atlas height, where N is the number of color maps to pack into the atlas.
            const rect = new Rect(0, 1, yMin, yMax);

            const texture = colorMap.getTexture();
            atlas.draw(colorMap.getTexture(), rect);

            // The offset lies right in the middle pixel of the stripe.
            info.offset = rect.centerY;
            info.texture = texture.uuid;
            yMin = yMax;
        }

        this._texture = atlas.render();
        this._texture.name = 'ColorMapAtlas';
        atlas.dispose();
        this._dirty = false;
    }

    /**
     * Gets the atlas texture.
     */
    get texture() {
        if (this._dirty) {
            this.createTexture();
        }
        return this._texture;
    }

    /**
     * Gets the vertical offset for the specified color map.
     *
     * @param colorMap - The color map.
     * @returns The offset.
     */
    getOffset(colorMap: ColorMap): number | undefined {
        if (this._dirty) {
            this.createTexture();
        }
        return this._colorMaps.get(colorMap)?.offset;
    }

    dispose() {
        if (this._disposed) {
            return;
        }
        this._disposed = true;
        this._texture?.dispose();
        this._colorMaps.clear();
    }
}

export default ColorMapAtlas;
