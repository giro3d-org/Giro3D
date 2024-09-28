import type { BufferGeometry, IUniform, Object3D, WebGLRenderer } from 'three';
import { Material, ShaderMaterial, Texture } from 'three';
import { isBufferGeometry } from '../utils/predicates';
import TextureGenerator from '../utils/TextureGenerator';

export type MemoryUsageReport = {
    cpuMemory: number;
    gpuMemory: number;
};

export type GetMemoryUsageContext = {
    renderer: WebGLRenderer;
    objects: Map<number | string, MemoryUsageReport>;
};

/**
 * Trait of objects that can report their memory usage.
 */
export default interface MemoryUsage {
    /** Readonly flag to indicate that his object implements {@link MemoryUsage}. */
    isMemoryUsage: true;
    /**
     * Returns an approximation of the memory used by this object, in bytes.
     * @param context - The graphics context.
     */
    getMemoryUsage(context: GetMemoryUsageContext): void;
}

export function isMemoryUsage(obj: unknown): obj is MemoryUsage {
    return (obj as MemoryUsage)?.isMemoryUsage ?? false;
}

export function aggregateMemoryUsage(context: GetMemoryUsageContext): MemoryUsageReport {
    let cpuMemory = 0;
    let gpuMemory = 0;

    context.objects.forEach(v => {
        cpuMemory += v.cpuMemory;
        gpuMemory += v.gpuMemory;
    });

    return { gpuMemory, cpuMemory };
}

export const KILOBYTE = 1024;
export const MEGABYTE = 1024 * KILOBYTE;
export const GIGABYTE = 1024 * MEGABYTE;

/**
 * Formats the byte count into a readable string.
 * @param bytes - The number of bytes.
 * @param locale - The locale parameter. Default is the current locale.
 * @returns A formatted string using either the specified locale, or the current locale.
 */
export function format(bytes: number, locale: string | undefined = undefined): string {
    const numberFormat = new Intl.NumberFormat(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
    });

    let unit: string;
    let value: number;
    if (bytes > GIGABYTE) {
        value = bytes / GIGABYTE;
        unit = 'GB';
    } else if (bytes > MEGABYTE) {
        value = bytes / MEGABYTE;
        unit = 'MB';
    } else if (bytes > KILOBYTE) {
        value = bytes / KILOBYTE;
        unit = 'KB';
    } else {
        value = bytes;
        unit = 'B';
    }

    return `${numberFormat.format(value)} ${unit}`;
}

function iterateMaterials(obj: unknown, callback: (material: Material) => void) {
    const withMaterials = obj as { material: Material | Material[] };

    if (withMaterials.material == null) {
        return;
    }

    if (withMaterials.material instanceof Material) {
        callback(withMaterials.material);
    } else if (Array.isArray(withMaterials.material)) {
        for (const m of withMaterials.material) {
            if (m instanceof Material) {
                callback(m);
            }
        }
    }
}

export function getObject3DMemoryUsage(context: GetMemoryUsageContext, object3d: Object3D) {
    if ('geometry' in object3d && isBufferGeometry(object3d.geometry)) {
        getGeometryMemoryUsage(context, object3d.geometry);
    }

    iterateMaterials(object3d, material => {
        getMaterialMemoryUsage(context, material);
    });
}

export function getUniformMemoryUsage(context: GetMemoryUsageContext, uniform: IUniform) {
    const value = uniform.value;

    if (value instanceof Texture) {
        TextureGenerator.getMemoryUsage(context, value);
    }
}

export function getMaterialMemoryUsage(context: GetMemoryUsageContext, material: Material) {
    if (material instanceof ShaderMaterial) {
        for (const uniform of Object.values(material.uniforms)) {
            getUniformMemoryUsage(context, uniform);
        }
    }
    // TODO other kinds of materials
}

export function getGeometryMemoryUsage(context: GetMemoryUsageContext, geometry: BufferGeometry) {
    let bytes = 0;

    for (const attributeName of Object.keys(geometry.attributes)) {
        bytes += geometry.getAttribute(attributeName).array.byteLength;
    }

    if (geometry.index) {
        bytes += geometry.index.array.byteLength;
    }

    context.objects.set(geometry.id, {
        cpuMemory: bytes,
        gpuMemory: bytes,
    });
}
