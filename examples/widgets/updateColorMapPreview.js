/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

/**
 * @param {string} id - The id of the element to update.
 * @param {import("three").Color[]} colors - The new colors
 */
export default function updatePreview(id, colors) {
    /** @type {HTMLCanvasElement} */
    // @ts-expect-error conversion
    const canvas = document.getElementById(id);
    const ctx = canvas.getContext('2d');

    canvas.width = colors.length;
    canvas.height = 1;

    for (let i = 0; i < colors.length; i++) {
        const color = colors[i];
        ctx.fillStyle = `#${color.getHexString()}`;
        ctx.fillRect(i, 0, 1, canvas.height);
    }
}
