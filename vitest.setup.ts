import { vitest } from 'vitest';
import 'vitest-canvas-mock';

vitest.mock('three', async () => {
    const three = await vitest.importActual('three');
    return {
        ...three,
        WebGLRenderer: vitest.fn().mockReturnValue({
            domElement: document.createElement('canvas'),
            capabilities: {
                getMaxAnisotropy() {
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
