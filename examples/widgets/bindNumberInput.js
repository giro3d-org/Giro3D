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
 * @returns {[NumericalDropDownCallback, number, HTMLInputElement]} An array with 3 elements: the
 * callback to set the value from outside, the initial value, and the HTML element;
 */
export function bindNumberInput(id, onChange) {
    const element = document.getElementById(id);
    if (!(element instanceof HTMLInputElement)) {
        throw new Error(
            'invalid binding element: expected HTMLInputElement, got: ' + element.constructor.name,
        );
    }

    element.onchange = () => {
        onChange(element.valueAsNumber);
    };

    const callback = v => {
        element.value = v.toString();
        onChange(element.valueAsNumber);
    };

    return [callback, element.valueAsNumber, element];
}
