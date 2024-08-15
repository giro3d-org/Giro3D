import type {
    BufferGeometry,
    CanvasTexture,
    DataTexture,
    Mesh,
    Object3D,
    RenderTarget,
    Texture,
} from 'three';

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
