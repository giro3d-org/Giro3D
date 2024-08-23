/* eslint-disable @typescript-eslint/no-empty-function */
import type { ColorRepresentation, WebGLRenderer } from 'three';

export const resizeObservers: ResizeObserver[] = [];

class ResizeObserverMock {
    readonly observe: jest.Mock;
    readonly unobserve: jest.Mock;
    readonly disconnect: jest.Mock;

    constructor() {
        this.observe = jest.fn();
        this.unobserve = jest.fn();
        this.disconnect = jest.fn();

        resizeObservers.push(this as ResizeObserver);
    }
}

/**
 * Setups the global scope mocks necessary for some unit tests that interacts
 * with the `window` object.
 */
export function setupGlobalMocks() {
    window.ResizeObserver = ResizeObserverMock;
    window.fetch = jest.fn();
}

type K = keyof WebGLRenderer;

export function mockWebGLRenderer(options?: {
    canvas: HTMLCanvasElement;
    props?: Record<K, WebGLRenderer[K]>;
}): WebGLRenderer {
    const props = options?.props;

    function getProp<K extends keyof WebGLRenderer>(key: K, defaultValue: WebGLRenderer[K]) {
        if (props) {
            return props[key] ?? defaultValue;
        }
        return defaultValue;
    }

    return {
        debug: {
            checkShaderErrors: false,
        },
        capabilities: {
            getMaxAnisotropy() {
                return 0;
            },
        },
        setSize(_width: number, _height: number, _updateStyle?: boolean) {
            return;
        },
        clear: getProp('clear', () => {}),
        setClearColor: getProp(
            'setClearColor',
            (_color: ColorRepresentation, _alpha?: number) => {},
        ),
        getContext() {
            return {
                getParameter(_: GLenum) {
                    return false;
                },
                getExtension(_name: string) {
                    return true;
                },
            } as WebGL2RenderingContext;
        },
        domElement: options?.canvas ?? document.createElement('canvas'),
    } as WebGLRenderer;
}
