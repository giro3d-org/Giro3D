/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

/**
 * @typedef {(v: string) => void} TextInputCallback
 */

/**
 * Binds a text <input>.
 * @param {string} id The id of the <input> element.
 * @param {TextInputCallback} onChange The callback when the text field value changes.
 * @returns {[TextInputCallback, string, HTMLInputElement]} An array containing three elements: the callback
 * to set the value, the initial value, and the bound element.
 */
export function bindTextInput(id, onChange) {
    const element = document.getElementById(id);
    if (!(element instanceof HTMLInputElement)) {
        throw new Error(
            'invalid binding element: expected HTMLInputElement, got: ' + element.constructor.name,
        );
    }

    element.onchange = () => {
        if (element.checkValidity()) {
            onChange(element.value);
        }
    };

    const setValue = v => {
        element.value = v;
        onChange(element.value);
    };

    const currentValue = element.value;

    return [setValue, currentValue, element];
}
