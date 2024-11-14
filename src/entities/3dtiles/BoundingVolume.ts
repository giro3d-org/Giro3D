import { Box3, Sphere, Vector3, type Matrix4 } from 'three';
import Extent from '../../core/geographic/Extent';
import type OBB from '../../core/OBB';
import type View from '../../renderer/View';
import { type ProcessedTile } from './3dTilesIndex';
import Tile from './Tile';

export interface BoundingVolume {
    region?: OBB; // Not sure about this one
    box?: Box3;
    sphere?: Sphere;
}

const tmp = {
    v: new Vector3(),
    b: new Box3(),
    s: new Sphere(),
};

/**
 * Returns the best fit extent from the volume of the tile.
 *
 * @param crs - The CRS of the target extent.
 * @param volume - The volume of the tile.
 * @param transform - The world matrix of the object.
 * @returns The extent.
 */
export function boundingVolumeToExtent(
    crs: string,
    volume: BoundingVolume,
    transform: Matrix4,
): Extent {
    if (volume.region) {
        throw new Error('boundingVolume.region is not yet supported');
    }
    if (volume.box) {
        const box = tmp.b.copy(volume.box).applyMatrix4(transform);
        return Extent.fromBox3(crs, box);
    }
    if (volume.sphere) {
        const sphere = tmp.s.copy(volume.sphere).applyMatrix4(transform);
        return new Extent(crs, {
            west: sphere.center.x - sphere.radius,
            east: sphere.center.x + sphere.radius,
            south: sphere.center.y - sphere.radius,
            north: sphere.center.y + sphere.radius,
        });
    }

    throw new Error('the volume property does not have neither a box, a region or a volume');
}

/**
 * Returns the Box3 equivalent of the bounding volume.
 *
 * @param volume - The bounding volume of the tile.
 * @param transform - The world matrix of the object.
 */
export function boundingVolumeToBox3(volume: BoundingVolume, transform: Matrix4): Box3 {
    if (volume.region) {
        throw new Error('boundingVolume.region is not yet supported');
    }
    if (volume.box) {
        const box = tmp.b.copy(volume.box).applyMatrix4(transform);
        return box.clone();
    }
    if (volume.sphere) {
        const sphere = tmp.s.copy(volume.sphere).applyMatrix4(transform);
        return sphere.getBoundingBox(new Box3());
    }

    throw new Error('the volume property does not have neither a box, a region or a volume');
}

export function cullingTestViewer(
    boundingVolume: BoundingVolume,
    camera: View,
    tileMatrixWorld: Matrix4,
): boolean {
    if (boundingVolume.region) {
        // TODO
        return true;
    }
    if (boundingVolume.box) {
        // TODO
        return true;
    }
    if (boundingVolume.sphere) {
        // To check the distance between the center sphere and the camera
        tmp.s.copy(boundingVolume.sphere);
        tmp.s.applyMatrix4(tileMatrixWorld);
        if (!(camera.camera.position.distanceTo(tmp.s.center) <= tmp.s.radius)) {
            return true;
        }
    }

    return false;
}

export function cullingTestBoundingVolume(
    boundingVolume: BoundingVolume,
    camera: View,
    tileMatrixWorld: Matrix4,
): boolean {
    if (boundingVolume.region) {
        return !camera.isBox3Visible(
            boundingVolume.region.box3D,
            tileMatrixWorld.clone().multiply(boundingVolume.region.matrix),
        );
    }
    if (boundingVolume.box) {
        return !camera.isBox3Visible(boundingVolume.box, tileMatrixWorld);
    }
    if (boundingVolume.sphere) {
        return !camera.isSphereVisible(boundingVolume.sphere, tileMatrixWorld);
    }

    return false;
}

export function cullingTest(
    camera: View,
    node: ProcessedTile | Tile,
    tileMatrixWorld: Matrix4,
): boolean {
    const viewerRequestVolume =
        node instanceof Tile ? node.viewerRequestVolume : node.viewerRequestVolumeObject;
    const boundingVolume = node instanceof Tile ? node.boundingVolume : node.boundingVolumeObject;

    if (viewerRequestVolume) {
        // For viewer Request Volume https://github.com/AnalyticalGraphicsInc/3d-tiles-samples/tree/master/tilesets/TilesetWithRequestVolume
        return cullingTestViewer(viewerRequestVolume, camera, tileMatrixWorld);
    }

    if (boundingVolume != null) {
        return cullingTestBoundingVolume(boundingVolume, camera, tileMatrixWorld);
    }
    return false;
}
