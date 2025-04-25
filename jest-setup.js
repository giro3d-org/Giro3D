/**
 * This file fills the global object with Node-based alternatives when
 * they are missing in a non-browser environement.
 */
import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'node:util';

import 'jest-canvas-mock';

global.TextDecoder = NodeTextDecoder;
global.TextEncoder = NodeTextEncoder;

jest.mock('three', () => {
    const three = jest.requireActual('three');
    return {
        ...three,
        WebGLRenderer: jest.fn().mockReturnValue({
            domElement: {
                tabIndex: 0,
                width: 10,
                height: 10,
                style: jest.fn(),
                appendChild: jest.fn(),
                addEventListener: jest.fn(),
                getBoundingClientRect() {
                    return { x: 10, y: 10 };
                },
            },
            capabilities: {
                getMaxAnisotropy() {
                    return 0;
                },
            },
            setSize: jest.fn(),
            clear: jest.fn(),
            setClearColor: jest.fn(),
            getContext() {
                return {
                    getParameter() {
                        return 0;
                    },
                    getExtension() {
                        return true;
                    },
                };
            },
            debug: {
                checkShaderErrors: false,
            },
        }),
    };
});
