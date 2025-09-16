/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';

import MaterialUtils from '@giro3d/giro3d/renderer/MaterialUtils';

type MockMaterial = { defines: { FOO?: 1 }; needsUpdate: boolean };

describe('setDefine', () => {
    let material: MockMaterial;

    beforeEach(() => {
        material = { defines: {}, needsUpdate: false };
    });

    it('should set the define value to 1 if condition is true', () => {
        MaterialUtils.setDefine(material, 'FOO', true);

        expect(material.defines.FOO).toEqual(1);
    });

    it('should remove the define value if condition is false', () => {
        material.defines.FOO = 1;

        MaterialUtils.setDefine(material, 'FOO', false);
        expect(material.defines.FOO).toBeUndefined();
    });

    it('should set needsUpdate to true if the value has changed', () => {
        MaterialUtils.setDefine(material, 'FOO', true);
        expect(material.needsUpdate).toEqual(true);

        material.needsUpdate = false;

        MaterialUtils.setDefine(material, 'FOO', true);
        expect(material.needsUpdate).toEqual(false);
    });
});

describe('setDefineValue', () => {
    let material: MockMaterial;

    beforeEach(() => {
        material = { defines: {}, needsUpdate: false };
    });

    it('should set the define value to 1 if condition is true', () => {
        MaterialUtils.setDefineValue(material, 'FOO', 5);

        expect(material.defines.FOO).toEqual(5);
    });

    it('should remove the define value if condition is false', () => {
        material.defines.FOO = 1;

        MaterialUtils.setDefineValue(material, 'FOO', undefined);
        expect(material.defines.FOO).toBeUndefined();
    });

    it('should set needsUpdate to true if the value has changed', () => {
        MaterialUtils.setDefineValue(material, 'FOO', 3);
        expect(material.needsUpdate).toEqual(true);

        material.needsUpdate = false;

        MaterialUtils.setDefineValue(material, 'FOO', 3);
        expect(material.needsUpdate).toEqual(false);
    });
});
