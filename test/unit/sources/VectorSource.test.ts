import VectorSource from '@giro3d/giro3d/sources/VectorSource';
import GeoJSON from 'ol/format/GeoJSON.js';
import { Style } from 'ol/style.js';

describe('VectorSource', () => {
    describe('setStyle', () => {
        let source: VectorSource;

        beforeEach(() => {
            source = new VectorSource({
                data: 'http://example.com/geojson',
                format: new GeoJSON(),
                style: null,
            });
        });

        it('should trigger an update', () => {
            const listener = jest.fn();
            source.addEventListener('updated', listener);

            source.setStyle(() => {
                /** empty */
            });

            expect(listener).toHaveBeenCalled();
        });

        it('should assign the style', () => {
            const style = new Style();
            source.setStyle(style);
            expect(source.style).toBe(style);
        });
    });
});
