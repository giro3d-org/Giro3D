import type PickOptions from './PickOptions';
import type PickResult from './PickResult';

/**
 * Interface for {@link entities.Entity3D | Entity3D}s or Object3Ds implementing feature picking.
 *
 * Implementing this enables the object to provide additional data on its picked
 * results via {@link core.Instance.pickObjectsAt | Instance.pickObjectsAt()} with `pickFeatures` option.
 *
 * This interface uses several generic types:
 * - `TFeature` represents the type of additional data on picked results,
 * - `TResult` represents the type of results returned via picking with `pickAt`,
 * - `TOptions` can define additional options for picking directly on this entity
 *   or on its features.
 *
 * In case you are using a different type for `TResult`, you might want to also
 * implement {@link Pickable}.
 *
 * ```js
 * export interface PlyFeature {
 *     color: Color
 * }
 * export class MyMesh extends Mesh implements PickableFeatures<MyFeature> {
 *     public readonly isPickableFeatures = true;
 *     pickFeaturesFrom(pickedResult: PickResult<MyFeature>): MyFeature[] {
 *         if (this.geometry.hasAttribute('color') && pickedResult.face) {
 *             const colors = this.geometry.getAttribute('color').array;
 *             const face = pickedResult.face;
 *
 *             const color = new Color(
 *                 colors[face.a * 3],
 *                 colors[face.a * 3 + 1],
 *                 colors[face.a * 3 + 2]
 *             );
 *             const result = [{ color }];
 *             pickedResult.features = result;
 *             return result;
 *         }
 *
 *         return [];
 *     }
 * }
 * ```
 *
 * ```js
 * export interface IFCFeature {
 *     ifcProperties: IFCProperty[],
 * }
 *
 * export interface IFCPickResult extends PickResult<IFCFeature> {
 *     isIFCPickResult: true;
 *     entity: IfcEntity,
 *     object: FragmentMesh,
 *     features?: IFCFeature[];
 * }
 *
 * export class IfcEntity
 * extends Entity3D
 * implements Pickable<IFCPickResult>, PickableFeatures<IFCFeature, IFCPickResult> {
 *    readonly isIfcEntity = true;
 *    readonly isPickableFeatures = true;
 *
 *    pick(canvasCoords: Vector2, options?: PickObjectsAtOptions): IFCPickResult[] {
 *        return super.pick(canvasCoords, options).map((p) => ({
 *            ...p,
 *            entity: this,
 *            object: p.object as FragmentMesh,
 *            isIFCPickResult: true,
 *        }));
 *    }
 *
 *    pickFeaturesFrom(pickedResult: IFCPickResult): IFCFeature[] {
 *        const mesh = pickedResult.object;
 *        if (mesh.fragment && pickedResult.instanceId != undefined && pickedResult.face) {
 *            ...
 *            const result = [{ itemProperties }];
 *            pickedResult.features = result;
 *            return result;
 *        }
 *        return [];
 *     }
 * }
 * ```
 */
interface PickableFeatures<
    TFeature = unknown,
    TResult extends PickResult<TFeature> = PickResult<TFeature>,
    TOptions extends PickOptions = PickOptions,
> {
    readonly isPickableFeatures: true;

    /**
     * Given a {@link PickResult}, returns and assigns its features.
     *
     * Implementations **must** set `pickedResult.features` to the returned result.
     *
     * @param pickedResult - Picked result
     * @param options - Options
     * @returns Features
     */
    pickFeaturesFrom: (pickedResult: TResult, options?: TOptions) => TFeature[];
}

/**
 * Tests whether an object implements {@link PickableFeatures}.
 *
 * @param obj - Object
 * @returns `true` if the object implements the interface.
 */
export const isPickableFeatures = (obj: unknown): obj is PickableFeatures =>
    (obj as PickableFeatures).isPickableFeatures;

export default PickableFeatures;
