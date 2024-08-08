import Entity from 'src/entities/Entity';

describe('Entity', () => {
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
            const listener = jest.fn();
            entity.addEventListener('frozen-property-changed', listener);

            entity.frozen = true;
            entity.frozen = true;
            entity.frozen = true;
            expect(listener).toHaveBeenCalledTimes(1);
            entity.frozen = false;
            expect(listener).toHaveBeenCalledTimes(2);
        });
    });
});
