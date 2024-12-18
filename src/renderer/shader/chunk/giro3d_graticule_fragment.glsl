#if defined(ENABLE_GRATICULE)
    vec2 graticuleCoordinates = vec2(extent[0] + vUv.x * extent[2], extent[1] + vUv.y * extent[3]);
    drawGraticule(graticuleCoordinates, graticule);
#endif