import Extent from '@giro3d/giro3d/core/geographic/Extent';
import OBB from '@giro3d/giro3d/core/OBB';
import proj4 from 'proj4';
import { Matrix4, Vector3 } from 'three';
import { randFloat } from 'three/src/math/MathUtils.js';

describe('OBB', () => {
    it('should correctly instance obb', () => {
        const max = new Vector3(10, 10, 10);
        const min = new Vector3(-10, -10, -10);
        const lookAt = new Vector3(1, 0, 0);
        const translate = new Vector3(0, 0, 20);
        const obb = new OBB(min, max);
        obb.lookAt(lookAt);
        obb.translateX(translate.x);
        obb.translateY(translate.y);
        obb.translateZ(translate.z);
        obb.update();

        expect(obb.natBox.min.x).toEqual(min.x);
        expect(obb.natBox.max.x).toEqual(max.x);
    });
});

// Define projection that we will use (taken from https://epsg.io/3946, Proj4js section)
proj4.defs(
    'EPSG:3946',
    '+proj=lcc +lat_1=45.25 +lat_2=46.75 +lat_0=46 +lon_0=3 +x_0=1700000 +y_0=5200000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
);

function assertVerticesAreInOBB(extent: Extent) {
    const bbox = extent.toBox3(-10, 10);
    const obb = new OBB(bbox.min, bbox.max);
    const inverse = new Matrix4().copy(obb.matrix).invert();

    for (let i = 0; i < 100; i++) {
        const x = randFloat(bbox.min.x, bbox.max.x);
        const y = randFloat(bbox.min.y, bbox.max.y);
        const z = randFloat(bbox.min.z, bbox.max.z);
        const vec = new Vector3(x, y, z);

        vec.applyMatrix4(inverse);
        expect(obb.box3D.containsPoint(vec)).toBe(true);
    }
}

describe('Planar tiles OBB computation', () => {
    it('should compute OBB correctly', () => {
        const extent = new Extent('EPSG:3946', -100, 100, -50, 50);
        assertVerticesAreInOBB(extent);
    });
});
