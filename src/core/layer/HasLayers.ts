/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type Layer from './Layer';

/**
 * Interface for any object that can contain {@link Layer}.
 */
interface HasLayers {
    /**
     * Read-only flag to check if a given object is of type {@link HasLayers}.
     */
    readonly hasLayers: true;

    /**
     * Applies the callback to each layer in the object.
     */
    forEachLayer(callback: (layer: Layer) => void): void;

    /**
     * Returns a _new_ array containing the layers in this object.
     * Optionally, the predicate can be used to filter out unwanted layers.
     *
     * ```js
     * // Get all layers from the object.
     * const allLayers = obj.getLayers();
     *
     * // Get all color layers from the object.
     * const colorLayers = obj.getLayers((layer) => layer.isColorLayer);
     * ```
     */
    getLayers(predicate?: (arg0: Layer) => boolean): Layer[];

    /**
     * Returns the number of layers currently in this object.
     */
    get layerCount(): number;
}

/**
 * Checks if the specified object implements the {@link HasLayers} interface.
 *
 * ```js
 * if (hasLayers(myObject)) {
 *    myObject.forEachLayer((layer) => console.log(layer));
 * }
 * ```
 * @param obj - The object to test.
 */
export function hasLayers(obj: unknown): obj is HasLayers {
    return (obj as HasLayers).hasLayers ?? false;
}

export default HasLayers;
