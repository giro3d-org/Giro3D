import type GUI from 'lil-gui';
import { MathUtils } from 'three';
import type Instance from '../core/Instance';
import type Map from '../entities/Map';
import Panel from './Panel';

class MapTerrainPanel extends Panel {
    map: Map;
    segments = 32;

    /**
     * @param map - The map.
     * @param parentGui - Parent GUI
     * @param instance - The instance
     */
    constructor(map: Map, parentGui: GUI, instance: Instance) {
        super(parentGui, instance, 'Terrain');

        this.map = map;
        this.segments = map.segments;

        this.addController(this.map.terrain, 'enabled')
            .name('Deformation')
            .onChange(() => this.notify(map));

        this.addController(this.map, 'wireframe')
            .name('Wireframe')
            .onChange(() => this.notify());

        this.addController(this, 'segments')
            .name('Tile subdivisions')
            .min(2)
            .max(128)
            .onChange(v => this.updateSegments(v));

        this.addController(this.map, 'showColliderMeshes')
            .name('Show collider meshes')
            .onChange(() => this.notify());

        this.addController(this.map.terrain, 'enableCPUTerrain').name('CPU terrain');

        this.addController(this.map.terrain, 'stitching')
            .name('Stitching')
            .onChange(() => this.notify(map));

        this.addController(this.map.geometryPool, 'size').name('Geometry pool');
    }

    updateSegments(v: number) {
        const val = MathUtils.floorPowerOfTwo(v);
        this.map.segments = val;
        this.segments = val;
        if (this.map.segments !== val) {
            this.map.segments = val;
            this.notify(this.map);
        }
    }
}

export default MapTerrainPanel;
