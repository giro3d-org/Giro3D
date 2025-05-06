#if defined(ENABLE_OUTLINES)
if (vUv.x < (OUTLINE_THICKNESS / baseTextureSize.x)) { // WEST
    gl_FragColor.rgb = tileOutlineColor;
} else if (vUv.x > 1.0 - (OUTLINE_THICKNESS / baseTextureSize.x)) { // EAST
    gl_FragColor.rgb = tileOutlineColor;
} else if (vUv.y < (OUTLINE_THICKNESS / baseTextureSize.y)) { // NORTH
    gl_FragColor.rgb = tileOutlineColor;
} else if (vUv.y > 1.0 - (OUTLINE_THICKNESS / baseTextureSize.y)) { // SOUTH
    gl_FragColor.rgb = tileOutlineColor;
}
#endif