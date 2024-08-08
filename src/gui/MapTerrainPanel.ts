import type GUI from 'lil-gui';
import Panel from './Panel';
import type Instance from '../core/Instance';
import type Map from '../entities/Map';
import { MathUtils } from 'three';

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

        this.addController<boolean>(this.map.terrain, 'enabled')
            .name('Deformation')
            .onChange(() => this.notify(map));

        this.addController<boolean>(this.map, 'wireframe')
            .name('Wireframe')
            .onChange(v => this.toggleWireframe(v));

        this.addController<number>(this, 'segments')
            .name('Tile subdivisions')
            .min(2)
            .max(128)
            .onChange(v => this.updateSegments(v));

        this.addController<boolean>(this.map, 'showColliderMeshes')
            .name('Show collider meshes')
            .onChange(() => this.notify());

        this.addController<boolean>(this.map.terrain, 'enableCPUTerrain').name('CPU terrain');

        this.addController<boolean>(this.map.terrain, 'stitching')
            .name('Stitching')
            .onChange(() => this.notify(map));

        this.addController<number>(this.map.geometryPool, 'size').name('Geometry pool');
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

    toggleWireframe(value: boolean) {
        this.map.wireframe = value;
        this.map.traverseTiles(tile => {
            tile.material.wireframe = value;
        });
        this.notify(this.map);
    }
}

export default MapTerrainPanel;
