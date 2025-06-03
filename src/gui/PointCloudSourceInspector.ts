import type GUI from 'lil-gui';
import type Instance from '../core/Instance';
import { aggregateMemoryUsage, format, type GetMemoryUsageContext } from '../core/MemoryUsage';
import { isAggregatePointCloudSource } from '../sources/AggregatePointCloudSource';
import { isCOPCSource } from '../sources/COPCSource';
import type { PointCloudSource } from '../sources/PointCloudSource';
import Panel from './Panel';

export default class PointCloudSourceInspector extends Panel {
    readonly source: PointCloudSource;
    readonly memoryUsage = { cpuMemory: '', gpuMemory: '' };

    constructor(parent: GUI, instance: Instance, source: PointCloudSource) {
        super(parent, instance, 'Source');

        this.source = source;

        source.initialize().then(s => this.populate(s));
    }

    private populate(source: PointCloudSource) {
        this.addController(source, 'id');
        this.addController(source, 'type');
        this.addController(source, 'progress').decimals(2);
        this.addController(this.memoryUsage, 'cpuMemory');
        this.addController(this.memoryUsage, 'gpuMemory');

        if (isAggregatePointCloudSource(source)) {
            this.addController(source.sources, 'length');
        } else if (isCOPCSource(source)) {
            source.getMetadata().then(metadata => {
                if (metadata.crs && typeof metadata.crs.srid !== 'undefined') {
                    this.addController(metadata.crs.srid, 'asString').name('CRS');
                }
                this.addController(metadata.attributes, 'length').name('Attributes');
            });
        }
    }

    override updateValues(): void {
        if (!this.source.ready) {
            return;
        }

        const context: GetMemoryUsageContext = {
            renderer: this.instance.renderer,
            objects: new Map(),
        };
        this.source.getMemoryUsage(context);

        const report = aggregateMemoryUsage(context);
        this.memoryUsage.cpuMemory = format(report.cpuMemory);
        this.memoryUsage.gpuMemory = format(report.gpuMemory);
    }
}
