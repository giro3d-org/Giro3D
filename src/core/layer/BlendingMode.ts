enum BlendingMode {
    /**
     * Discard layer transparency.
     */
    None = 0,
    /**
     * Normal alpha blending.
     */
    Normal = 1,
    /**
     * Additive blending.
     */
    Add = 2,
    /**
     * Multiplicative blending.
     */
    Multiply = 3,
}

export default BlendingMode;
