/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

/**
 * @typedef {(v: Date) => void} DatePickerCallback
 */

/**
 * Binds a date picker.
 * @param {string} id The id of the <input> element.
 * @param {DatePickerCallback} onChange The callback when the dropdown value changes.
 * @returns {[DatePickerCallback, Date, HTMLInputElement]}  An array containing three elements: the callback
 * to set the value, the initial value, and the bound element.
 */
export function bindDatePicker(id, onChange) {
    const element = document.getElementById(id);
    if (!(element instanceof HTMLInputElement)) {
        throw new Error(
            'invalid binding element: expected HTMLInputElement, got: ' + element.constructor.name,
        );
    }

    element.onchange = () => {
        onChange(new Date(element.value));
    };

    const callback = v => {
        const clone = new Date(v.getTime());
        v.setMinutes(v.getMinutes() - v.getTimezoneOffset());
        element.value = clone.toISOString().slice(0, 10);
        onChange(new Date(element.value));
    };

    return [callback, new Date(element.value), element];
}
