/**
 * @typedef {(v: string) => void} DropDownCallback
 */

/**
 * @typedef {(options: Array<{id: string, name: string, selected?: boolean}>) => void} SetOptionsCallback
 */

/**
 * Binds a text-value dropdown.
 * @param {string} id The id of the <input> element.
 * @param {DropDownCallback} onChange The callback when the dropdown value changes.
 * @returns {[DropDownCallback, string, HTMLSelectElement, SetOptionsCallback]} An array with 4 elements: the callback to set
 * the value from outside, the initial value, the HTML element, and a callback to set the available
 * options in the dropdown list.
 */
export function bindDropDown(id, onChange) {
    const element = document.getElementById(id);
    if (!(element instanceof HTMLSelectElement)) {
        throw new Error(
            'invalid binding element: expected HTMLSelectElement, got: ' + element.constructor.name,
        );
    }

    element.onchange = () => {
        onChange(element.value);
    };

    const callback = v => {
        element.value = v;
        onChange(element.value);
    };

    /** @type {SetOptionsCallback} */
    const setOptions = options => {
        const items = options.map(
            opt => `<option value=${opt.id} ${opt.selected ? 'selected' : ''}>${opt.name}</option>`,
        );
        element.innerHTML = items.join('\n');
    };

    return [callback, element.value, element, setOptions];
}
