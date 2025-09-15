/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

/**
 * @typedef {(v: number, min?: number, max?: number, step?: number) => void} SliderCallback
 */

/**
 * Binds a {@link HTMLInputElement} in slider mode.
 * @param {string} id The id of the <input> element.
 * @param {SliderCallback} onChange The callback when the slider value changes.
 * @returns {[SliderCallback, number, HTMLInputElement]} An array containing three elements: the callback
 * to set the value, the initial value, and the bound element.
 */
export function bindSlider(id, onChange) {
    const element = document.getElementById(id);
    if (!(element instanceof HTMLInputElement)) {
        throw new Error(
            'invalid binding element: expected HTMLInputElement, got: ' + element.constructor.name,
        );
    }

    element.oninput = function oninput() {
        onChange(element.valueAsNumber);
    };

    const setValue = (v, min, max, step) => {
        if (min != null && max != null) {
            element.min = min.toString();
            element.max = max.toString();

            if (step != null) {
                element.step = step;
            }
        }
        element.valueAsNumber = v;
        onChange(element.valueAsNumber);
    };

    const initialValue = element.valueAsNumber;

    return [setValue, initialValue, element];
}
