/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

const examples = [];

function executeSearchQuery(elem) {
    const query = elem.target.value.toLowerCase().trim();

    // an empty query shows all examples
    if (!query || query === '') {
        examples.forEach(o => {
            o.disabled = false;
        });
    }

    const re = new RegExp(query, 'gmi');

    examples.forEach(o => {
        /** @type {HTMLElement} */
        const element = o.element;
        const searchTextAttr = element.getAttribute('data-giro3d-searchtext');
        const visible = re.test(searchTextAttr);

        o.element.style.display = visible ? o.display : 'none';
    });
}

function collectExamples() {
    document.querySelectorAll("[id^='example-card']").forEach(e => {
        if (e instanceof HTMLDivElement) {
            const obj = {};
            obj.element = e;
            obj.display = e.style.display;
            examples.push(obj);
        } else {
            console.error('the element with ID example-card must be a <div>');
        }
    });
}

function init() {
    collectExamples();

    registerEvents();
}

window.addEventListener('DOMContentLoaded', init);
function registerEvents() {
    const searchBox = document.getElementById('keywords');
    searchBox.addEventListener('input', executeSearchQuery);
}
