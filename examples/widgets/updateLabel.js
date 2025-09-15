/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

/**
 * Updates the `<label>` element with the provided text.
 * @param {string} id - The id of the label element.
 * @param {string} text - The label text.
 */
export function updateLabel(id, text) {
    const element = document.getElementById(id);
    if (!(element instanceof HTMLLabelElement)) {
        throw new Error(
            'invalid binding element: expected HTMLLabelElement, got: ' + element.constructor.name,
        );
    }

    element.innerText = text;
}
