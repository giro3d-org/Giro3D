/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Scene, WebGLRenderer, type Camera } from 'three';
import { describe, expect, it, vitest } from 'vitest';

import C3DEngine from '@giro3d/giro3d/renderer/c3DEngine';

describe('C3DEngine', () => {
    describe('constructor, with a div target', () => {
        it('should create a CSS2D label renderer and append both canvases to the div', () => {
            const div = document.createElement('div');

            const engine = new C3DEngine(div, { renderer: new WebGLRenderer() });

            expect(engine.labelRenderer).not.toBeNull();
            expect(div.children.length).toBe(2);

            engine.dispose();
        });
    });

    describe('constructor, with a canvas target', () => {
        it('should not create a CSS2D label renderer', () => {
            const canvas = document.createElement('canvas');

            const engine = new C3DEngine(canvas, { renderer: new WebGLRenderer() });

            expect(engine.labelRenderer).toBeNull();

            engine.dispose();
        });

        it('should read width/height directly off the canvas', () => {
            const canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 480;

            const engine = new C3DEngine(canvas, { renderer: new WebGLRenderer() });

            expect(engine.width).toBe(640);
            expect(engine.height).toBe(480);

            engine.dispose();
        });

        it('should pass the canvas into WebGLRenderer when no renderer is provided', () => {
            const canvas = document.createElement('canvas');

            const engine = new C3DEngine(canvas);

            const lastCall = vitest.mocked(WebGLRenderer).mock.calls.at(-1);
            expect(lastCall?.[0]).toMatchObject({ canvas });

            engine.dispose();
        });

        it('should not append an error message to the canvas if renderer creation fails', () => {
            const canvas = document.createElement('canvas');
            const appendChild = vitest.spyOn(canvas, 'appendChild');

            vitest.mocked(WebGLRenderer).mockImplementationOnce(() => {
                throw new Error('boom');
            });

            expect(() => new C3DEngine(canvas)).toThrow(/Failed to create WebGLRenderer/);
            expect(appendChild).not.toHaveBeenCalled();
        });
    });

    describe('constructor, with an OffscreenCanvas-shaped target', () => {
        function createFakeOffscreenCanvas(width: number, height: number): OffscreenCanvas {
            return {
                width,
                height,
                getContext: vitest.fn(),
            } as unknown as OffscreenCanvas;
        }

        it('should not create a CSS2D label renderer', () => {
            const canvas = createFakeOffscreenCanvas(320, 240);

            const engine = new C3DEngine(canvas, { renderer: new WebGLRenderer() });

            expect(engine.labelRenderer).toBeNull();

            expect(() => engine.dispose()).not.toThrow();
        });

        it('should read width/height directly off the canvas', () => {
            const canvas = createFakeOffscreenCanvas(320, 240);

            const engine = new C3DEngine(canvas, { renderer: new WebGLRenderer() });

            expect(engine.width).toBe(320);
            expect(engine.height).toBe(240);
        });

        it('should pass the canvas into WebGLRenderer when no renderer is provided', () => {
            const canvas = createFakeOffscreenCanvas(320, 240);

            new C3DEngine(canvas);

            const lastCall = vitest.mocked(WebGLRenderer).mock.calls.at(-1);
            expect(lastCall?.[0]).toMatchObject({ canvas });
        });
    });

    describe('render', () => {
        it('should not throw when there is no label renderer', () => {
            const canvas = document.createElement('canvas');
            const engine = new C3DEngine(canvas, { renderer: new WebGLRenderer() });

            expect(() => engine.render(new Scene(), {} as Camera)).not.toThrow();

            engine.dispose();
        });
    });
});
