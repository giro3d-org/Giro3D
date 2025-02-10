export enum MapLightingMode {
    /**
     * Use a simplified [hillshade model]((https://earthquake.usgs.gov/education/geologicmaps/hillshades.php)).
     *
     * Note: hillshade model only works for **projected coordinates systems**.
     *
     * Note: hillshading has no effect if the map does not contain an elevation layer.
     */
    Hillshade = 0,
    /**
     * Uses THREE.js [lights](https://threejs.org/docs/index.html?q=light#api/en/lights/Light) and [shadows](https://threejs.org/docs/index.html?q=shadow#api/en/lights/shadows/LightShadow) present in the scene.
     */
    LightBased = 1,
}

/**
 * Options for map shading.
 */
type MapLightingOptions = {
    /**
     * Enables shading.
     * @defaultValue false
     */
    enabled?: boolean;
    /**
     * The shading mode.
     * @defaultValue {@link MapLightingMode.Hillshade}
     */
    mode?: MapLightingMode;
    /**
     * The z-factor (vertical exaggeration) to apply to slopes before computing shading.
     * @defaultValue 1
     */
    zFactor?: number;
    /**
     * If `true`, only elevation layers are shaded leaving the color layers unshaded.
     * @defaultValue false
     */
    elevationLayersOnly?: boolean;

    /**
     * The azimuth of the sunlight direction, in degrees (0 = north, 180 = south, etc.).
     * Note: only available if {@link mode} is {@link MapLightingMode.Hillshade}
     * @defaultValue 135
     */
    hillshadeAzimuth?: number;
    /**
     * The vertical angle of the sun, in degrees. (90 = zenith).
     * Note: only available if {@link mode} is {@link MapLightingMode.Hillshade}
     * @defaultValue 45
     */
    hillshadeZenith?: number;
    /**
     * The intensity of the shade (0 = no shade, 1 = completely opaque shade).
     * Note: only available if {@link mode} is {@link MapLightingMode.Hillshade}
     * @defaultValue 1
     */
    hillshadeIntensity?: number;

    /**
     * If `true`, the map will cast shadows.
     * Note: only available if {@link mode} is {@link MapLightingMode.LightBased}
     * @defaultValue true
     */
    castShadows?: boolean;
    /**
     * If `true`, the map will receive shadows.
     * Note: only available if {@link mode} is {@link MapLightingMode.LightBased}
     * @defaultValue true
     */
    receiveShadows?: boolean;
};

export default MapLightingOptions;
