import type GUI from 'lil-gui';
import type Instance from '../core/Instance';
import type OrientedImageCollection from '../entities/OrientedImageCollection';
import EntityInspector from './EntityInspector';

export default class OrientedImageCollectionInspector extends EntityInspector<OrientedImageCollection> {
    constructor(
        parentGui: GUI,
        instance: Instance,
        orientedImageCollection: OrientedImageCollection,
    ) {
        super(parentGui, instance, orientedImageCollection, {
            boundingBoxColor: false,
            boundingBoxes: false,
            opacity: true,
            visibility: true,
        });

        const notify = () => this.notify();

        const imagesCount = orientedImageCollection.source.images.length;

        const params = {
            projectionDistance:
                imagesCount > 0 ? orientedImageCollection.getImageProjectionDistance(0) : 0,
        };

        this.addController(orientedImageCollection, 'showLocationSpheres')
            .name('Show location spheres')
            .onChange(notify);
        this.addController(orientedImageCollection, 'showFrustums')
            .name('Show view frustums')
            .onChange(notify);
        this.addController(orientedImageCollection, 'showImages')
            .name('Show images')
            .onChange(notify);
        this.addController(orientedImageCollection, 'imageOpacity', 0, 1, 0.01)
            .name('Images opacity')
            .onChange(notify);
        this.addController(params, 'projectionDistance', 0, 1000, 1).onChange(() => {
            for (let i = 0; i < imagesCount; i++) {
                orientedImageCollection.setImageProjectionDistance(i, params.projectionDistance);
            }
            notify();
        });
    }
}
