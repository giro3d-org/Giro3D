import type GUI from 'lil-gui';
import { Color } from 'three';
import type Instance from '../core/Instance';
import type Shape from '../entities/Shape';
import EntityInspector from './EntityInspector';

class ShapeInspector extends EntityInspector<Shape> {
    color: string;

    /**
     * Creates an instance of ShapeInspector.
     *
     * @param parentGui - The parent GUI.
     * @param instance - The Giro3D instance.
     * @param entity - The inspected Map.
     */
    constructor(parentGui: GUI, instance: Instance, entity: Shape) {
        super(parentGui, instance, entity, {
            visibility: true,
            opacity: true,
        });

        this.entity = entity;
        this.color = `#${new Color(this.entity.color).getHexString()}`;

        this.addColorController(this, 'color')
            .name('Color')
            .onChange(c => {
                this.entity.color = c;
            });
        this.addController<boolean>(this.entity, 'showSegmentLabels').name('Segment labels');
        this.addController<boolean>(this.entity, 'showLineLabel').name('Line label');
        this.addController<boolean>(this.entity, 'showSurfaceLabel').name('Surface label');
        this.addController<boolean>(this.entity, 'showVerticalLineLabels').name(
            'Vertical line labels',
        );
        this.addController<boolean>(this.entity, 'showVertexLabels').name('Vertex labels');
        this.addController<boolean>(this.entity, 'showSurface').name('Surface');
        this.addController<number>(this.entity, 'surfaceOpacity')
            .name('Surface opacity')
            .min(0)
            .max(1);
        this.addController<number>(this.entity, 'labelOpacity').name('Label opacity').min(0).max(1);
        this.addController<boolean>(this.entity, 'showVertices').name('Vertices');
        this.addController<boolean>(this.entity, 'showFloorVertices').name('Floor vertices');
        this.addController<boolean>(this.entity, 'showLine').name('Line');
        this.addController<boolean>(this.entity, 'showFloorLine').name('Floor line');
        this.addController<boolean>(this.entity, 'showVerticalLines').name('Vertical lines');
        this.addController<boolean>(this.entity, 'floorElevation').name('Floor elevation');
        this.addController<boolean>(this.entity, 'dashed').name('Dashed');
        this.addController<boolean>(this.entity, 'dashSize').name('Dash size').min(1).max(100);
        this.addController<boolean>(this.entity, 'depthTest').name('Depth test');
        this.addController<number>(this.entity, 'fontSize')
            .name('Font size (px)')
            .min(1)
            .max(50)
            .step(1);
        this.addController<string>(this.entity, 'fontWeight', ['bold', 'normal']).name(
            'Font weight',
        );
        this.addController<number>(this.entity, 'lineWidth')
            .name('Line width')
            .min(1)
            .max(50)
            .step(1);
        this.addController<number>(this.entity, 'vertexRadius')
            .name('Vertex radius')
            .min(1)
            .max(50)
            .step(1);
        this.addController<number>(this.entity, 'borderWidth')
            .name('Border width')
            .min(0)
            .max(51)
            .step(0.5);
    }
}

export default ShapeInspector;
