import { Box3, Vector3 } from 'three';
import type { GetMemoryUsageContext } from '../core/MemoryUsage';
import { nonEmpty, nonNull } from '../utils/tsutils';
import {
    PointCloudSourceBase,
    type GetNodeDataOptions,
    type PointCloudAttribute,
    type PointCloudMetadata,
    type PointCloudNode,
    type PointCloudNodeData,
    type PointCloudSource,
} from './PointCloudSource';

export type AggregatePointCloudSourceOptions = {
    /**
     * The sources to aggregate. Cannot be empty.
     */
    sources: PointCloudSource[];
};

function getAttributeKey(attr: PointCloudAttribute): string {
    return `${attr.name}-${attr.dimension}-${attr.type}-${attr.interpretation}-${attr.size}`;
}

function aggregateAttributes(attr: PointCloudAttribute[]): PointCloudAttribute {
    const { name, dimension, type, interpretation, size } = attr[0];

    let min = +Infinity;
    let max = -Infinity;

    for (let i = 0; i < attr.length; i++) {
        const att = attr[i];

        if (att.min != null) {
            min = Math.min(att.min, min);
        }
        if (att.max != null) {
            max = Math.max(att.max, max);
        }
    }

    return {
        name,
        dimension,
        type,
        size,
        interpretation,
        min: isFinite(min) ? min : undefined,
        max: isFinite(max) ? max : undefined,
    };
}

/**
 * A {@link PointCloudSource} that combines multiple sources.
 *
 * All aspects of the underlying sources are combined in the following way:
 * - volumes are union'ed
 * - point counts are summed
 * - only attributes that are found in *all* sources are exposed.
 */
export default class AggregatePointCloudSource extends PointCloudSourceBase {
    readonly isAggregatePointCloudSource = true as const;
    readonly type = 'AggregatePointCloudSource' as const;

    private readonly _sourceMap: Map<string, PointCloudSource> = new Map();
    private readonly _sources: PointCloudSource[];

    /**
     * The sources in this source.
     */
    get sources() {
        return this._sources;
    }

    constructor(params: AggregatePointCloudSourceOptions) {
        super();

        const sources = nonEmpty(params.sources, 'sources is required');
        this._sources = sources;

        sources.forEach(s => {
            this._sourceMap.set(s.id, s);
            s.addEventListener('progress', () => this.dispatchEvent({ type: 'progress' }));
        });
    }

    protected async initializeOnce(): Promise<this> {
        const promises = this._sources.map(s => {
            const promise = s.initialize();
            return promise;
        });

        const results = await Promise.allSettled(promises);

        const actualSources: PointCloudSource[] = [];

        let notifyWarning = false;

        for (const result of results) {
            if (result.status === 'fulfilled') {
                actualSources.push(result.value);
            } else {
                notifyWarning = true;
            }
        }

        this._sources.length = 0;
        this._sources.push(...actualSources);

        if (notifyWarning) {
            console.warn('one or more sources could not be initialized.');
        }

        return this;
    }

    get loading() {
        return this._sources.some(s => s.loading);
    }

    get progress() {
        let sum = 0;
        let count = 0;
        this._sources.forEach(s => {
            if (s.progress < 1) {
                sum += s.progress;
                count++;
            }
        });

        if (count > 0) {
            return sum / count;
        }

        return 1;
    }

    async getHierarchy(): Promise<PointCloudNode> {
        const allRootNodes = await Promise.all(this._sources.map(s => s.getHierarchy()));

        const volume = new Box3().makeEmpty();
        for (const node of allRootNodes) {
            volume.union(node.volume);
        }

        const pseudoRoot: PointCloudNode = {
            hasData: false,
            volume,
            sourceId: this.id,
            center: volume.getCenter(new Vector3()),
            id: '__pseudoRoot',
            depth: -1,
            children: allRootNodes,
            geometricError: +Infinity,
        };

        return pseudoRoot;
    }

    async getMetadata(): Promise<PointCloudMetadata> {
        const sourceCount = this._sources.length;
        const promises = this._sources.map(s => s.getMetadata());

        const all = await Promise.all(promises);

        let pointCount = 0;
        const volume: Box3 = new Box3().makeEmpty();

        const attributeMap: Map<string, { count: number; attributes: PointCloudAttribute[] }> =
            new Map();

        for (const metadata of all) {
            pointCount += metadata.pointCount ?? 0;

            // Create the union of all volumes
            if (metadata.volume) {
                volume.union(metadata.volume);
            }

            // Create the *intersection* of attributes.
            for (const attribute of metadata.attributes) {
                const key = getAttributeKey(attribute);

                const existing = attributeMap.get(key);

                if (!existing) {
                    attributeMap.set(key, { count: 1, attributes: [attribute] });
                } else {
                    existing.count += 1;
                    existing.attributes.push(attribute);
                }
            }
        }

        // FIXME when Set.prototype.intersection() becomes widely available,
        // use this instead.
        const attributes: PointCloudAttribute[] = [];
        attributeMap.forEach(attr => {
            if (attr.count === sourceCount) {
                attributes.push(aggregateAttributes(attr.attributes));
            }
        });

        return {
            pointCount,
            volume: volume.isEmpty() ? undefined : volume,
            attributes,
        };
    }

    getNodeData(params: GetNodeDataOptions): Promise<PointCloudNodeData> {
        const { node } = params;
        const targetSource = nonNull(this._sourceMap.get(node.sourceId));

        return targetSource.getNodeData(params);
    }

    /**
     * Disposes this source and all underlying sources.
     */
    dispose() {
        this._sources.forEach(s => s.dispose());
    }

    getMemoryUsage(context: GetMemoryUsageContext): void {
        this._sources.forEach(s => s.getMemoryUsage(context));
    }
}
