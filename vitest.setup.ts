/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { vitest } from 'vitest';
import 'vitest-canvas-mock';

vitest.mock('three', async () => {
    const three = await vitest.importActual('three');
    return {
        ...three,
        WebGLRenderer: vitest.fn().mockImplementation(() => {
            let pixelRatio = 1;
            return {
                domElement: document.createElement('canvas'),
                capabilities: {
                    getMaxAnisotropy(): number {
                        return 0;
                    },
                },
                dispose: vitest.fn(),
                setSize: vitest.fn(),
                clear: vitest.fn(),
                setClearColor: vitest.fn(),
                setRenderTarget: vitest.fn(),
                render: vitest.fn(),
                getDrawingBufferSize: vitest.fn().mockReturnValue({ width: 10, height: 10 }),
                getPixelRatio: vitest.fn(() => pixelRatio),
                setPixelRatio: vitest.fn((value: number) => {
                    pixelRatio = value;
                }),
                getContext(): { getParameter(): number; getExtension(): boolean } {
                    return {
                        getParameter(): number {
                            return 0;
                        },
                        getExtension(): boolean {
                            return true;
                        },
                    };
                },
                debug: {
                    checkShaderErrors: false,
                },
            };
        }),
    };
});
