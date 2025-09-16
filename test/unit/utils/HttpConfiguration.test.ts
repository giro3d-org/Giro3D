/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import HttpConfiguration from '@giro3d/giro3d/utils/HttpConfiguration';
import { beforeEach, describe, expect, it } from 'vitest';

beforeEach(() => {
    HttpConfiguration.clear();
});

describe('setOptions', () => {
    it('should set the correct option', () => {
        HttpConfiguration.setOptions('https://example.com', { credentials: 'include' });
        HttpConfiguration.setOptions('https://example.com/OMIT', { credentials: 'omit' });

        const not = 'https://example.org';

        const root = 'https://example.com';
        const omit = 'https://example.com/OMIT';
        const include = 'https://example.com/INCLUDE';

        const notOpts = HttpConfiguration.applyConfiguration(not);
        const rootOpts = HttpConfiguration.applyConfiguration(root)!;
        const includeOpts = HttpConfiguration.applyConfiguration(include)!;
        const omitOpts = HttpConfiguration.applyConfiguration(omit, {})!;

        expect(notOpts).toBeUndefined();
        expect(rootOpts.credentials).toEqual('include');
        expect(includeOpts.credentials).toEqual('include');
        expect(omitOpts.credentials).toEqual('omit');
    });

    it('should have lower precedence than setHeader()', () => {
        HttpConfiguration.setHeader('https://example.com', 'CUSTOMHEADER', 'bar');

        HttpConfiguration.setOptions('https://example.com', {
            headers: { CUSTOMHEADER: 'foo' },
        });

        const root = 'https://example.com';

        const options = HttpConfiguration.applyConfiguration(root)!;

        expect((options.headers as Record<string, string>)['CUSTOMHEADER']).toEqual('bar');
    });
});

describe('setHeader', () => {
    it('should set the correct entry', () => {
        HttpConfiguration.setHeader('https://example.com', 'Authorization', 'Bearer foo');

        const not = 'https://example.org';

        const root = 'https://example.com';
        const foo = 'https://example.com/foo';
        const foobar = 'https://example.com/foo/bar';

        const notOpts = HttpConfiguration.applyConfiguration(not);
        const rootOpts = HttpConfiguration.applyConfiguration(root)!;
        const fooOpts = HttpConfiguration.applyConfiguration(foo, {})!;
        const foobarOpts = HttpConfiguration.applyConfiguration(foobar, {})!;

        expect(notOpts).toBeUndefined();
        expect((rootOpts.headers as Record<string, string>).Authorization).toEqual('Bearer foo');
        expect((fooOpts.headers as Record<string, string>).Authorization).toEqual('Bearer foo');
        expect((foobarOpts.headers as Record<string, string>).Authorization).toEqual('Bearer foo');
    });

    it('should return undefined if no configuration applies and no object is passed', () => {
        const output = HttpConfiguration.applyConfiguration('http://nothing.com');

        expect(output).toBeUndefined();
    });

    it('should return the same object that was passed', () => {
        const inputOpts = {};
        const outputOpts = HttpConfiguration.applyConfiguration('http://nothing.com', inputOpts);

        expect(inputOpts).toBe(outputOpts);
    });

    it('should honor precedence of prefixes', () => {
        HttpConfiguration.setHeader(
            'https://example.com/very/specific/prefix',
            'Authorization',
            'HIGH',
        );

        HttpConfiguration.setHeader('https://example.com/lower/prefix', 'Authorization', 'LOW');

        const high = 'https://example.com/very/specific/prefix/resource/foo/bar/baz.html';
        const low = 'https://example.com/lower/prefix/some/resource.html';

        const highOpts = HttpConfiguration.applyConfiguration(high, {})!;
        const lowOpts = HttpConfiguration.applyConfiguration(low, {})!;

        expect((highOpts.headers as Record<string, string>).Authorization).toEqual('HIGH');
        expect((lowOpts.headers as Record<string, string>).Authorization).toEqual('LOW');
    });

    it('should preserve all properties in the passed options', () => {
        const opts = {
            method: 'POST',
            headers: {
                'X-custom': 'yes',
            },
        } as RequestInit;

        HttpConfiguration.setHeader('https://example.com', 'Authorization', 'auth');

        HttpConfiguration.applyConfiguration('https://example.com', opts);

        expect(opts.method).toEqual('POST');
        expect((opts.headers as Record<string, string>)['X-custom']).toEqual('yes');
        expect((opts.headers as Record<string, string>).Authorization).toEqual('auth');
    });

    it('should respect existing configuration without overriding it', () => {
        HttpConfiguration.setHeader('https://example.com', 'Authorization', 'DO_NOT_USE_THIS');

        const opts = {
            headers: {
                Authorization: 'USE_THIS_INSTEAD',
            },
        };

        HttpConfiguration.applyConfiguration('https://example.com', opts);

        expect(opts.headers.Authorization).toEqual('USE_THIS_INSTEAD');
    });
});
