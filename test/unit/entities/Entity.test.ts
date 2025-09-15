/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import Entity from '@giro3d/giro3d/entities/Entity';
import { beforeEach, describe, expect, it, vitest } from 'vitest';

let entity: Entity;

beforeEach(() => {
    // @ts-expect-error abstract class
    entity = new Entity();
});

describe('userData', () => {
    it('returns correct values', () => {
        entity.userData.bar = 3;
        entity.userData.foo = 'hello';

        expect(entity.userData.bar).toEqual(3);
        expect(entity.userData.foo).toEqual('hello');
    });
});

describe('constructor', () => {
    it('defines the update, preUpdate, postUpdate methods', () => {
        expect(entity.update).toBeDefined();
        expect(entity.update).not.toThrow();

        expect(entity.preUpdate).toBeDefined();
        expect(entity.preUpdate).not.toThrow();

        expect(entity.postUpdate).toBeDefined();
        expect(entity.postUpdate).not.toThrow();
    });
});

describe('frozen', () => {
    it('should return the value', () => {
        entity.frozen = true;

        expect(entity.frozen).toEqual(true);
    });

    it('should raise an event only if the value has changed', () => {
        const listener = vitest.fn();
        entity.addEventListener('frozen-property-changed', listener);

        entity.frozen = true;
        entity.frozen = true;
        entity.frozen = true;
        expect(listener).toHaveBeenCalledTimes(1);
        entity.frozen = false;
        expect(listener).toHaveBeenCalledTimes(2);
    });
});
