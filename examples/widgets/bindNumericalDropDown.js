/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

/**
 * @typedef {(v: number) => void} NumericalDropDownCallback
 */

/**
 * Binds a numerical dropdown.
 * @param {string} id The id of the <input> element.
 * @param {NumericalDropDownCallback} onChange The callback when the dropdown value changes.
 * @returns {[NumericalDropDownCallback, number, HTMLSelectElement]} An array with 3 elements: the
 * callback to set the value from outside, the initial value, and the HTML element;
 */
export function bindNumericalDropDown(id, onChange) {
    const element = document.getElementById(id);
    if (!(element instanceof HTMLSelectElement)) {
        throw new Error(
            'invalid binding element: expected HTMLSelectElement, got: ' + element.constructor.name,
        );
    }

    element.onchange = () => {
        onChange(parseInt(element.value));
    };

    const callback = v => {
        element.value = v.toString();
        onChange(parseInt(element.value));
    };

    return [callback, parseInt(element.value), element];
}
