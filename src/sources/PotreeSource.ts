import type { Binary } from 'copc';
import { Las } from 'copc';
import type { BufferAttribute } from 'three';
import {
    Box3,
    Float32BufferAttribute,
    Int16BufferAttribute,
    Int32BufferAttribute,
    Int8BufferAttribute,
    IntType,
    Uint16BufferAttribute,
    Uint32BufferAttribute,
    Uint8BufferAttribute,
    Uint8ClampedBufferAttribute,
    Vector3,
} from 'three';
import { GlobalCache } from '../core/Cache';
import type * as octree from '../core/Octree';
import OperationCounter from '../core/OperationCounter';
import { DefaultQueue } from '../core/RequestQueue';
import Fetcher from '../utils/Fetcher';
import { defined, nonNull } from '../utils/tsutils';
import WorkerPool from '../utils/WorkerPool';
import { getLazPerf } from './las/config';
import createWorker from './las/createWorker';
import { readColor, readPosition, readScalarAttribute } from './las/readers';
import type * as lazWorker from './las/worker';
import type {
    GetNodeDataOptions,
    PointCloudAttribute,
    PointCloudMetadata,
    PointCloudNode,
    PointCloudNodeData,
} from './PointCloudSource';
import { PointCloudSourceBase } from './PointCloudSource';
import type { LazPointCloudAttribute } from './potree/attributes';
import {
    EXPOSED_ATTRIBUTES,
    processAttributes,
    processLazAttributes,
    type PotreePointCloudAttribute,
} from './potree/attributes';
import type { ParseResult } from './potree/bin';
import { readBinFile } from './potree/bin';
import { toBox3 } from './potree/BoundingBox';
import type { Metadata } from './potree/Metadata';
import type * as potreeWorker from './potree/worker';

type NodeInternalData = PointCloudNode & {
    childrenBitField: number;
    baseUrl: string;
};

let potreePool: WorkerPool<potreeWorker.MessageType, potreeWorker.MessageMap> | null = null;
let lazPool: WorkerPool<lazWorker.MessageType, lazWorker.MessageMap> | null = null;

type PotreeNode = octree.Octree<NodeInternalData>;

export type PotreeSourceOptions = {
    /**
     * The URL to the dataset.
     */
    url: string;
    /**
     * Enable web workers to perform CPU intensive tasks.
     * @defaultValue true
     */
    enableWorkers?: boolean;
};

// Create an A(xis)A(ligned)B(ounding)B(ox) for the child `childIndex` of one aabb.
// (PotreeConverter protocol builds implicit octree hierarchy by applying the same
// subdivision algo recursively)
function createChildAABB(aabb: Box3, childIndex: number) {
    // Code taken from potree
    let { min } = aabb;
    let { max } = aabb;
    const dHalfLength = new Vector3().copy(max).sub(min).multiplyScalar(0.5);
    const xHalfLength = new Vector3(dHalfLength.x, 0, 0);
    const yHalfLength = new Vector3(0, dHalfLength.y, 0);
    const zHalfLength = new Vector3(0, 0, dHalfLength.z);

    const cmin = min;
    const cmax = new Vector3().add(min).add(dHalfLength);

    if (childIndex === 1) {
        min = new Vector3().copy(cmin).add(zHalfLength);
        max = new Vector3().copy(cmax).add(zHalfLength);
    } else if (childIndex === 3) {
        min = new Vector3().copy(cmin).add(zHalfLength).add(yHalfLength);
        max = new Vector3().copy(cmax).add(zHalfLength).add(yHalfLength);
    } else if (childIndex === 0) {
        min = cmin;
        max = cmax;
    } else if (childIndex === 2) {
        min = new Vector3().copy(cmin).add(yHalfLength);
        max = new Vector3().copy(cmax).add(yHalfLength);
    } else if (childIndex === 5) {
        min = new Vector3().copy(cmin).add(zHalfLength).add(xHalfLength);
        max = new Vector3().copy(cmax).add(zHalfLength).add(xHalfLength);
    } else if (childIndex === 7) {
        min = new Vector3().copy(cmin).add(dHalfLength);
        max = new Vector3().copy(cmax).add(dHalfLength);
    } else if (childIndex === 4) {
        min = new Vector3().copy(cmin).add(xHalfLength);
        max = new Vector3().copy(cmax).add(xHalfLength);
    } else if (childIndex === 6) {
        min = new Vector3().copy(cmin).add(xHalfLength).add(yHalfLength);
        max = new Vector3().copy(cmax).add(xHalfLength).add(yHalfLength);
    }

    return new Box3(min, max);
}

function createBufferAttribute(buf: ArrayBuffer, attribute: PointCloudAttribute): BufferAttribute {
    if (attribute.interpretation === 'color') {
        return new Uint8ClampedBufferAttribute(new Uint8ClampedArray(buf), 3, true);
    }

    let normalized = false;
    if ('normalized' in attribute) {
        normalized = attribute.normalized as boolean;
    }

    let result: BufferAttribute;

    switch (attribute.size) {
        case 1:
            if (attribute.type === 'signed') {
                result = new Int8BufferAttribute(
                    new Int8Array(buf),
                    attribute.dimension,
                    normalized,
                );
            } else {
                result = new Uint8BufferAttribute(
                    new Uint8Array(buf),
                    attribute.dimension,
                    normalized,
                );
            }
            break;
        case 2:
            if (attribute.type === 'signed') {
                result = new Int16BufferAttribute(
                    new Int16Array(buf),
                    attribute.dimension,
                    normalized,
                );
            } else {
                result = new Uint16BufferAttribute(
                    new Uint16Array(buf),
                    attribute.dimension,
                    normalized,
                );
            }
            break;
        case 4:
            if (attribute.type === 'signed') {
                result = new Int32BufferAttribute(
                    new Int32Array(buf),
                    attribute.dimension,
                    normalized,
                );
            } else if (attribute.type === 'unsigned') {
                result = new Uint32BufferAttribute(
                    new Uint32Array(buf),
                    attribute.dimension,
                    normalized,
                );
            } else {
                result = new Float32BufferAttribute(
                    new Float32Array(buf),
                    attribute.dimension,
                    normalized,
                );
            }
            break;
    }

    if (attribute.type !== 'float') {
        result.gpuType = IntType;
    }

    return result;
}

/**
 * Parse a .hrc file and returns the root node of the hierarchy.
 */
async function parseIndexFile(
    sourceId: string,
    metadata: Metadata,
    node: Partial<PotreeNode>,
): Promise<PotreeNode> {
    const url = `${node.baseUrl}/r${node.id}.hrc`;
    const buf = await Fetcher.arrayBuffer(url);

    const dataView = new DataView(buf);
    const stack: PotreeNode[] = [];
    let offset = 0;

    const id = nonNull(node.id);

    node.childrenBitField = dataView.getUint8(0);
    offset += 1;
    node.pointCount = dataView.getUint32(1, true);
    offset += 4;

    node.children = undefined;

    stack.push(node as PotreeNode);

    while (stack.length && offset < buf.byteLength) {
        const snode = nonNull(stack.shift());
        // look up 8 children
        for (let i = 0; i < 8; i++) {
            // does snode have a #i child ?
            if (snode.childrenBitField & (1 << i) && offset + 5 <= buf.byteLength) {
                const c = dataView.getUint8(offset);
                offset += 1;
                let n = dataView.getUint32(offset, true);
                offset += 4;

                if (n === 0) {
                    n = node.pointCount;
                }

                const childname = snode.id + i;
                const volume: Box3 = createChildAABB(snode.volume, i);

                let url_1 = nonNull(node.baseUrl);

                if (childname.length % metadata.hierarchyStepSize === 0) {
                    const myname = childname.substring(id.length);
                    url_1 = `${node.baseUrl}/${myname}`;
                }

                const depth = snode.depth + 1;

                const item: PotreeNode = {
                    pointCount: n,
                    childrenBitField: c,
                    children: undefined,
                    id: childname,
                    sourceId,
                    baseUrl: url_1,
                    volume,
                    geometricError: metadata.spacing / 2 ** depth,
                    depth,
                    hasData: true,
                    center: volume.getCenter(new Vector3()),
                    parent: snode,
                };
                if (snode.children == null) {
                    snode.children = [
                        undefined,
                        undefined,
                        undefined,
                        undefined,
                        undefined,
                        undefined,
                        undefined,
                        undefined,
                    ];
                }
                nonNull(snode.children)[i] = item;
                stack.push(item);
            }
        }
    }

    return node as PotreeNode;
}

function createPotreeWorker(): Worker {
    const worker = new Worker(new URL('./potree/worker.js', import.meta.url), {
        type: 'module',
    });

    return worker;
}

/**
 * Reads Potree datasets.
 *
 * ## Supported formats
 *
 * This source currently reads legacy Potree datasets (a `cloud.js` files and multiple `.hrc` and
 * data files). Data files may either be in the BIN format or LAZ files.
 *
 * LAZ decompression is done in background threads using workers. If you wish to disable workers
 * (for a noticeable cost in performance), you can set {@link PotreeSourceOptions.enableWorkers} to
 * `false` in constructor options.
 *
 * Note: this source uses the **laz-perf** package to perform decoding of point cloud data. This
 * package uses WebAssembly. If you wish to override the path to the required .wasm file, use
 * {@link sources.las.config.setLazPerfPath | setLazPerfPath()} before using this source.
 * The default path is {@link sources.las.config.DEFAULT_LAZPERF_PATH | DEFAULT_LAZPERF_PATH}.
 */
export default class PotreeSource extends PointCloudSourceBase {
    readonly type = 'PotreeSource' as const;
    readonly isPotreeSource = true as const;

    private readonly _opCounter = new OperationCounter();
    private readonly _options: Required<PotreeSourceOptions>;

    /**  Available after initialization. */
    private _datasetInfo: {
        pointByteSize: number;
        metadata: Metadata;
        attributes: (LazPointCloudAttribute | PotreePointCloudAttribute)[];
        dataFilesExtension: 'bin' | 'laz';
    } | null = null;

    get progress() {
        return this._opCounter.progress;
    }

    get loading() {
        return this._opCounter.loading;
    }

    constructor(options: PotreeSourceOptions) {
        super();

        this._opCounter.addEventListener('changed', () => this.dispatchEvent({ type: 'progress' }));

        const opts = nonNull(options, 'options is undefined');
        this._options = {
            enableWorkers: opts.enableWorkers ?? true,
            url: defined(opts, 'url'),
        };
    }

    protected async initializeOnce(): Promise<this> {
        this._opCounter.increment();

        const metadata = await Fetcher.json<Metadata>(this._options.url).finally(() =>
            this._opCounter.decrement(),
        );

        const sanitizedMetadata = {
            version: defined(metadata, 'version'),
            octreeDir: defined(metadata, 'octreeDir'),
            points: metadata.points,
            hierarchyStepSize: defined(metadata, 'hierarchyStepSize'),
            boundingBox: defined(metadata, 'boundingBox'),
            tightBoundingBox: metadata.tightBoundingBox,
            pointAttributes: defined(metadata, 'pointAttributes'),
            scale: defined(metadata, 'scale'),
            spacing: defined(metadata, 'spacing'),
            projection: metadata.projection,
        };

        let dataFilesExtension: 'bin' | 'laz';
        let pointByteSize = 0;
        let attributes: (LazPointCloudAttribute | PotreePointCloudAttribute)[] = [];

        if (metadata.pointAttributes === 'LAZ') {
            dataFilesExtension = 'laz';
            attributes = processLazAttributes(metadata.tightBoundingBox ?? metadata.boundingBox);
        } else {
            const result = processAttributes(metadata.pointAttributes);
            dataFilesExtension = 'bin';
            pointByteSize = result.pointByteSize;
            attributes = result.attributes;
        }

        this._datasetInfo = {
            metadata: sanitizedMetadata,
            pointByteSize,
            attributes,
            dataFilesExtension,
        };

        return this;
    }

    private async readLazFile(
        buffer: ArrayBuffer,
        node: PotreeNode,
        optionalAttribute?: LazPointCloudAttribute,
    ): Promise<ParseResult> {
        const compressed = new Uint8Array(buffer);
        const header = Las.Header.parse(compressed);

        let decompressed: Binary;
        if (this._options.enableWorkers === false) {
            const lp = await getLazPerf();
            decompressed = await Las.PointData.decompressFile(compressed, lp);
        } else {
            if (lazPool == null) {
                lazPool = new WorkerPool({ createWorker });
            }

            const response = await lazPool.queue('DecodeLazFile', { buffer: compressed.buffer }, [
                compressed.buffer,
            ]);

            decompressed = new Uint8Array(response);
        }

        const view = Las.View.create(decompressed, header);

        const position = readPosition(view, node.volume.min, 1, null);

        let attributeBuffer: BufferAttribute | undefined = undefined;
        if (optionalAttribute != null) {
            if (optionalAttribute.interpretation === 'color') {
                const colorBuffer = readColor(view, 1, true, null);
                attributeBuffer = createBufferAttribute(colorBuffer, optionalAttribute);
            } else {
                const scalarBuffer = readScalarAttribute(view, optionalAttribute, 1, null);
                attributeBuffer = createBufferAttribute(scalarBuffer, optionalAttribute);
            }
        }

        return {
            positionBuffer: {
                array: position.buffer,
                dimension: 3,
                normalized: false,
            },
            localBoundingBox: position.localBoundingBox,
            attributeBuffer: attributeBuffer
                ? {
                      array: attributeBuffer.array,
                      dimension: attributeBuffer.itemSize,
                      normalized: attributeBuffer.normalized,
                  }
                : undefined,
        };
    }

    private async readBinFileSync(
        buffer: ArrayBuffer,
        pointByteSize: number,
        positionAttribute: PotreePointCloudAttribute,
        optionalAttribute?: PotreePointCloudAttribute,
    ) {
        return readBinFile(buffer, pointByteSize, positionAttribute, optionalAttribute);
    }

    private async readBinFile(
        buffer: ArrayBuffer,
        pointByteSize: number,
        positionAttribute: PotreePointCloudAttribute,
        optionalAttribute?: PotreePointCloudAttribute,
    ): Promise<ParseResult> {
        if (this._options.enableWorkers === false) {
            return this.readBinFileSync(
                buffer,
                pointByteSize,
                positionAttribute,
                optionalAttribute,
            );
        } else {
            if (potreePool == null) {
                potreePool = new WorkerPool({ createWorker: createPotreeWorker });
            }

            return potreePool
                .queue(
                    'ReadBinFile',
                    {
                        buffer,
                        info: {
                            pointByteSize,
                            positionAttribute,
                            optionalAttribute,
                        },
                    },
                    [buffer],
                )
                .then(msg => {
                    const parseResult: ParseResult = {
                        positionBuffer: msg.position,
                        attributeBuffer: msg.attribute,
                    };

                    return parseResult;
                });
        }
    }

    private async fetchDataFile(url: string): Promise<ArrayBuffer> {
        let result: ArrayBuffer;

        const cached = GlobalCache.get(url);

        if (cached != null) {
            result = cached as ArrayBuffer;
        } else {
            result = await Fetcher.arrayBuffer(url);
            GlobalCache.set(url, result, { size: result.byteLength });
        }

        return result;
    }

    async getNodeData(params: GetNodeDataOptions): Promise<PointCloudNodeData> {
        const { metadata, dataFilesExtension, pointByteSize, attributes } = nonNull(
            this._datasetInfo,
            'not initialized',
        );

        const node = params.node as PotreeNode;

        // Query HRC if we don't have children metadata yet.
        if (node.childrenBitField && node.children == null) {
            parseIndexFile(this.id, metadata, node);
        }

        const url = `${node.baseUrl}/r${node.id}.${dataFilesExtension}`;

        const signal = params.signal;

        this._opCounter.increment();

        let buffer = await DefaultQueue.enqueue({
            id: url,
            request: () => this.fetchDataFile(url),
            priority: node.depth,
            shouldExecute: () => (signal ? !signal.aborted : true),
        }).finally(() => this._opCounter.decrement());

        if (this._options.enableWorkers) {
            // We have to make a copy because this buffer might be returned more than once by the
            // queue. However since it's going to be transferred to workers, the second time
            // we try to transfer it, it will fail as it will already be transferred.
            buffer = buffer.slice(0);
        }

        signal?.throwIfAborted();

        let result: ParseResult;
        let scale: Vector3 | undefined = undefined;

        this._opCounter.increment();

        switch (dataFilesExtension) {
            case 'bin':
                {
                    scale = new Vector3(metadata.scale, metadata.scale, metadata.scale);
                    const potreeAttrs = attributes as PotreePointCloudAttribute[];
                    result = await this.readBinFile(
                        buffer,
                        pointByteSize,
                        nonNull(potreeAttrs.find(a => a.name === 'POSITION_CARTESIAN')),
                        params.attribute?.name != null
                            ? nonNull(potreeAttrs.find(a => a.name === params.attribute?.name))
                            : undefined,
                    ).finally(() => this._opCounter.decrement());
                }
                break;
            case 'laz':
                {
                    const lazAttrs = attributes as LazPointCloudAttribute[];
                    result = await this.readLazFile(
                        buffer,
                        node,
                        params.attribute?.name != null
                            ? nonNull(lazAttrs.find(a => a.name === params.attribute?.name))
                            : undefined,
                    ).finally(() => this._opCounter.decrement());
                }
                break;
            default:
                throw new Error('not supported data file extension: ' + dataFilesExtension);
        }

        signal?.throwIfAborted();

        const positionBuffer = new Float32BufferAttribute(result.positionBuffer.array, 3, false);
        let attribute: BufferAttribute | undefined = undefined;
        if (params.attribute != null && result.attributeBuffer != null) {
            attribute = createBufferAttribute(result.attributeBuffer.array, params.attribute);
        }

        const localBoundingBox = new Box3().setFromBufferAttribute(positionBuffer);

        return {
            origin: node.volume.min,
            scale,
            localBoundingBox,
            position: positionBuffer,
            pointCount: positionBuffer.count,
            attribute,
        };
    }

    async getHierarchy(): Promise<PointCloudNode> {
        this._opCounter.increment();

        const metadata = nonNull(this._datasetInfo?.metadata, 'not initialized');

        const base = this._options.url.replace('cloud.js', '');
        const baseUrl = `${base}/${metadata.octreeDir}/r`;

        const volume = toBox3(metadata.boundingBox);

        const root = await parseIndexFile(this.id, metadata, {
            sourceId: this.id,
            id: '',
            baseUrl,
            volume,
            hasData: true,
            depth: 0,
            geometricError: metadata.spacing,
            center: volume.getCenter(new Vector3()),
        }).finally(() => this._opCounter.decrement());

        return root;
    }

    dispose(): void {
        // Nothing to do
    }

    getMemoryUsage(): void {
        // Nothing to do
    }

    getMetadata(): Promise<PointCloudMetadata> {
        const { metadata, attributes } = nonNull(this._datasetInfo, 'not initialized');

        const { lx, ly, lz, ux, uy, uz } = metadata.tightBoundingBox ?? metadata.boundingBox;

        const proj = metadata.projection;

        return Promise.resolve({
            volume: new Box3().setFromArray([lx, ly, lz, ux, uy, uz]),
            attributes: attributes.filter(att => EXPOSED_ATTRIBUTES.has(att.name)),
            pointCount: metadata.points,
            crs:
                proj != null && proj.length > 0
                    ? {
                          definition: proj,
                          name: `potree:${this.id}`,
                      }
                    : undefined,
        });
    }
}
