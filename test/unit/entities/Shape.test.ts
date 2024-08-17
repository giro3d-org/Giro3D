import Shape from '@giro3d/giro3d/entities/Shape';

describe('Shape', () => {
    describe('constructor', () => {
        it('should assign id and object3d', () => {
            const shape = new Shape();
            expect(shape.object3d).toBeDefined();
            expect(shape.object3d.type).toEqual('Group');
        });
    });
});
