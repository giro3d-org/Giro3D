/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import type { Mock } from 'vitest';
import { vitest } from 'vitest';

export const resizeObservers: ResizeObserver[] = [];

class ResizeObserverMock {
    readonly observe: Mock;
    readonly unobserve: Mock;
    readonly disconnect: Mock;

    constructor() {
        this.observe = vitest.fn();
        this.unobserve = vitest.fn();
        this.disconnect = vitest.fn();

        resizeObservers.push(this as ResizeObserver);
    }
}

/**
 * Setups the global scope mocks necessary for some unit tests that interacts
 * with the `window` object.
 */
export function setupGlobalMocks() {
    window.ResizeObserver = ResizeObserverMock;
    window.fetch = vitest.fn();
}
