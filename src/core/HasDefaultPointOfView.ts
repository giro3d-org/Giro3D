import type { Camera } from 'three';
import type PointOfView from './PointOfView';

/**
 * Interface for objects that expose a default camera point of view.
 */
interface HasDefaultPointOfView {
    /**
     * Readonly flag to check if a given object implements {@link HasDefaultPointOfView}.
     */
    hasDefaultPointOfView: true;

    /**
     * Returns a {@link PointOfView} that matches this object, or `null` if the
     * point of view could not be computed (e.g if the object is not yet ready),
     * or if the camera is not supported (e.g an orthographic camera might not be supported
     * by all implementations).
     *
     * Note: this point of view is only applicable to the camera that was passed as argument, as long as the
     * camera optical parameters do not change (i.e FOV for perspective cameras, and volume size for orthographic cameras),
     * and as long as the object has not moved.
     * @param params - The parameters.
     */
    getDefaultPointOfView(params: {
        /**
         * The camera to compute the point of view.
         */
        camera: Camera;
    }): Readonly<PointOfView> | null;
}

export default HasDefaultPointOfView;

/**
 * Checks if the object implements {@link HasDefaultPointOfView}.
 */
export function hasDefaultPointOfView(obj: unknown): obj is HasDefaultPointOfView {
    return (obj as HasDefaultPointOfView)?.hasDefaultPointOfView === true;
}
