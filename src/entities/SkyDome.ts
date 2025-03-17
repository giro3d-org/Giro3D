import { MathUtils, type Vector3 } from 'three';
import SkyDomeObject from '../renderer/SkyDome';
import Entity3D from './Entity3D';

/**
 * Displays a sky dome with atmospheric scattering and sun disc.
 */
export default class SkyDome extends Entity3D {
    readonly isSkyDome = true as const;
    override readonly type = 'SkyDome' as const;

    private readonly _skyDome: SkyDomeObject;
    private _solarDiscDiameter = 2;

    private set<K extends keyof typeof this._skyDome>(key: K, value: (typeof this._skyDome)[K]) {
        this._skyDome[key] = value;
        this.notifyChange();
    }

    get solarDiscDiameter() {
        return this._solarDiscDiameter;
    }

    /**
     * The apparent diameter of the solar disc, in degrees.
     */
    set solarDiscDiameter(v: number) {
        this._solarDiscDiameter = v;
        const cos = Math.cos(MathUtils.degToRad(v));
        this.set('sunAngularDiameterCos', cos);
    }

    /**
     * The turbidity of the atmosphere. A low turbidity makes the atmosphere appear clearer.
     */
    get turbidity() {
        return this._skyDome.turbidity;
    }

    set turbidity(v: number) {
        this.set('turbidity', v);
    }

    get luminance() {
        return this._skyDome.luminance;
    }

    set luminance(v: number) {
        this.set('luminance', v);
    }

    get rayleighCoefficient() {
        return this._skyDome.rayleighCoefficient;
    }

    set rayleighCoefficient(v: number) {
        this.set('rayleighCoefficient', v);
    }

    get mieCoefficient() {
        return this._skyDome.mieCoefficient;
    }

    set mieCoefficient(v: number) {
        this.set('mieCoefficient', v);
    }

    get mieDirectionalG() {
        return this._skyDome.mieDirectionalG;
    }

    set mieDirectionalG(v: number) {
        this.set('mieDirectionalG', v);
    }

    constructor(params?: { atmosphereThickness?: number }) {
        super(new SkyDomeObject({ atmosphereThickness: params?.atmosphereThickness }));

        this._skyDome = this.object3d as SkyDomeObject;

        this.renderOrder = -9999;
    }

    /**
     * Sets the direction of the sun rays.
     */
    setSunPosition(position: Vector3) {
        this._skyDome.uniforms.sunPosition.value.copy(position);
        this.notifyChange(this);
    }

    override dispose(): void {
        this._skyDome.geometry.dispose();
        this._skyDome.material.dispose();
        this.object3d.clear();
    }

    override pick() {
        return [];
    }
}
