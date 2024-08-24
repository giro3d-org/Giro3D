import type { Feature } from 'ol';
import type { Color as OLColor } from 'ol/color';
import type { ColorLike } from 'ol/colorlike';
import type { Extent as OLExtent } from 'ol/extent';
import { Color } from 'three';
import Extent from '../core/geographic/Extent';

function fromOLExtent(extent: OLExtent, projectionCode: string) {
    return new Extent(projectionCode, extent[0], extent[2], extent[1], extent[3]);
}

function toOLExtent(extent: Extent, margin = 0): OLExtent {
    return [
        extent.west - margin,
        extent.south - margin,
        extent.east + margin,
        extent.north + margin,
    ];
}

function parseAlpha(css: string): number {
    let color: RegExpExecArray | null;

    const parse = (s: string) => {
        if (!s) {
            return 1;
        }

        return parseFloat(s);
    };

    // rgb(255,0,0) rgba(255,0,0,0.5)
    if ((color = /^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(css))) {
        return parse(color[4]);
    }
    // rgb(100%,0%,0%) rgba(100%,0%,0%,0.5)
    if ((color = /^\s*(\d+)%\s*,\s*(\d+)%\s*,\s*(\d+)%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(css))) {
        return parse(color[4]);
    }

    return 1;
}

function fromOLColor(input: OLColor | ColorLike): { color: Color; opacity: number } {
    if (typeof input === 'string') {
        const color = new Color().setStyle(input);
        const opacity = parseAlpha(input);

        return { color, opacity };
    } else if (Array.isArray(input)) {
        const [r, g, b, a] = input;

        return { color: new Color(r / 255, g / 255, b / 255), opacity: a };
    } else {
        throw new Error('unsupported color: ' + input);
    }
}

function getFeatureExtent(feature: Feature, crs: string): Extent | undefined {
    const geometry = feature.getGeometry();
    if (!geometry) {
        return undefined;
    }
    const olExtent = geometry.getExtent();
    return fromOLExtent(olExtent, crs);
}

export default {
    fromOLExtent,
    toOLExtent,
    fromOLColor,
    getFeatureExtent,
};
