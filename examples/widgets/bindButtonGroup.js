/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

/**
 * Binds a bootstrap button group.
 * @param {string} id The id of the <button> element.
 * @param {(index: number, element: HTMLAnchorElement) => void} onSelect The click handler.
 * @returns {[(index: number) => void ,HTMLDivElement]} An array containing a callback to set the active button, and the button group element.
 */
export function bindButtonGroup(id, onSelect) {
    const element = document.getElementById(id);
    if (!(element instanceof HTMLDivElement)) {
        throw new Error(
            'invalid binding element: expected HTMLDivElement, got: ' + element.constructor.name,
        );
    }

    const childCount = element.children.length;

    /** @type {Array<HTMLAnchorElement>} */
    const children = [];

    const setActive = index => {
        children.forEach(c => c.classList.remove('active'));
        element.children[index].classList.add('active');
    };

    for (let index = 0; index < childCount; index++) {
        const child = element.children[index];

        if (!(child instanceof HTMLAnchorElement)) {
            throw new Error(
                'all children of a button group must be instances of HTMLAnchorElement',
            );
        }

        children.push(child);

        child.addEventListener('click', function click() {
            children.forEach(c => c.classList.remove('active'));
            child.classList.add('active');

            onSelect(index, child);
        });
    }

    children[0].classList.add('active');

    onSelect(0, children[0]);

    return [setActive, element];
}
