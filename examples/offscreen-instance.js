/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { PerspectiveCamera } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

/** @type {HTMLCanvasElement} */
// @ts-expect-error not strongly typed
const canvas = document.getElementById('offscreen-canvas');

// Size the canvas's drawing buffer to match its on-screen size *before* transferring control
// away: once transferred, only the Worker can resize the drawing buffer (via the message
// listener below).
canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;

const offscreenCanvas = canvas.transferControlToOffscreen();

const worker = new Worker(new URL('./offscreen-instance-worker.js', import.meta.url), {
    type: 'module',
});

worker.postMessage({ canvas: offscreenCanvas }, [offscreenCanvas]);

window.addEventListener('resize', () => {
    worker.postMessage({
        resize: { width: canvas.clientWidth, height: canvas.clientHeight },
    });
});

// The <canvas> itself was transferred to the Worker for drawing, but it's still a live,
// listenable DOM element on this thread. three.js's control classes (MapControls, OrbitControls,
// etc.) need DOM APIs (setPointerCapture, getBoundingClientRect) that don't exist on an
// OffscreenCanvas, so they can't run inside the Worker; instead, a normal, unmodified MapControls
// drives a plain, disconnected camera here, and its transform is mirrored into the Worker's real
// camera whenever it changes. This is intentionally one-directional: no picking/hover feedback
// comes back from the Worker.
const camera = new PerspectiveCamera(30, canvas.clientWidth / canvas.clientHeight);
// Giro3D scenes are Z-up (InstanceBase sets Object3D.DEFAULT_UP accordingly), but that only
// affects objects created inside the Worker's own 'three' module instance, a separate realm
// from this thread's. MapControls reads object.up once, at construction, to orient its internal
// spherical math; left at the Y-up default, it orbits around the wrong axis, snapping the view
// every time a drag starts.
camera.up.set(0, 0, 1);
camera.position.set(8, 0, 3.5);
camera.lookAt(1, 0, 1.2);

const controls = new MapControls(camera, canvas);
controls.target.set(1, 0, 1.2);

function sendCameraTransformToWorker() {
    worker.postMessage({
        cameraTransform: {
            position: camera.position.toArray(),
            quaternion: camera.quaternion.toArray(),
        },
    });
}

controls.addEventListener('change', sendCameraTransformToWorker);

// Send the initial camera transform too: this thread's camera is the single source of truth,
// so the Worker doesn't need to set up one of its own (see offscreen-instance-worker.js).
sendCameraTransformToWorker();
