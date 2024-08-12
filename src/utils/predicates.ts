import type { BufferGeometry, Mesh, Texture } from 'three';

export function isMesh(obj: unknown): obj is Mesh {
    return (obj as Mesh)?.isMesh;
}

export function isBufferGeometry(obj: unknown): obj is BufferGeometry {
    return (obj as BufferGeometry)?.isBufferGeometry;
}

export function isTexture(obj: unknown): obj is Texture {
    return (obj as Texture)?.isTexture;
}
