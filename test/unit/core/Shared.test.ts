/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { describe, expect, it, vitest } from 'vitest';

import Shared from '@giro3d/giro3d/core/Shared';

interface Payload {
    value: string;
}

class Owner {}

describe('object', () => {
    it('should return the payload object', () => {
        const owner = new Owner();
        const onDispose = () => {};
        const payload = { value: 'hello' };
        const shared = Shared.new<Payload>(payload, owner, onDispose);

        expect(shared.object).toBe(payload);
    });

    it('should throw if the object is disposed', () => {
        const owner = new Owner();
        const onDispose = () => {};
        const payload = { value: 'hello' };
        const shared = Shared.new<Payload>(payload, owner, onDispose);

        shared.dispose();

        expect(() => shared.object).toThrow();
    });
});

describe('owner', () => {
    it('should return the owner object', () => {
        const owner = new Owner();
        const onDispose = () => {};
        const payload = { value: 'hello' };
        const shared = Shared.new<Payload>(payload, owner, onDispose);

        expect(shared.owner).toBe(owner);
    });

    it('should throw if the object is disposed', () => {
        const owner = new Owner();
        const onDispose = () => {};
        const payload = { value: 'hello' };
        const shared = Shared.new<Payload>(payload, owner, onDispose);

        shared.dispose();

        expect(() => shared.owner).toThrow();
    });
});

describe('clone', () => {
    it('should not clone the payload nor owner', () => {
        const owner = new Owner();
        const onDispose = () => {};
        const payload = { value: 'hello' };

        const original = Shared.new<Payload>(payload, owner, onDispose);
        const clone = original.clone();

        expect(original.object).toBe(clone.object);
        expect(original.owner).toBe(clone.owner);
    });
});

describe('dispose', () => {
    it('should call the dispose callback only when all shared instances are disposed', () => {
        const owner = new Owner();
        const onDispose = vitest.fn();
        const payload = { value: 'hello' };

        const original = Shared.new<Payload>(payload, owner, onDispose);
        const clone = original.clone();

        clone.dispose();

        expect(onDispose).not.toHaveBeenCalled();

        // Check idempotence
        original.dispose();
        original.dispose();
        original.dispose();
        original.dispose();
        clone.dispose();
        clone.dispose();
        clone.dispose();
        original.dispose();

        expect(onDispose).toHaveBeenCalledTimes(1);
    });
});
