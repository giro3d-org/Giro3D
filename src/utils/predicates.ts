import type {
    BufferGeometry,
    CanvasTexture,
    ColorRepresentation,
    DataTexture,
    Light,
    Material,
    Mesh,
    Object3D,
    OrthographicCamera,
    PerspectiveCamera,
    RenderTarget,
    Texture,
    Vector2,
    Vector3,
} from 'three';
import { Color } from 'three';

export function has<T>(obj: unknown, prop: keyof T): obj is T {
    if (obj == null) {
        return false;
    }
    return (obj as T)[prop] !== undefined;
}

export function isObject3D(obj: unknown): obj is Object3D {
    return (obj as Object3D)?.isObject3D;
}
export function isMesh(obj: unknown): obj is Mesh {
    return (obj as Mesh)?.isMesh;
}
export function isLight(obj: unknown): obj is Light {
    return (obj as Light)?.isLight;
}
export function isBufferGeometry(obj: unknown): obj is BufferGeometry {
    return (obj as BufferGeometry)?.isBufferGeometry;
}
export function isTexture(obj: unknown): obj is Texture {
    return (obj as Texture)?.isTexture;
}
export function isRenderTarget(obj: unknown): obj is RenderTarget {
    return (obj as RenderTarget)?.isRenderTarget;
}
export function isDataTexture(obj: unknown): obj is DataTexture {
    return (obj as DataTexture)?.isDataTexture;
}
export function isCanvasTexture(obj: unknown): obj is CanvasTexture {
    return (obj as CanvasTexture)?.isCanvasTexture;
}
export function isPerspectiveCamera(obj: unknown): obj is PerspectiveCamera {
    return (obj as PerspectiveCamera)?.isPerspectiveCamera;
}
export function isOrthographicCamera(obj: unknown): obj is OrthographicCamera {
    return (obj as OrthographicCamera)?.isOrthographicCamera;
}
export function isMaterial(obj: unknown): obj is Material {
    return (obj as Material)?.isMaterial;
}
export function isColor(obj: unknown): obj is Color {
    return (obj as Color)?.isColor;
}
export function isVector2(obj: unknown): obj is Vector2 {
    return (obj as Vector2)?.isVector2;
}
export function isVector3(obj: unknown): obj is Vector3 {
    return (obj as Vector3)?.isVector3;
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
