import PanoramaTileGeometryBuilder from '@giro3d/giro3d/entities/tiles/PanoramaTileGeometryBuilder';
import { Vector2 } from 'three';
import { describe, expect, it } from 'vitest';

describe('rootTileMatrix', () => {
    it('should return 4x2', () => {
        const builder = new PanoramaTileGeometryBuilder(10, 32);
        expect(builder.rootTileMatrix).toEqual(new Vector2(4, 2));
    });
});
