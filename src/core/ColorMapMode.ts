/**
 * Modes of the color map gradient.
 */
enum ColorMapMode {
    /**
     * The color map describes an elevation gradient.
     */
    Elevation = 1,

    /**
     * The color map describes a slope gradient.
     */
    Slope = 2,

    /**
     * The color map describes an aspect gradient.
     */
    Aspect = 3,
}

export default ColorMapMode;
