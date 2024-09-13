/**
 * Describes how a layer is blended into the background (either another layer or the background
 * color).
 */
enum BlendingMode {
    /**
     * No blending is performed, i.e if the layer has transparent or semi-transparent pixels,
     * they become opaque.
     */
    None = 0,
    /**
     * Normal [alpha blending](https://en.wikipedia.org/wiki/Alpha_compositing).
     */
    Normal = 1,
    /**
     * Additive blending: pixel colors are added to the background pixel. The alpha channel is not
     * used
     */
    Add = 2,
    /**
     * Multiplicative blending: pixel colors are multiplied by the background pixel. The alpha
     * channel is not used.
     */
    Multiply = 3,
}

export default BlendingMode;
