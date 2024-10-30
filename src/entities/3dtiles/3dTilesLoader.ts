import { LoaderUtils } from 'three';
import PointCloud from '../../core/PointCloud';
import B3dmParser from '../../parser/B3dmParser';
import PntsParser from '../../parser/PntsParser';
import PointCloudMaterial from '../../renderer/PointCloudMaterial';
import utf8Decoder from '../../utils/Utf8Decoder';
import type Tiles3D from '../Tiles3D';
import type { $3dTilesTileset } from './types';

async function b3dmToMesh(data: ArrayBuffer, entity: Tiles3D, url: string) {
    const urlBase = LoaderUtils.extractUrlBase(url);
    const options = {
        gltfUpAxis: entity.asset.gltfUpAxis,
        urlBase,
    };
    const result = await B3dmParser.parse(data, options);
    const { batchTable } = result;
    const object3d = result.gltf.scene;
    return { batchTable, object3d };
}

async function pntsParse(data: ArrayBuffer, entity: Tiles3D) {
    const result = await PntsParser.parse(data);
    const material = entity.material
        ? (entity.material as PointCloudMaterial).clone()
        : new PointCloudMaterial();

    // creation points with geometry and material
    const points = new PointCloud({
        geometry: result.point.geometry,
        material,
        textureSize: entity.imageSize,
    });
    if (result.point.offset) {
        points.position.copy(result.point.offset);
    }
    return { object3d: points };
}

async function jsonParse(data: ArrayBuffer, entity: Tiles3D, url: string) {
    const newTileset = JSON.parse(utf8Decoder.decode(new Uint8Array(data))) as $3dTilesTileset;
    const newPrefix = url.slice(0, url.lastIndexOf('/') + 1);
    return { newTileset, newPrefix };
}

export default {
    b3dmToMesh,
    pntsParse,
    jsonParse,
};
