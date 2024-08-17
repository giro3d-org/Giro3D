import PotreeSource from '@giro3d/giro3d/sources/PotreeSource';

describe('PotreeSource', () => {
    describe('constructor', () => {
        it('should assign default filename if none is provided', () => {
            const source = new PotreeSource('foo');
            expect(source.filename).toBe('cloud.js');
        });

        it('should assign default network options', () => {
            const source = new PotreeSource('foo');
            expect(source.networkOptions).toEqual({});
        });

        it('should assign the url property', () => {
            const source = new PotreeSource('foo');
            expect(source.url).toBe('foo');
        });

        it('should assign the networkOptions property', () => {
            const opts = { foo: 'bar' };
            const source = new PotreeSource('foo', 'bar', opts);
            expect(source.networkOptions).toBe(opts);
        });

        it('should throw if url is not provided', () => {
            expect(() => new PotreeSource(null)).toThrow(/missing url parameter/);
        });
    });
});
