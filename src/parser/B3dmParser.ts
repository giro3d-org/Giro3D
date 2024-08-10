import type { Group, Material, Mesh, Object3D, RawShaderMaterial } from 'three';
import { Matrix4, MeshLambertMaterial } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import Capabilities from '../core/system/Capabilities';
import shaderUtils from '../renderer/shader/ShaderUtils';
import utf8Decoder from '../utils/Utf8Decoder';
import BatchTableParser, { type BatchTable } from './BatchTableParser';

const matrixChangeUpVectorZtoY = new Matrix4().makeRotationX(Math.PI / 2);
// For gltf rotation
const matrixChangeUpVectorZtoX = new Matrix4().makeRotationZ(-Math.PI / 2);

const glTFLoader = new GLTFLoader();

function filterUnsupportedSemantics(obj: Object3D) {
    // see GLTFLoader GLTFShader.prototype.update function
    const supported = ['MODELVIEW', 'MODELVIEWINVERSETRANSPOSE', 'PROJECTION', 'JOINTMATRIX'];

    const gltfShader = (obj as any).gltfShader;

    if (gltfShader) {
        const names = [];
        // eslint-disable-next-line guard-for-in
        for (const name of Object.keys(gltfShader.boundUniforms)) {
            names.push(name);
        }
        for (const name of names) {
            const { semantic } = gltfShader.boundUniforms[name];
            if (supported.indexOf(semantic) < 0) {
                delete gltfShader.boundUniforms[name];
            }
        }
    }
}
// parse for RTC values
function applyOptionalCesiumRTC(data: ArrayBuffer, gltf: Group) {
    const headerView = new DataView(data, 0, 20);
    const contentArray = new Uint8Array(data, 20, headerView.getUint32(12, true));
    const content = utf8Decoder.decode(new Uint8Array(contentArray));
    const json = JSON.parse(content);
    if (json.extensions && json.extensions.CESIUM_RTC) {
        gltf.position.fromArray(json.extensions.CESIUM_RTC.center);
        gltf.updateMatrixWorld(true);
    }
}

export interface B3dmParserOptions {
    /**
     * embedded glTF model up axis.
     *
     * @defaultValue Y
     */
    gltfUpAxis?: string;
    /** the base url of the b3dm file (used to fetch textures for the embedded glTF model). */
    urlBase: string;
    /**
     * disable patching material with logarithmic depth buffer support.
     *
     * @defaultValue false
     */
    doNotPatchMaterial?: boolean;
    /**
     * override b3dm's embedded glTF materials.
     * If overrideMaterials is a three.js material, it will be the material used to override.
     *
     * @defaultValue false
     */
    overrideMaterials?: boolean | Material;
}

export default {
    /**
     * Parse b3dm buffer and extract Scene and batch table
     *
     * @param buffer - the b3dm buffer.
     * @param options - additional properties.
     * @returns a promise that resolves with an object containig
     * a Scene (gltf) and a batch table (batchTable).
     */
    parse(buffer: ArrayBuffer, options: B3dmParserOptions) {
        const { gltfUpAxis } = options;
        const { urlBase } = options;
        if (!buffer) {
            throw new Error('No array buffer provided.');
        }

        const view = new DataView(buffer, 4); // starts after magic

        let byteOffset = 0;
        const b3dmHeader: any = {};

        // Magic type is unsigned char [4]
        b3dmHeader.magic = utf8Decoder.decode(new Uint8Array(buffer, 0, 4));
        if (b3dmHeader.magic) {
            // Version, byteLength, batchTableJSONByteLength, batchTableBinaryByteLength and
            // batchTable types are uint32
            b3dmHeader.version = view.getUint32(byteOffset, true);
            byteOffset += Uint32Array.BYTES_PER_ELEMENT;

            b3dmHeader.byteLength = view.getUint32(byteOffset, true);
            byteOffset += Uint32Array.BYTES_PER_ELEMENT;

            b3dmHeader.FTJSONLength = view.getUint32(byteOffset, true);
            byteOffset += Uint32Array.BYTES_PER_ELEMENT;

            b3dmHeader.FTBinaryLength = view.getUint32(byteOffset, true);
            byteOffset += Uint32Array.BYTES_PER_ELEMENT;

            b3dmHeader.BTJSONLength = view.getUint32(byteOffset, true);
            byteOffset += Uint32Array.BYTES_PER_ELEMENT;

            b3dmHeader.BTBinaryLength = view.getUint32(byteOffset, true);
            byteOffset += Uint32Array.BYTES_PER_ELEMENT;

            const promises = [];
            // Parse batch table
            if (b3dmHeader.BTJSONLength > 0) {
                // sizeBegin in the index where the batch table starts. 28
                // is the byte length of the b3dm header
                const sizeBegin = 28 + b3dmHeader.FTJSONLength + b3dmHeader.FTBinaryLength;
                promises.push(
                    BatchTableParser.parse(
                        buffer.slice(sizeBegin, b3dmHeader.BTJSONLength + sizeBegin),
                    ),
                );
            } else {
                promises.push(Promise.resolve({}));
            }
            // TODO: missing feature table
            promises.push(
                new Promise(resolve => {
                    const onerror = (error: ErrorEvent) => console.error(error);
                    const onload = (gltf: GLTF) => {
                        for (const scene of gltf.scenes) {
                            scene.traverse(filterUnsupportedSemantics);
                        }
                        // Rotation managed
                        if (gltfUpAxis === undefined || gltfUpAxis === 'Y') {
                            gltf.scene.applyMatrix4(matrixChangeUpVectorZtoY);
                        } else if (gltfUpAxis === 'X') {
                            gltf.scene.applyMatrix4(matrixChangeUpVectorZtoX);
                        }

                        // RTC managed
                        applyOptionalCesiumRTC(
                            buffer.slice(
                                28 +
                                    b3dmHeader.FTJSONLength +
                                    b3dmHeader.FTBinaryLength +
                                    b3dmHeader.BTJSONLength +
                                    b3dmHeader.BTBinaryLength,
                            ),
                            gltf.scene,
                        );

                        const initMesh = function initFn(mesh: Mesh) {
                            mesh.frustumCulled = false;
                            if (!mesh.material || Array.isArray(mesh.material)) {
                                return;
                            }
                            if (options.overrideMaterials) {
                                mesh.material.dispose();
                                if (
                                    typeof options.overrideMaterials === 'object' &&
                                    options.overrideMaterials.isMaterial
                                ) {
                                    mesh.material = options.overrideMaterials.clone();
                                } else {
                                    mesh.material = new MeshLambertMaterial({ color: 0xffffff });
                                }
                            } else if (
                                Capabilities.isLogDepthBufferSupported() &&
                                (mesh.material as RawShaderMaterial).isRawShaderMaterial &&
                                !options.doNotPatchMaterial
                            ) {
                                shaderUtils.patchMaterialForLogDepthSupport(
                                    mesh.material as RawShaderMaterial,
                                );
                                console.warn(
                                    'b3dm shader has been patched to add log depth buffer support',
                                );
                            }
                        };
                        gltf.scene.traverse(initMesh);

                        resolve(gltf);
                    };

                    const gltfBuffer = buffer.slice(
                        28 +
                            b3dmHeader.FTJSONLength +
                            b3dmHeader.FTBinaryLength +
                            b3dmHeader.BTJSONLength +
                            b3dmHeader.BTBinaryLength,
                    );

                    const version = new DataView(gltfBuffer, 0, 20).getUint32(4, true);

                    if (version === 1) {
                        console.error('GLTF version 1 is no longer supported');
                    } else {
                        glTFLoader.parse(gltfBuffer, urlBase, onload, onerror);
                    }
                }),
            );
            return Promise.all(promises).then(values => ({
                gltf: values[1] as any,
                batchTable: values[0] as BatchTable,
            }));
        }
        throw new Error('Invalid b3dm file.');
    },
};
