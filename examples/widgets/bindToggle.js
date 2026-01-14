/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

/**
 * @typedef {(v: boolean) => void} ToggleCallback
 */

/**
 * Binds a toggle switch or checkbox.
 * @param {string} id The id of the <input> element.
 * @param {ToggleCallback} onChange The callback when the dropdown value changes.
 * @returns {[ToggleCallback, boolean, HTMLInputElement]} An array containing three elements: the
 * callback to set the value, the initial value, and the bound element.
 */
export function bindToggle(id, onChange) {
    const element = document.getElementById(id);
    if (!(element instanceof HTMLInputElement)) {
        throw new Error(
            'invalid binding element: expected HTMLButtonElement, got: ' + element.constructor.name,
        );
    }

    element.oninput = function oninput() {
        onChange(element.checked);
    };

    const callback = v => {
        element.checked = v;
        onChange(element.checked);
    };

    return [callback, element.checked, element];
}
