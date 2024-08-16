import OperationCounter from '@giro3d/giro3d/core/OperationCounter';

describe('OperationCounter', () => {
    let counter: OperationCounter;

    beforeEach(() => {
        counter = new OperationCounter();
    });

    describe('increment', () => {
        it('should set loading to true if it was false', () => {
            expect(counter.loading).toBeFalsy();
            counter.increment();
            expect(counter.loading).toBeTruthy();
            counter.increment();
            expect(counter.loading).toBeTruthy();
        });
    });

    describe('decrement', () => {
        it('should set loading to false if task count reaches zero', () => {
            counter.increment();
            counter.increment();
            counter.increment();

            counter.decrement();
            expect(counter.loading).toBeTruthy();
            counter.decrement();
            expect(counter.loading).toBeTruthy();
            counter.decrement();
            expect(counter.loading).toBeFalsy();
        });

        it('should fire the complete event if the task count reaches zero', () => {
            const listener = jest.fn();
            counter.addEventListener('complete', listener);

            counter.increment();
            counter.increment();
            counter.increment();

            counter.decrement();
            expect(listener).not.toHaveBeenCalled();
            counter.decrement();
            expect(listener).not.toHaveBeenCalled();
            counter.decrement();
            expect(listener).toHaveBeenCalled();
        });
    });

    describe('progress', () => {
        it('should be 1 if no task is pending', () => {
            expect(counter.progress).toEqual(1);

            counter.increment();
            counter.increment();
            counter.decrement();
            counter.increment();
            counter.decrement();
            counter.decrement();

            expect(counter.progress).toEqual(1);
        });

        it('should be zero if no task has been completed', () => {
            counter.increment();
            counter.increment();
            counter.increment();
            counter.increment();

            expect(counter.progress).toEqual(0);
        });

        it('should be the ratio between completed tasks and total tasks', () => {
            const total = 12;
            const completed = 5;

            for (let i = 0; i < total; i++) {
                counter.increment();
            }

            for (let i = 0; i < completed; i++) {
                counter.decrement();
            }

            expect(counter.progress).toEqual(5 / 12);
        });
    });
});
