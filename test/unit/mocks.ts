export const resizeObservers: ResizeObserver[] = [];

class ResizeObserverMock {
    readonly observe: jest.Mock;
    readonly unobserve: jest.Mock;
    readonly disconnect: jest.Mock;

    constructor() {
        this.observe = jest.fn();
        this.unobserve = jest.fn();
        this.disconnect = jest.fn();

        resizeObservers.push(this as ResizeObserver);
    }
}

/**
 * Setups the global scope mocks necessary for some unit tests that interacts
 * with the `window` object.
 */
export function setupGlobalMocks() {
    window.ResizeObserver = ResizeObserverMock;
    window.fetch = jest.fn();
}
