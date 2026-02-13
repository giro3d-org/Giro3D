/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { Camera } from 'three';

import { Vector3 } from 'three';

import { isOrthographicCamera, isVector3 } from '../utils/predicates';

/**
 * A point of view generated for a specific camera configuration.
 *
 * Note: this point of view might not be applicable to different camera
 * settings (e.g different field of views, or orthographic sizes).
 */
interface PointOfView {
    /**
     * The location of the point of view.
     */
    origin: Vector3;
    /**
     * The point that this point of view is looking at.
     */
    target: Vector3;
    /**
     * The zoom factor to set to the orthographic camera to fit the object.
     * If the camera is not orthographic, this value is ignored.
     */
    orthographicZoom: number;
}

export function isPointOfView(obj: unknown): obj is PointOfView {
    if (obj != null && typeof obj === 'object') {
        return (
            'origin' in obj &&
            isVector3(obj.origin) &&
            'target' in obj &&
            isVector3(obj.target) &&
            'orthographicZoom' in obj &&
            typeof obj.orthographicZoom === 'number'
        );
    }

    return false;
}

/**
 * Creates an immutable point of view from a camera.
 */
export function createFromCamera(obj: Camera): Readonly<PointOfView> {
    const origin = obj.getWorldPosition(new Vector3());
    const target = origin.clone().add(obj.getWorldDirection(new Vector3()));

    let zoom = 1;
    if (isOrthographicCamera(obj)) {
        zoom = obj.zoom;
    }

    const result: PointOfView = { origin, target, orthographicZoom: zoom };

    return Object.freeze(result);
}

export default PointOfView;
