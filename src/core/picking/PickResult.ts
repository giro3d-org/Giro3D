import type Feature from 'ol/Feature';
import type { Intersection, Object3D, Vector3 } from 'three';
import type Entity3D from '../../entities/Entity3D';
import type ColorLayer from '../layer/ColorLayer';

/**
 * Pick result.
 *
 * Provides information from
 * [Three.js raycasting](https://threejs.org/docs/#api/en/core/Raycaster)
 * augmented with Giro3D information.
 *
 * May be extended, depending on what have been picked.
 */
interface PickResult<TFeature = unknown> extends Intersection {
    /** Entity picked */
    entity: Entity3D | null;
    /** Distance from the camera to the picked result. */
    distance: number;
    /** Point picked. */
    point: Vector3;
    /** THREE.js object picked. */
    object: Object3D;
    /** Features picked (if `pickFeatures` enabled). */
    features?: TFeature[];
}

/**
 * Picked vector feature
 *
 * Returned in {@link PickResult} when `pickFeatures` is enabled,
 * on {@link entities.Map} for instance.
 */
export interface VectorPickFeature {
    isVectorPickFeature: true;
    /** Layer within the entity where the feature was picked from */
    layer: ColorLayer;
    /** OpenLayers feature */
    feature: Feature;
}

/**
 * Tests whether an object implements {@link VectorPickFeature}.
 *
 * @param obj - Object
 * @returns `true` if the object implements the interface.
 */
export const isVectorPickFeature = (obj: unknown): obj is VectorPickFeature =>
    (obj as VectorPickFeature).isVectorPickFeature;

export default PickResult;
