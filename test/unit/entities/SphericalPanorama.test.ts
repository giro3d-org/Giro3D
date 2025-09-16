/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Euler, MathUtils, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem';
import SphericalPanorama from '@giro3d/giro3d/entities/SphericalPanorama';

describe('setOrientation', () => {
    it('should reset orientation if no parameters are provided', () => {
        const panorama = new SphericalPanorama();

        // @ts-expect-error private property
        panorama._instance = { coordinateSystem: CoordinateSystem.epsg3857 };

        panorama.object3d.quaternion.set(1, 2, 3, 4);

        panorama.setOrientation();

        expect(panorama.object3d.quaternion.toArray()).toEqual(new Quaternion().toArray());
    });

    it('should apply heading negatively', () => {
        const panorama = new SphericalPanorama();

        // @ts-expect-error private property
        panorama._instance = { coordinateSystem: CoordinateSystem.epsg3857 };

        panorama.setOrientation({ heading: 15 });

        const expected = new Quaternion().setFromAxisAngle(
            new Vector3(0, 0, 1),
            MathUtils.degToRad(-15),
        );

        expect(panorama.object3d.quaternion.equals(expected)).toEqual(true);
    });

    it('should apply heading, pitch and roll in this order', () => {
        const panorama = new SphericalPanorama();

        const heading = 56;
        const pitch = 21;
        const roll = 45;

        // @ts-expect-error private property
        panorama._instance = { coordinateSystem: CoordinateSystem.epsg3857 };

        panorama.setOrientation({ heading, pitch, roll });

        const expected = new Quaternion().setFromEuler(
            new Euler(
                MathUtils.degToRad(pitch),
                MathUtils.degToRad(roll),
                MathUtils.degToRad(-heading),
                'ZXY',
            ),
        );

        expect(panorama.object3d.quaternion.toArray()).toEqual(expected.toArray());
    });
});
