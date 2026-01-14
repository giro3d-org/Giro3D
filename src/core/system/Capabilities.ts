/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { type WebGLRenderer } from 'three';

// default values
let logDepthBufferSupported = false;
let maxTexturesUnits = 8;
let maxTextureSize = 2048;
let maxAnisotropy = 0;

export default {
    isLogDepthBufferSupported(): boolean {
        return logDepthBufferSupported;
    },
    getMaxTextureUnitsCount(): number {
        return maxTexturesUnits;
    },
    getMaxTextureSize(): number {
        return maxTextureSize;
    },
    getMaxAnisotropy(): number {
        return maxAnisotropy;
    },
    updateCapabilities(renderer: WebGLRenderer): void {
        const gl = renderer.getContext();
        maxTexturesUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
        maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
        logDepthBufferSupported = renderer.capabilities.logarithmicDepthBuffer;
    },
};
