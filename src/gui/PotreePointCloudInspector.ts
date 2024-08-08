import type GUI from 'lil-gui';
import { Group } from 'three';
import type Instance from '../core/Instance';
import type PotreePointCloud from '../entities/PotreePointCloud';
import EntityInspector from './EntityInspector';

class PotreePointCloudInspector extends EntityInspector<PotreePointCloud> {
    /** The SSE of the entity. */
    sse: number;
    bboxRoot: Group;
    budgetThousands: number;

    /**
     * Creates an instance of PotreePointCloudInspector.
     *
     * @param parentGui - The parent GUI.
     * @param instance - The Giro3D instance.
     * @param entity - The inspected 3D tileset.
     */
    constructor(parentGui: GUI, instance: Instance, entity: PotreePointCloud) {
        super(parentGui, instance, entity, {
            title: `PotreePointCloud ('${entity.id}')`,
            visibility: true,
            boundingBoxColor: false,
            boundingBoxes: true,
            opacity: true,
        });

        this.sse = entity.sseThreshold;

        this.bboxRoot = new Group();
        this.bboxRoot.name = 'inspector';
        this.instance.scene.add(this.bboxRoot);

        this.budgetThousands = entity.pointBudget ? entity.pointBudget / 1000 : 2000;

        this.addController<number>(this, 'budgetThousands')
            .min(1)
            .max(10000)
            .name('Point budget (thousands)')
            .onChange(v => this.updatePointBudget(v));

        this.addController<number>(this.entity, 'pointSize')
            .min(1)
            .max(10)
            .name('Point size (pixels)')
            .onChange(() => this.notify());

        this.addController<number>(this, 'sse')
            .min(0.01)
            .max(100)
            .name('Screen Space Error')
            .onChange(v => this.updateSSE(v));
    }

    updatePointBudget(budgetThousands: number) {
        this.entity.pointBudget = budgetThousands * 1000;
        this.notify();
    }

    updateSSE(v: number) {
        this.entity.sseThreshold = v;
        this.notify();
    }

    toggleBoundingBoxes(visible: boolean) {
        this.entity.bboxes.visible = visible;
        this.notify();
    }

    notify() {
        this.instance.notifyChange(this.entity);
    }
}

export default PotreePointCloudInspector;
