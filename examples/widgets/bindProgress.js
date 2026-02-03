/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

/**
 * Binds a progress bar.
 * @param {string} id The id of the <div> element.
 * @returns {[(value: number, text?: string) => void, HTMLElement]} An array containing the function
 * to update the progress value (the width of the progress bar), and the progress bar element.
 */
export function bindProgress(id) {
    const element = document.getElementById(id);
    if (!(element instanceof HTMLDivElement)) {
        throw new Error(
            'invalid binding element: expected HTMLDivElement, got: ' + element.constructor.name,
        );
    }

    const setProgress = (normalized, text) => {
        element.style.width = `${Math.round(normalized * 100)}%`;
        if (text) {
            element.innerText = text;
        }
    };

    return [setProgress, element.parentElement];
}
