import type { Binary, View } from 'copc';
import { Las } from 'copc';
import { Header } from 'copc/lib/las';
import type { BufferAttribute } from 'three';
import { Box3, Float32BufferAttribute, Vector3 } from 'three';
import type { GetMemoryUsageContext } from '../core/MemoryUsage';
import OperationCounter from '../core/OperationCounter';
import { defer } from '../core/RequestQueue';
import Fetcher from '../utils/Fetcher';
import { nonNull } from '../utils/tsutils';
import WorkerPool from '../utils/WorkerPool';
import { getLazPerf } from './las/config';
import createWorker from './las/createWorker';
import type { DimensionName } from './las/dimension';
import { extractAttributes, getDimensionsToRead } from './las/dimension';
import { getPerPointFilters, type DimensionFilter } from './las/filter';
import { createBufferAttribute, readColor, readPosition, readScalarAttribute } from './las/readers';
import type { MessageMap, MessageType } from './las/worker';
import type {
    GetNodeDataOptions,
    PointCloudMetadata,
    PointCloudNode,
    PointCloudNodeData,
} from './PointCloudSource';
import { PointCloudSourceBase } from './PointCloudSource';

export type Getter = () => Promise<Uint8Array>;

/**
 * Inject Fetcher into copc.js to perform range requests.
 */
const getter: (url: string) => Getter = url => {
    return async () => {
        const blob = await Fetcher.blob(url);

        const arrayBuffer = await blob.arrayBuffer();

        return new Uint8Array(arrayBuffer);
    };
};

let pool: WorkerPool<MessageType, MessageMap> | null = null;

async function decodeLazFileSync(data: Uint8Array): Promise<Uint8Array> {
    const lazPerf = await getLazPerf();
    return Las.PointData.decompressFile(data, lazPerf);
}

function decodeLazFileUsingWorker(data: Uint8Array): Promise<Uint8Array> {
    if (pool == null) {
        pool = new WorkerPool({ createWorker });
    }

    return pool
        .queue('DecodeLazFile', { buffer: data.buffer }, [data.buffer])
        .then(res => new Uint8Array(res));
}

export type LASSourceOptions = {
    /**
     * The URL to the remote LAS file, or a function to retrieve the remote file.
     */
    url: string | Getter;
    /**
     * If true, colors are compressed to 8-bit (instead of 16-bit).
     * @defaultValue true
     */
    compressColorsTo8Bit?: boolean;
    /**
     * If specified, will keep every Nth point. For example, a decimation value of 10 will keep
     * one point out of ten, and discard the 9 other points. Useful to reduce memory usage.
     * @defaultValue 1
     */
    decimate?: number;
    /**
     * Enable web workers to perform CPU intensive tasks.
     * @defaultValue true
     */
    enableWorkers?: boolean;
    /**
     * The filters to use.
     */
    filters?: Readonly<DimensionFilter[]>;
};

type PerfOptions = {
    decimate: number;
    enableWorkers: boolean;
    compressColorsToUint8: boolean;
};

/**
 * A source that reads from a LAS or LAZ file.
 *
 * **Note**: if you wish to read Cloud Optimized Point Cloud (COPC) LAZ files, use the COPCSource
 * instead.
 *
 * LAZ decompression is done in background threads using workers. If you wish to disable workers
 * (for a noticeable cost in performance), you can set {@link LASSourceOptions.enableWorkers} to
 * `false` in constructor options.
 *
 * Note: this source uses the **laz-perf** package to perform decoding of point cloud data. This
 * package uses WebAssembly. If you wish to override the path to the required .wasm file, use
 * {@link sources.las.config.setLazPerfPath | setLazPerfPath()} before using this source.
 * The default path is {@link sources.las.config.DEFAULT_LAZPERF_PATH | DEFAULT_LAZPERF_PATH}.
 *
 * ### Supported LAS version
 *
 * This source supports LAS 1.2 and 1.4 only.
 *
 * ### Decimation
 *
 * This source supports decimation. By passing the {@link LASSourceOptions.decimate} argument to
 * a value other than 1, every Nth point will be kept and other points will be discarded during
 * read operations.
 *
 * ### Dimensions filtering
 *
 * This source supports filtering over dimensions (also known as attributes). By providing filters
 * in the form of callback functions to apply to various dimensions, it is possible to eliminate
 * points during reads. For example, it is possible to remove unwanted classifications such as noise
 * from the output points.
 *
 * Note that dimension filtering is independent from the selected attribute. In other words, it is
 * possible to select the dimension `"Intensity"`, while filtering on dimensions `"Classification"`
 * and `"ReturnNumber"` for example.
 *
 * For example, if we wish to remove all points that have the dimension "High noise" (dimension 18
 * in the ASPRS classification list), as well as removing all points whose intensity is lower than
 * 1000:
 *
 * ```ts
 * const source = new LASSource(...);
 *
 * source.filters = [
 *  { dimension: 'Classification', filter: (val) => val !== 18 },
 *  { dimension: 'Intensity', filter: (val) => val >= 1000  },
 * ];
 * ```
 */
export default class LASSource extends PointCloudSourceBase {
    readonly isLASSource = true as const;
    readonly type = 'LASSource' as const;

    private readonly _getter: Getter;
    private readonly _opCounter = new OperationCounter();
    private readonly _filters: DimensionFilter[] = [];
    private readonly _options: PerfOptions = {
        decimate: 1,
        enableWorkers: true,
        compressColorsToUint8: true,
    };

    // Available after initialization
    private _header: Header | null = null;
    private _volume: Box3 | null = null;
    /** The buffer that stores the entire LAS/LAZ file (in compressed form for LAZ files). */
    private _buffer: ArrayBuffer | null = null;

    get loading(): boolean {
        return this._opCounter.loading;
    }

    get progress() {
        return this._opCounter.progress;
    }

    /**
     * Gets or sets the dimension filters.
     * @defaultValue `[]`
     */
    get filters(): Readonly<DimensionFilter[]> {
        return this._filters;
    }

    set filters(v: Readonly<DimensionFilter[]>) {
        this._filters.length = 0;
        this._filters.push(...v);
        this.dispatchEvent({ type: 'updated' });
    }

    constructor(options: LASSourceOptions) {
        super();

        this._opCounter.addEventListener('changed', () => this.dispatchEvent({ type: 'progress' }));

        this._options.compressColorsToUint8 =
            options.compressColorsTo8Bit ?? this._options.compressColorsToUint8;

        this._options.decimate = options.decimate ?? 1;
        if (this._options.decimate < 1) {
            throw new Error('decimate should be at least 1');
        }

        this._options.enableWorkers = options.enableWorkers ?? true;

        if (options.filters != null && options.filters.length > 0) {
            this._filters.push(...options.filters);
        }

        this._getter = typeof options.url === 'string' ? getter(options.url) : options.url;
    }

    protected async initializeOnce(): Promise<this> {
        this._opCounter.increment();

        this._buffer = await this._getter().finally(() => this._opCounter.decrement());

        this._header = Header.parse(new Uint8Array(this._buffer));

        const { min, max } = this._header;

        this._volume = new Box3().set(
            new Vector3(min[0], min[1], min[2]),
            new Vector3(max[0], max[1], max[2]),
        );

        return this;
    }

    private async getView(include?: DimensionName[]): Promise<View> {
        this._opCounter.increment();

        const data = new Uint8Array(nonNull(this._buffer));
        const header = nonNull(this._header);

        let decompressed: Binary;

        if (this._options.enableWorkers === false) {
            decompressed = await decodeLazFileSync(data).finally(() => this._opCounter.decrement());
        } else {
            decompressed = await decodeLazFileUsingWorker(data).finally(() =>
                this._opCounter.decrement(),
            );
        }

        const view = Las.View.create(decompressed, header, undefined, include);

        return view;
    }

    async getMetadata(): Promise<PointCloudMetadata> {
        const { pointCount } = nonNull(this._header, 'not initialized');

        const view = await this.getView();

        const result: PointCloudMetadata = {
            pointCount,
            volume: nonNull(this._volume),
            attributes: extractAttributes(
                view.dimensions,
                nonNull(this._volume),
                this._options.compressColorsToUint8,
                null,
            ),
        };

        return Promise.resolve(result);
    }

    async getHierarchy(): Promise<PointCloudNode> {
        const { min, max, pointCount } = nonNull(this._header, 'not initialized');

        const volume = new Box3().set(
            new Vector3(min[0], min[1], min[2]),
            new Vector3(max[0], max[1], max[2]),
        );

        const uniqueNode: PointCloudNode = {
            depth: 0,
            volume,
            id: 'root',
            hasData: true,
            geometricError: 0,
            center: volume.getCenter(new Vector3()),
            sourceId: this.id,
            pointCount,
        };

        return uniqueNode;
    }

    async getNodeData(params: GetNodeDataOptions): Promise<PointCloudNodeData> {
        const dimensions = getDimensionsToRead(params.attribute, params.position, this._filters);

        const view = await this.getView(dimensions);

        const { min } = nonNull(this._volume);

        const origin = min.clone();

        const stride = this._options.decimate ?? 1;

        const signal = params.signal;

        const filters = getPerPointFilters(this._filters, view);

        const requestedAttribute = params.attribute;
        const compressColors = this._options.compressColorsToUint8;
        let attribute: BufferAttribute | undefined = undefined;

        this._opCounter.increment();
        if (requestedAttribute != null) {
            this._opCounter.increment();
        }

        let positionBuffer: BufferAttribute | undefined = undefined;
        let localBoundingBox: Box3 | undefined = undefined;

        if (params.position) {
            const result = await defer(() => readPosition(view, origin, stride, filters)).finally(
                () => this._opCounter.decrement(),
            );

            positionBuffer = new Float32BufferAttribute(new Float32Array(result.buffer), 3);
            localBoundingBox = result.localBoundingBox;
        }

        if (requestedAttribute != null) {
            let action: () => ArrayBuffer;

            switch (requestedAttribute.interpretation) {
                case 'color':
                    action = () => readColor(view, stride, compressColors, filters);
                    break;
                default:
                    action = () => readScalarAttribute(view, requestedAttribute, stride, filters);
                    break;
            }

            const buffer = await defer(action, signal).finally(() => this._opCounter.decrement());

            attribute = createBufferAttribute(buffer, requestedAttribute, compressColors);
        }

        return Promise.resolve({
            origin,
            pointCount: positionBuffer?.count ?? attribute?.count,
            localBoundingBox,
            position: positionBuffer,
            attribute,
        });
    }

    getMemoryUsage(context: GetMemoryUsageContext): void {
        // We have to store the whole file in memory, since there is no guarantee that the
        // remote server supports range requests (which is a requirement for COPC files for example)
        if (this._buffer != null) {
            context.objects.set(this.id, { cpuMemory: this._buffer.byteLength, gpuMemory: 0 });
        }
    }

    dispose(): void {
        // Nothing to do
    }
}
