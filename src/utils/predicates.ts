import type { Mesh } from 'three';

export function isMesh(obj: unknown): obj is Mesh {
    return (obj as Mesh)?.isMesh;
}
