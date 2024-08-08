import { Color, ColorRepresentation } from 'three';

/**
 * @param {string} id - The DOM element id.
 * @param {(color: Color) => void} onChange - The change callback.
 * @returns {(color: ColorRepresentation) => void} The external update function.
 */
export function bindColorPicker(id, onChange) {
    const colorPicker = document.getElementById(id);

    colorPicker.oninput = function oninput() {
        // Let's change the classification color with the color picker value
        const hexColor = colorPicker.value;
        onChange(new Color(hexColor));
    };

    const externalFunction = v => {
        colorPicker.value = `#${new Color(v).getHexString()}`;
        onChange(colorPicker.value);
    };

    return externalFunction;
}
