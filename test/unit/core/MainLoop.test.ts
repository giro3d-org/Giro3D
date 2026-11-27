/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type Instance from '@giro3d/giro3d/core/Instance';

import MainLoop from '@giro3d/giro3d/core/MainLoop';

describe('MainLoop', () => {
    // Hold the queued frames ourselves, so the test decides when (and whether) they run.
    let queued: Map<number, FrameRequestCallback>;
    let nextHandle: number;

    beforeEach(() => {
        queued = new Map();
        nextHandle = 1;
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            const handle = nextHandle++;
            queued.set(handle, callback);
            return handle;
        });
        vi.stubGlobal('cancelAnimationFrame', (handle: number) => {
            queued.delete(handle);
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    // Runs every frame still queued, as the browser would on the next repaint.
    function flushFrames(): void {
        const callbacks = [...queued.values()];
        queued.clear();
        callbacks.forEach(callback => callback(performance.now()));
    }

    // step() dispatches 'update-start' before touching anything else, so an instance
    // that only records events is enough to tell whether a frame ran.
    function fakeInstance(): Instance {
        return { dispatchEvent: vi.fn() } as unknown as Instance;
    }

    describe('dispose', () => {
        it('should cancel the frame requested by scheduleUpdate()', () => {
            const mainLoop = new MainLoop();
            const instance = fakeInstance();

            mainLoop.scheduleUpdate(instance);
            expect(queued.size).toBe(1);

            mainLoop.dispose();
            expect(queued.size).toBe(0);

            flushFrames();
            expect(instance.dispatchEvent).not.toHaveBeenCalled();
        });

        it('should not step when an update is scheduled after dispose()', () => {
            const mainLoop = new MainLoop();
            const instance = fakeInstance();

            mainLoop.dispose();
            mainLoop.scheduleUpdate(instance);
            flushFrames();

            expect(instance.dispatchEvent).not.toHaveBeenCalled();
        });

        it('should not step on an immediate update after dispose()', () => {
            const mainLoop = new MainLoop();
            const instance = fakeInstance();

            mainLoop.dispose();
            mainLoop.scheduleUpdate(instance, undefined, { immediate: true });

            expect(instance.dispatchEvent).not.toHaveBeenCalled();
        });
    });
});
