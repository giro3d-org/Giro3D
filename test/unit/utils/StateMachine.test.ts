/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { beforeEach, describe, expect, it, vitest } from 'vitest';

import StateMachine from '@giro3d/giro3d/utils/StateMachine';

type State = 'start' | 'nope' | 'end';
interface Obj {
    state: State;
}

let sm: StateMachine<State, Obj>;

beforeEach(() => {
    sm = new StateMachine<State, Obj>({
        legalTransitions: [
            ['start', 'end'],
            ['end', 'start'],
        ],
    });
});

describe('transition', () => {
    it('should throw on an illegal transition', () => {
        const value: Obj = { state: 'start' };

        expect(() => sm.transition(value, 'nope')).toThrow(/illegal transition/);
    });

    it('should do nothing if start and end states are the same, except if allowSelfTransition is true', () => {
        const value: Obj = { state: 'start' };
        const callback = vitest.fn();

        sm.addPreTransitionCallback('start', callback);

        const result = sm.transition(value, 'start');

        expect(result).toEqual(false);
        expect(value.state).toEqual('start');
        expect(callback).not.toHaveBeenCalled();

        const result2 = sm.transition(value, 'start', { allowSelfTransition: true });

        expect(result2).toEqual(true);
        expect(value.state).toEqual('start');
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should apply the pre-transition callbacks to the object', () => {
        const endCallback = vitest.fn();
        const startCallback = vitest.fn();

        sm.addPreTransitionCallback('end', endCallback);
        sm.addPreTransitionCallback('start', startCallback);

        const value: Obj = { state: 'start' };

        sm.transition(value, 'end');
        expect(startCallback).toHaveBeenCalledWith({ value, from: 'start', to: 'end' });
        expect(endCallback).not.toHaveBeenCalled();

        sm.transition(value, 'start');

        expect(startCallback).toHaveBeenCalledTimes(1);
        expect(endCallback).toHaveBeenCalledWith({ value, from: 'end', to: 'start' });
    });

    it('should apply the post transition callbacks to the object', () => {
        const endCallback = vitest.fn();
        const startCallback = vitest.fn();

        sm.addPostTransitionCallback('end', endCallback);
        sm.addPostTransitionCallback('start', startCallback);

        const value: Obj = { state: 'start' };

        sm.transition(value, 'end');
        expect(endCallback).toHaveBeenCalledWith({ value, from: 'start', to: 'end' });
        expect(startCallback).not.toHaveBeenCalled();

        sm.transition(value, 'start');

        expect(endCallback).toHaveBeenCalledTimes(1);
        expect(startCallback).toHaveBeenCalledWith({ value, from: 'end', to: 'start' });
    });
});
