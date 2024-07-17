#if defined(ENABLE_OUTLINES)
if (vUv.x < OUTLINE_THICKNESS) { // WEST
    gl_FragColor.rgb = tileOutlineColor;
} else if (vUv.x > 1.0 - OUTLINE_THICKNESS) { // EAST
    gl_FragColor.rgb = tileOutlineColor;
} else if (vUv.y < OUTLINE_THICKNESS) { // NORTH
    gl_FragColor.rgb = tileOutlineColor;
} else if (vUv.y > 1.0 - OUTLINE_THICKNESS) { // SOUTH
    gl_FragColor.rgb = tileOutlineColor;
}
#endif