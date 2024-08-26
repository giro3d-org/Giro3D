/**
 * Binds a text <input>.
 * @param {string} id The id of the <input> element.
 * @param {(v: string) => void} onChange The callback when the text field value changes.
 * @returns {[v: string, (v: string) => void]} The function to update the value from outside.
 */
export function bindTextInput(id, onChange) {
    /** @type {HTMLInputElement} */
    const element = document.getElementById(id);
    element.onchange = () => {
        if (element.checkValidity()) {
            onChange(element.value);
        }
    };

    const setValue = v => {
        element.value = v;
        onChange(element.value);
    };

    const currentValue = element.value;

    return [currentValue, setValue];
}
