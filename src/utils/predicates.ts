import type {
    Box3,
    BufferGeometry,
    CanvasTexture,
    ColorRepresentation,
    DataTexture,
    Euler,
    Light,
    Material,
    Matrix3,
    Matrix4,
    Mesh,
    Object3D,
    OrthographicCamera,
    PerspectiveCamera,
    Quaternion,
    RenderTarget,
    ShaderMaterial,
    Texture,
    Vector2,
    Vector3,
    Vector4,
} from 'three';
import { Color } from 'three';
import type { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export function has<T>(obj: unknown, prop: keyof T): obj is T {
    if (obj == null) {
        return false;
    }
    return (obj as T)[prop] !== undefined;
}

export const isObject = (obj: unknown): obj is object => obj != null && typeof obj === 'object';

export function isObject3D(obj: unknown): obj is Object3D {
    return isObject(obj) && (obj as Object3D).isObject3D === true;
}
export function isMesh(obj: unknown): obj is Mesh {
    return isObject(obj) && (obj as Mesh).isMesh === true;
}
export function isLight(obj: unknown): obj is Light {
    return isObject(obj) && (obj as Light).isLight === true;
}
export function isBufferGeometry(obj: unknown): obj is BufferGeometry {
    return isObject(obj) && (obj as BufferGeometry).isBufferGeometry === true;
}
export function isTexture(obj: unknown): obj is Texture {
    return isObject(obj) && (obj as Texture).isTexture === true;
}
export function isQuaternion(obj: unknown): obj is Quaternion {
    return isObject(obj) && (obj as Quaternion).isQuaternion === true;
}
export function isEuler(obj: unknown): obj is Euler {
    return isObject(obj) && (obj as Euler).isEuler === true;
}
export function isMatrix3(obj: unknown): obj is Matrix3 {
    return isObject(obj) && (obj as Matrix3).isMatrix3 === true;
}
export function isMatrix4(obj: unknown): obj is Matrix4 {
    return isObject(obj) && (obj as Matrix4).isMatrix4 === true;
}
export function isRenderTarget(obj: unknown): obj is RenderTarget {
    return isObject(obj) && (obj as RenderTarget).isRenderTarget === true;
}
export function isDataTexture(obj: unknown): obj is DataTexture {
    return isObject(obj) && (obj as DataTexture).isDataTexture === true;
}
export function isCanvasTexture(obj: unknown): obj is CanvasTexture {
    return isObject(obj) && (obj as CanvasTexture).isCanvasTexture === true;
}
export function isPerspectiveCamera(obj: unknown): obj is PerspectiveCamera {
    return isObject(obj) && (obj as PerspectiveCamera).isPerspectiveCamera === true;
}
export function isOrthographicCamera(obj: unknown): obj is OrthographicCamera {
    return isObject(obj) && (obj as OrthographicCamera).isOrthographicCamera === true;
}
export function isMaterial(obj: unknown): obj is Material {
    return isObject(obj) && (obj as Material).isMaterial === true;
}
export function isColor(obj: unknown): obj is Color {
    return isObject(obj) && (obj as Color).isColor === true;
}
export function isVector2(obj: unknown): obj is Vector2 {
    return isObject(obj) && (obj as Vector2).isVector2 === true;
}
export function isVector3(obj: unknown): obj is Vector3 {
    return isObject(obj) && (obj as Vector3).isVector3 === true;
}
export function isVector4(obj: unknown): obj is Vector4 {
    return isObject(obj) && (obj as Vector4).isVector4 === true;
}
export function isBox3(obj: unknown): obj is Box3 {
    return isObject(obj) && (obj as Box3).isBox3 === true;
}
export function isFiniteNumber(obj: unknown): obj is number {
    if (typeof obj === 'number' && Number.isFinite(obj)) {
        return true;
    }

    return false;
}
export function getColor(input: ColorRepresentation): Color {
    if (isColor(input)) {
        return input;
    }

    return new Color(input);
}

export function isShaderMaterial(obj: unknown): obj is ShaderMaterial {
    return isObject(obj) && (obj as ShaderMaterial).isShaderMaterial === true;
}

export function isCSS2DObject(obj: unknown): obj is CSS2DObject {
    // @ts-expect-error property not present in types
    return isObject(obj) && (obj as CSS2DObject).isCSS2DObject === true;
}
