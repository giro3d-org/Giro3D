/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Color } from 'three';

/**
 * @typedef {(color: import("three").ColorRepresentation) => void} ColorPickerCallback
 */

/**
 * @param {string} id - The DOM element id.
 * @param {ColorPickerCallback} onChange - The change callback.
 * @returns {[ColorPickerCallback, import("three").ColorRepresentation, HTMLInputElement]} An array with 3
 * elements: the callback to set the value from outside, the initial value, and the HTML element;
 */
export function bindColorPicker(id, onChange) {
    const element = document.getElementById(id);
    if (!(element instanceof HTMLInputElement)) {
        throw new Error(
            'invalid binding element: expected HTMLInputElement, got: ' + element.constructor.name,
        );
    }

    element.oninput = function oninput() {
        // Let's change the classification color with the color picker value
        const hexColor = element.value;
        onChange(new Color(hexColor));
    };

    const externalFunction = v => {
        element.value = `#${new Color(v).getHexString()}`;
        onChange(element.value);
    };

    return [externalFunction, new Color(element.value), element];
}
