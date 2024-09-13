import { Box3, Object3D, Sphere, Vector3, type Camera as ThreeCamera } from 'three';
import ScreenSpaceError from '../../core/ScreenSpaceError';
import type { BatchTable } from '../../parser/BatchTableParser';
import type View from '../../renderer/View';
import { type ProcessedTile } from './3dTilesIndex';
import { type BoundingVolume } from './BoundingVolume';

const tmp = {
    v: new Vector3(),
    b: new Box3(),
    s: new Sphere(),
};

/**
 * Represents a tile from a {@link Tiles3D} object.
 */
class Tile extends Object3D {
    /** Read-only flag to check if a given object is of type Tile. */
    readonly isTile: boolean = true;
    /** Parent tile */
    // eslint-disable-next-line no-use-before-define
    parent: Tile | null = null;
    geometricError: number;
    tileId: number;
    additiveRefinement: boolean;
    viewerRequestVolume?: BoundingVolume;
    boundingVolume: BoundingVolume;
    distance: { min: number; max: number };
    content?: Object3D;
    batchTable?: BatchTable;
    // eslint-disable-next-line no-use-before-define
    children: Tile[] = [];
    pendingSubdivision?: boolean;
    deleted?: number;
    cleanableSince?: number;
    sse?: number;

    constructor(metadata: ProcessedTile, parent?: Tile) {
        super();
        this.name = '3D tile';
        this.frustumCulled = false;

        // parse metadata
        if (metadata.transformMatrix != null) {
            this.applyMatrix4(metadata.transformMatrix);
        }
        this.geometricError = metadata.geometricError;
        this.tileId = metadata.tileId;
        if (metadata.refine) {
            this.additiveRefinement = metadata.refine.toUpperCase() === 'ADD';
        } else {
            this.additiveRefinement = parent ? parent.additiveRefinement : false;
        }
        this.viewerRequestVolume = metadata.viewerRequestVolumeObject;
        this.boundingVolume = metadata.boundingVolumeObject;
        if (metadata.boundingVolumeObject.region) {
            this.add(metadata.boundingVolumeObject.region);
        }
        this.distance = { min: 0, max: 0 };
        this.updateMatrixWorld();
        this.userData.metadata = metadata;
    }

    getChildTiles(): Tile[] {
        // only keep children that have the same layer and a valid tileId
        return this.children.filter(n => n.isTile && n.tileId);
    }

    computeNodeSSE(view: View): number {
        if (this.boundingVolume.region) {
            throw new Error('boundingVolume.region is unsupported');
        } else if (this.boundingVolume.box) {
            const sse = ScreenSpaceError.computeFromBox3(
                view,
                this.boundingVolume.box,
                this.matrixWorld,
                this.geometricError,
                ScreenSpaceError.Mode.MODE_3D,
            );

            if (!sse) {
                return Infinity;
            }
            return Math.max(sse.lengths.x, sse.lengths.y);
        } else if (this.boundingVolume.sphere) {
            // TODO this is broken
            if (this.distance.max === 0) {
                // This test is needed in case geometricError = distance = 0
                return Infinity;
            }
            return view.preSSE * (this.geometricError / this.distance.max);
        } else {
            // TODO invalid tileset, should we throw?
            return Infinity;
        }
    }

    setDisplayed(display: boolean): void {
        // The geometry of the tile is not in node, but in node.content
        // To change the display state, we change node.content.visible instead of
        // node.material.visible
        if (this.content) {
            this.content.visible = display;
        }
    }

    calculateCameraDistance(camera: ThreeCamera): void {
        this.distance.min = 0;
        this.distance.max = 0;
        if (this.boundingVolume.region) {
            throw new Error('boundingVolume.region is unsupported');
        } else if (this.boundingVolume.box) {
            // boundingVolume.box is affected by matrixWorld
            tmp.b.copy(this.boundingVolume.box);
            tmp.b.applyMatrix4(this.matrixWorld);
            this.distance.min = tmp.b.distanceToPoint(camera.position);
            // this overestimates the distance a bit
            // it's ok because what we *don't* want is underestimating it
            // and this keeps the calculus fast
            // Maybe we could make it more precise in the future, if big
            // bounding boxes causes trouble
            // with the far plane (but I don't really expect it to do so)
            this.distance.max = this.distance.min + tmp.b.getSize(tmp.v).length();
        } else if (this.boundingVolume.sphere) {
            // boundingVolume.sphere is affected by matrixWorld
            tmp.s.copy(this.boundingVolume.sphere);
            tmp.s.applyMatrix4(this.matrixWorld);
            // TODO: this probably assumes that the camera has no parent
            this.distance.min = Math.max(0.0, tmp.s.distanceToPoint(camera.position));
            this.distance.max = this.distance.min + 2 * tmp.s.radius;
        }
    }

    markForDeletion() {
        this.cleanableSince = Date.now();
    }

    unmarkForDeletion() {
        this.cleanableSince = undefined;
    }
}

export default Tile;
