import type { Vector2 } from 'three';
import type PickOptions from './PickOptions';
import type PickResult from './PickResult';

/**
 * Interface for an {@link entities.Entity3D | Entity3D} that implements picking.
 *
 * By default, Entity3D objects implement picking via Three.js raycasting.
 * Custom entities can implement this interface to provide an alternative picking
 * method via `pickAt`.
 *
 * This interface uses several generic types:
 * - `TResult` represents the type of results returned via picking with `pickAt`,
 * - `TOptions` can define additional options for picking directly on this entity
 *   or on its features.
 */
interface Pickable<
    TResult extends PickResult = PickResult,
    TOptions extends PickOptions = PickOptions,
> {
    readonly isPickable: true;

    /**
     * Picks objects from this entity.
     *
     * Implementations **must** respect at least `limit` and `filter` options.
     *
     * @param canvasCoords -Coordinates on the rendering canvas
     * @param options - Options
     * @param target - Target to fill
     * @returns Target
     */
    pick: (canvasCoords: Vector2, options?: TOptions) => TResult[];
}

/**
 * Tests whether an object implements {@link Pickable}.
 *
 * @param obj - Object
 * @returns `true` if the object implements the interface.
 */
export const isPickable = (obj: unknown): obj is Pickable => (obj as Pickable).isPickable;

export default Pickable;
