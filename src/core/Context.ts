import type { Plane } from 'three';
import type View from '../renderer/View';

/**
 * Contains the render/update loop context.
 * Each {@link Entity} being updated is given a
 * context in its update methods.
 * This context can be modified by entities (notably the near and far clipping planes).
 */
interface Context {
    /**
     * The view.
     */
    readonly view: View;
    /**
     * Contains clipping plane distances.
     */
    readonly distance: {
        /**
         * The plane that is normal to the line of sight,
         * and located at the position of the camera
         */
        plane: Plane;
        /** The minimum distance to the camera */
        min: number;
        /** The maximum distance to the camera */
        max: number;
    };
}

export default Context;
