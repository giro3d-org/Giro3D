/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { MathUtils } from 'three';

/** @typedef {(min: number, max: number) => void} ColorMapBoundsCallback */

/**
 * @param {ColorMapBoundsCallback} callback
 * @returns {ColorMapBoundsCallback}
 */
export function bindColorMapBounds(callback) {
    const min = document.getElementById('min');
    if (!(min instanceof HTMLInputElement)) {
        throw new Error(
            'invalid binding element: expected HTMLInputElement, got: ' + min.constructor.name,
        );
    }

    const max = document.getElementById('max');
    if (!(max instanceof HTMLInputElement)) {
        throw new Error(
            'invalid binding element: expected HTMLInputElement, got: ' + max.constructor.name,
        );
    }

    const lower = min;
    const upper = max;

    callback(lower.valueAsNumber, upper.valueAsNumber);

    function updateLabels() {
        document.getElementById('minLabel').innerText =
            `Lower bound: ${Math.round(lower.valueAsNumber)}m`;
        document.getElementById('maxLabel').innerText =
            `Upper bound: ${Math.round(upper.valueAsNumber)}m`;
    }

    lower.oninput = function oninput() {
        const rawValue = lower.valueAsNumber;
        const clampedValue = MathUtils.clamp(
            rawValue,
            Number.parseFloat(lower.min),
            upper.valueAsNumber - 1,
        );
        lower.valueAsNumber = clampedValue;
        callback(lower.valueAsNumber, upper.valueAsNumber);
        updateLabels();
    };

    upper.oninput = function oninput() {
        const rawValue = upper.valueAsNumber;
        const clampedValue = MathUtils.clamp(
            rawValue,
            lower.valueAsNumber + 1,
            Number.parseFloat(upper.max),
        );
        upper.valueAsNumber = clampedValue;
        callback(lower.valueAsNumber, upper.valueAsNumber);
        updateLabels();
    };

    const externalInput = (newMin, newMax) => {
        lower.min = newMin;
        lower.max = newMax;
        upper.min = newMin;
        upper.max = newMax;
        lower.valueAsNumber = newMin;
        upper.valueAsNumber = newMax;
        callback(lower.valueAsNumber, upper.valueAsNumber);
        updateLabels();
    };

    return externalInput;
}
