import type { ColorRepresentation } from 'three';
import { Color } from 'three';

// See https://www.codeproject.com/Articles/16565/Determining-Ideal-Text-Color-Based-on-Specified-Ba
/**
 * Returns a hex color (including the leading #) that contrasts with the input color.
 */
export function getContrastColor(color: ColorRepresentation): string {
    const c = color instanceof Color ? color : new Color(color);
    // Find a text color with enough contrast from the background color
    const nThreshold = 105 / 255;
    const bgDelta = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;

    return 1 - bgDelta < nThreshold ? '#000000' : '#ffffff';
}
