/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

/** Tests the render pipeline's scene background handling. */

import {
    Color,
    Mesh,
    MeshBasicMaterial,
    Object3D,
    PerspectiveCamera,
    Scene,
    type WebGLRenderer,
} from 'three';
import { expect, it, vitest } from 'vitest';

import RenderingOptions from '@giro3d/giro3d/renderer/RenderingOptions';
import RenderPipeline from '@giro3d/giro3d/renderer/RenderPipeline';

vitest.mock('three/examples/jsm/postprocessing/EffectComposer.js', () => ({
    EffectComposer: class {
        public addPass = vitest.fn();
        public dispose = vitest.fn();
        public render = vitest.fn();
    },
}));

function createRenderer(render: (scene: Object3D) => void = () => {}): WebGLRenderer {
    const clearColor = new Color();

    return {
        capabilities: { maxSamples: 4 },
        clear: vitest.fn(),
        getClearAlpha: vitest.fn().mockReturnValue(1),
        getClearColor: vitest.fn().mockImplementation(target => target.copy(clearColor)),
        render: vitest.fn(render),
        setClearAlpha: vitest.fn(),
        setClearColor: vitest.fn(),
        setRenderTarget: vitest.fn(),
    } as unknown as WebGLRenderer;
}

function createScene(): Scene {
    const scene = new Scene();
    scene.add(new Mesh(undefined, new MeshBasicMaterial()));
    scene.add(new Mesh(undefined, new MeshBasicMaterial({ transparent: true })));
    return scene;
}

it('hides the scene background while rendering buckets and restores it afterwards', () => {
    const backgrounds: (Color | null)[] = [];
    const renderer = createRenderer(scene => {
        backgrounds.push((scene as Scene).background as Color | null);
    });
    const pipeline = new RenderPipeline(renderer);
    const scene = createScene();
    const background = new Color('cyan');
    scene.background = background;

    pipeline.render(scene, new PerspectiveCamera(), 1, 1, new RenderingOptions());

    expect(backgrounds).toEqual([background, null, null]);
    expect(scene.background).toBe(background);
});

it('restores the scene background when rendering a bucket throws', () => {
    const renderer = createRenderer();
    const render = vitest.mocked(renderer.render);
    render
        .mockImplementationOnce(() => {})
        .mockImplementationOnce(() => {
            throw new Error('render failed');
        });
    const pipeline = new RenderPipeline(renderer);
    const scene = createScene();
    const background = new Color('cyan');
    scene.background = background;

    expect(() =>
        pipeline.render(scene, new PerspectiveCamera(), 1, 1, new RenderingOptions()),
    ).toThrow('render failed');
    expect(scene.background).toBe(background);
});

it('renders an Object3D root without accessing a scene background', () => {
    const renderer = createRenderer();
    const pipeline = new RenderPipeline(renderer);
    const root = new Object3D();
    root.add(new Mesh(undefined, new MeshBasicMaterial()));

    expect(() =>
        pipeline.render(root, new PerspectiveCamera(), 1, 1, new RenderingOptions()),
    ).not.toThrow();
});
