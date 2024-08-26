/**
 * @typedef {(v: string) => void} DropDownCallback
 */

/**
 * Binds a text-value dropdown.
 * @param {string} id The id of the <input> element.
 * @param {DropDownCallback} onChange The callback when the dropdown value changes.
 * @returns {[DropDownCallback, string, HTMLSelectElement]} An array with 3 elements: the callback to set
 * the value from outside, the initial value, and the HTML element;
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

    return [callback, element.value, element];
}
