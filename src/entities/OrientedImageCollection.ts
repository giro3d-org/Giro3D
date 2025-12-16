/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import {
    Box3,
    BufferGeometry,
    Color,
    DoubleSide,
    Euler,
    Float32BufferAttribute,
    Group,
    InstancedMesh,
    MathUtils,
    Matrix4,
    Mesh,
    MeshBasicMaterial,
    PlaneGeometry,
    Sphere,
    SphereGeometry,
    SRGBColorSpace,
    Vector3,
    type ColorRepresentation,
    type Vector2,
    type Vector3Like,
} from 'three';

import type Context from '../core/Context';
import type HasDefaultPointOfView from '../core/HasDefaultPointOfView';
import type { HeadingPitchRollLike } from '../core/HeadingPitchRoll';
import type PickOptions from '../core/picking/PickOptions';
import type PickResult from '../core/picking/PickResult';
import type PointOfView from '../core/PointOfView';
import type { EntityUserData } from './Entity';
import type { Entity3DOptions, Entity3DEventMap } from './Entity3D';

import {
    getGeometryMemoryUsage,
    getMaterialMemoryUsage,
    getObject3DMemoryUsage,
    type GetMemoryUsageContext,
} from '../core/MemoryUsage';
import pickObjectsAt from '../core/picking/PickObjectsAt';
import Fetcher from '../utils/Fetcher';
import Entity3D from './Entity3D';

export interface OrientedImageSource {
    /** The position of the camera, in the same coordinate system as the instance. */
    position: Vector3Like;
    /** The orientation of the camera. */
    orientation: HeadingPitchRollLike;
    /** Vertical field of view in degrees. */
    fov: number;
    /** The aspect ratio of the image, which is width divided by height. */
    aspectRatio: number;
    /** The distance from the origin at which the image is displayed. */
    distance: number;
    /** The URL of the image. If undefined, the image is not displayed (but the frustum and origin point can still be displayed) */
    imageUrl?: string;
}

export interface OrientedImageCollectionSource {
    images: OrientedImageSource[];
}

interface ImageObject {
    readonly mesh: Mesh;
    readonly material: MeshBasicMaterial;
    wasDisposed: boolean;
}

/**
 * Constructor options for the {@link OrientedImageCollection} entity.
 */
export interface OrientedImageCollectionOptions extends Entity3DOptions {
    /**
     * The OrientedImageCollection source.
     */
    source: OrientedImageCollectionSource;

    /**
     * Location spheres show the location of the camera when an image was taken.
     */
    locationSpheres?: {
        /**
         * Display the location spheres at the origin of each image.
         * @defaultValue true
         */
        visible?: boolean;
        /**
         * The radius of the location spheres, in CRS units.
         * @defaultValue 0.5
         */
        radius?: number;
        /**
         * The color of the location spheres.
         * @defaultValue green
         */
        color?: ColorRepresentation;
    };

    /**
     * Frustums represent the field of view of each images as a view cone.
     */
    frustums?: {
        /**
         * Display the frustum of each image.
         * @defaultValue true
         */
        visible?: boolean;
        /**
         * The color of the camera frustums.
         * @defaultValue green
         */
        color?: ColorRepresentation;
    };

    images?: {
        /**
         * Display the actual images.
         * Note, if the `.imageUrl` property is undefined, then a blank rectangle is displayed instead.
         * @defaultValue false
         */
        visible?: boolean;
        /**
         * The opacity of the image object.
         * @defaultValue 1
         */
        opacity?: number;
    };
}

export interface OrientedImageCollectionPickResult extends PickResult {
    imageIndex: number;
}

/**
 * Displays a collection of oriented images coming from a {@link OrientedImageCollectionSource} in the 3D space.
 *
 * Each oriented image is displayed as 3 distinct elements:
 * - a sphere positioned at the location of the camera receptor
 * - a frustum to show the view frustum of the camera receptor (orientation, field of view and aspect ratio)
 * - a texture plane on which the image is projected
 *
 * Each of these 3 elements can be made visible or invisible independently.
 *
 * If the collection contains images that are too spread out geographically, visual issues may occur.
 * This is why we advise to group images that are relatively close together.
 */
export default class OrientedImageCollection<
    TUserData extends EntityUserData = EntityUserData,
> extends Entity3D<Entity3DEventMap, TUserData> {
    /** Readonly flag to indicate that this object is a OrientedImageCollection instance. */
    public readonly isOrientedImageCollection = true as const;
    public override readonly type = 'OrientedImageCollection' as const;

    /** The source of this entity. */
    public readonly source: OrientedImageCollectionSource;

    private readonly _container: Group;
    private readonly _origin = new Vector3();

    private readonly _images: {
        readonly container: Group;
        readonly bufferGeometry: BufferGeometry;
        opacity: number;
        objects: ImageObject[] | null;
    };

    private readonly _spheres: {
        readonly bufferGeometry: BufferGeometry;
        readonly material: MeshBasicMaterial;
        instancedMesh: InstancedMesh | null;
    };

    private readonly _frustums: {
        readonly bufferGeometry: BufferGeometry;
        readonly material: MeshBasicMaterial;
        instancedMesh: InstancedMesh | null;
    };

    public constructor(options: OrientedImageCollectionOptions) {
        super(options);

        this._container = new Group();
        this._container.name = 'OrientedImageCollection-container';
        this.object3d.add(this._container);

        this.source = options.source;

        this._images = {
            container: new Group(),
            bufferGeometry: new PlaneGeometry()
                .applyMatrix4(new Matrix4().makeTranslation(0, 0, -1))
                .rotateX(MathUtils.degToRad(90)),
            opacity: options.images?.opacity ?? 1,
            objects: null,
        };
        this._images.container.name = 'images-container';
        this._images.container.visible = false;
        this._container.add(this._images.container);

        this._spheres = {
            bufferGeometry: new SphereGeometry(options.locationSpheres?.radius ?? 0.5, 6, 5),
            material: new MeshBasicMaterial({ color: options.locationSpheres?.color ?? 0x00ff00 }),
            instancedMesh: null,
        };

        const frustumGeometry = new BufferGeometry();
        frustumGeometry.setAttribute(
            'position',
            new Float32BufferAttribute(
                [0, 0, 0, -0.5, -0.5, -1, +0.5, -0.5, -1, +0.5, +0.5, -1, -0.5, +0.5, -1],
                3,
            ),
        );
        frustumGeometry.rotateX(MathUtils.degToRad(90));
        frustumGeometry.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1]);
        this._frustums = {
            bufferGeometry: frustumGeometry,
            material: new MeshBasicMaterial({
                color: options.frustums?.color ?? 0x00ff00,
                wireframe: true,
            }),
            instancedMesh: null,
        };

        if (this.source.images.length > 0) {
            this._origin.set(Infinity, Infinity, Infinity);
            for (const imageSource of this.source.images) {
                this._origin.min(imageSource.position);
            }
            this._container.position.copy(this._origin);
        }

        this.showLocationSpheres = options.locationSpheres?.visible ?? true;
        this.showFrustums = options.frustums?.visible ?? true;
        this.showImages = options.images?.visible ?? false;

        this.object3d.updateMatrixWorld(true);
    }

    public override getMemoryUsage(context: GetMemoryUsageContext): void {
        getGeometryMemoryUsage(context, this._images.bufferGeometry);
        if (this._images.objects) {
            for (const imageObject of this._images.objects) {
                getObject3DMemoryUsage(context, imageObject.mesh);
            }
        }

        getGeometryMemoryUsage(context, this._spheres.bufferGeometry);
        getMaterialMemoryUsage(context, this._spheres.material);
        if (this._spheres.instancedMesh) {
            getObject3DMemoryUsage(context, this._spheres.instancedMesh);
        }

        getGeometryMemoryUsage(context, this._frustums.bufferGeometry);
        getMaterialMemoryUsage(context, this._frustums.material);
        if (this._frustums.instancedMesh) {
            getObject3DMemoryUsage(context, this._frustums.instancedMesh);
        }
    }

    /**
     * Gets or sets the spheres visibility.
     *
     * @defaultValue true
     */
    public get showLocationSpheres(): boolean {
        return this._spheres.instancedMesh?.visible === true;
    }

    public set showLocationSpheres(visible: boolean) {
        if (this.showLocationSpheres === visible) {
            return;
        }

        if (this._spheres.instancedMesh) {
            this._spheres.instancedMesh.visible = visible;
        } else if (visible) {
            this.computeSpheres();
        }
        this.notifyChange(this);
    }

    /**
     * Gets or sets the frustums visibility.
     *
     * @defaultValue true
     */
    public get showFrustums(): boolean {
        return this._frustums.instancedMesh?.visible === true;
    }

    public set showFrustums(visible: boolean) {
        if (this.showFrustums === visible) {
            return;
        }

        if (this._frustums.instancedMesh) {
            this._frustums.instancedMesh.visible = visible;
        } else if (visible) {
            this.computeFrustums();
        }
        this.notifyChange(this);
    }

    /**
     * Gets or sets the images opacity.
     *
     * @defaultValue 1
     */
    public get imageOpacity(): number {
        return this._images.opacity;
    }

    public set imageOpacity(opacity: number) {
        if (this._images.opacity === opacity) {
            return;
        }

        this._images.opacity = opacity;

        if (this._images.objects) {
            const actualOpacity = this.opacity * this._images.opacity;

            for (const imageObject of this._images.objects) {
                const currentTransparent = imageObject.material.transparent;
                imageObject.material.transparent = actualOpacity < 1;
                imageObject.material.opacity = actualOpacity;
                if (currentTransparent !== imageObject.material.transparent) {
                    imageObject.material.needsUpdate = true;
                }
            }
            this.notifyChange(this);
        }
    }

    /**
     * Gets or sets the images visibility.
     *
     * @defaultValue false
     */
    public get showImages(): boolean {
        return !!this._images.objects && this._images.container.visible;
    }

    public set showImages(visible: boolean) {
        if (this.showImages === visible) {
            return;
        }

        this._images.container.visible = visible;

        if (visible && !this._images.objects) {
            const createImageObject = this.createImageObject.bind(this);
            this._images.objects = this.source.images.map(createImageObject);
        }
        this.notifyChange(this);
    }

    public override updateOpacity(): void {
        super.updateOpacity();

        if (this._images.objects) {
            const imagesOpacity = this.opacity * this._images.opacity;
            for (const imageObject of this._images.objects) {
                const currenTransparent = imageObject.material.transparent;
                imageObject.material.transparent = imagesOpacity < 1;
                imageObject.material.opacity = imagesOpacity;
                if (currenTransparent !== imageObject.material.transparent) {
                    imageObject.material.needsUpdate = true;
                }
            }
        }
    }

    /**
     * Sets the projection distance of a specific image in the collection.
     */
    public setImageProjectionDistance(imageIndex: number, distance: number): void {
        const source = this.getImageSource(imageIndex);
        if (source.distance === distance) {
            return;
        }

        source.distance = distance;

        if (this._images.objects || this._frustums.instancedMesh) {
            const frustumMatrix = this.computeFrustumMatrix(source);

            if (this._images.objects) {
                const imageObject = this._images.objects[imageIndex];
                imageObject.mesh.matrix.copy(frustumMatrix);
                imageObject.mesh.updateMatrixWorld(true);
            }

            if (this._frustums.instancedMesh) {
                this._frustums.instancedMesh.setMatrixAt(imageIndex, frustumMatrix);
                this._frustums.instancedMesh.instanceMatrix.needsUpdate = true;
            }
        }
        this.notifyChange(this);
    }

    /**
     * Gets the projection distance of a specific image in the collection.
     */
    public getImageProjectionDistance(imageIndex: number): number {
        return this.getImageSource(imageIndex).distance;
    }

    /**
     * Gets the point of view of the first image if there is one.
     */
    public override getDefaultPointOfView(
        _params: Parameters<HasDefaultPointOfView['getDefaultPointOfView']>[0],
    ): ReturnType<HasDefaultPointOfView['getDefaultPointOfView']> {
        const firstSource = this.source.images[0];
        if (firstSource == null) {
            return null;
        }

        return this.computePointOfView(firstSource);
    }

    /**
     * Gets the point of view of a specific image in the collection.
     */
    public getImagePointOfView(imageIndex: number): PointOfView {
        const source = this.getImageSource(imageIndex);
        return this.computePointOfView(source);
    }

    /**
     * Disposes this entity and deletes unmanaged graphical resources.
     */
    public override dispose(): void {
        this._container.clear();

        if (this._images.objects) {
            for (const imageObject of this._images.objects) {
                imageObject.material.map?.dispose();
                imageObject.material.dispose();
                imageObject.wasDisposed = true;
            }
            this._images.objects = null;
        }
        this._images.bufferGeometry.dispose();

        this._spheres.bufferGeometry.dispose();
        this._spheres.material.dispose();
        this._spheres.instancedMesh?.dispose();
        this._spheres.instancedMesh = null;

        this._frustums.bufferGeometry.dispose();
        this._frustums.material.dispose();
        this._frustums.instancedMesh?.dispose();
        this._frustums.instancedMesh = null;

        super.dispose();
    }

    public override pick(
        canvasCoords: Vector2,
        options?: PickOptions,
    ): OrientedImageCollectionPickResult[] {
        const result = pickObjectsAt(this.instance, canvasCoords, this.object3d, options);
        const hit = result[0];
        if (hit == null) {
            return [];
        }

        let imageIndex: number | null = null;
        if (hit.instanceId != null) {
            imageIndex = hit.instanceId;
            delete hit.instanceId;
        } else {
            if (this._images.objects) {
                this._images.objects.forEach((imageObject: ImageObject, index: number) => {
                    if (imageObject.mesh === hit.object) {
                        imageIndex = index;
                    }
                });
            }

            if (imageIndex === null) {
                return [];
            }
        }

        return [{ ...hit, imageIndex: imageIndex }];
    }

    public override postUpdate(context: Context, _changeSources: Set<unknown>): void {
        this.updateMinMaxDistance(context);
    }

    private computeSpheres(): void {
        if (this._spheres.instancedMesh) {
            return;
        }

        const instancedMesh = new InstancedMesh(
            this._spheres.bufferGeometry,
            this._spheres.material,
            this.source.images.length,
        );
        this._spheres.instancedMesh = instancedMesh;
        this._spheres.instancedMesh.name = 'spheres';
        this._container.add(instancedMesh);

        this.source.images.forEach((source: OrientedImageSource, index: number) => {
            const matrix = this.computeLocalTranslationMatrix(source.position);
            instancedMesh.setMatrixAt(index, matrix);
        });
        instancedMesh.instanceMatrix.needsUpdate = true;
    }

    private computeFrustums(): void {
        if (this._frustums.instancedMesh) {
            return;
        }

        const instancedMesh = new InstancedMesh(
            this._frustums.bufferGeometry,
            this._frustums.material,
            this.source.images.length,
        );
        this._frustums.instancedMesh = instancedMesh;
        this._frustums.instancedMesh.name = 'frustums';
        this._container.add(instancedMesh);

        this.source.images.forEach((source: OrientedImageSource, index: number) => {
            const matrix = this.computeFrustumMatrix(source);
            instancedMesh.setMatrixAt(index, matrix);
        });
        instancedMesh.instanceMatrix.needsUpdate = true;
    }

    private computeFrustumMatrix(source: OrientedImageSource): Matrix4 {
        const translationMatrix = this.computeLocalTranslationMatrix(source.position);
        const rotationMatrix = this.computeLocalRotationMatrix(source.orientation);

        const frustumSizeY = 2 * Math.tan(MathUtils.degToRad(0.5 * source.fov));
        const scaleMatrix = new Matrix4().makeScale(
            source.distance * frustumSizeY * source.aspectRatio,
            source.distance * frustumSizeY,
            source.distance,
        );

        return new Matrix4()
            .multiply(translationMatrix)
            .multiply(rotationMatrix)
            .multiply(scaleMatrix);
    }

    private computeLocalRotationMatrix(orientation: HeadingPitchRollLike): Matrix4 {
        const heading = orientation.heading ?? 0;
        const pitch = orientation.pitch ?? 0;
        const roll = orientation.roll ?? 0;

        return new Matrix4().makeRotationFromEuler(
            new Euler(
                MathUtils.degToRad(pitch),
                MathUtils.degToRad(roll),
                MathUtils.degToRad(-heading),
                'ZYX',
            ),
        );
    }

    private computeLocalTranslationMatrix(position: Vector3Like): Matrix4 {
        return new Matrix4().makeTranslation(
            position.x - this._origin.x,
            position.y - this._origin.y,
            position.z - this._origin.z,
        );
    }

    private computePointOfView(source: OrientedImageSource): PointOfView {
        const rotationMatrix = this.computeLocalRotationMatrix(source.orientation);
        return {
            origin: new Vector3().copy(source.position),
            target: new Vector3(0, 1, 0).applyMatrix4(rotationMatrix).add(source.position),
            orthographicZoom: 1,
        };
    }

    private getImageSource(imageIndex: number): OrientedImageSource {
        const source = this.source.images[imageIndex];
        if (source == null) {
            throw new Error(
                `OrientedImageCollection "${this.id}" does not have image index "${imageIndex}".`,
            );
        }
        return source;
    }

    private updateMinMaxDistance(context: Context): void {
        if (!this.visible) {
            return;
        }

        const boundingBox = new Box3();
        if (this._spheres.instancedMesh?.visible === true) {
            boundingBox.expandByObject(this._spheres.instancedMesh);
        }
        if (this._frustums.instancedMesh?.visible === true) {
            boundingBox.expandByObject(this._frustums.instancedMesh);
        }
        if (this._images.container.visible) {
            boundingBox.expandByObject(this._images.container);
        }
        const boundingSphere = boundingBox.getBoundingSphere(new Sphere());

        const distance = context.distance.plane.distanceToSphere(boundingSphere);
        this._distance.min = distance;
        this._distance.max = distance + 2 * boundingSphere.radius;
    }

    private createImageObject(imageSource: OrientedImageSource, index: number): ImageObject {
        const url = imageSource.imageUrl;
        const hasUrl = url != null;

        const actualOpacity = hasUrl ? this.opacity * this._images.opacity : this.opacity * 0.3;
        const transparent = actualOpacity < 1;

        const material = new MeshBasicMaterial({
            side: DoubleSide,
            transparent: true,
            opacity: 0,
            color: hasUrl ? undefined : this._frustums.material.color,
        });

        const mesh = new Mesh(this._images.bufferGeometry, material);
        mesh.name = `image-${index}`;
        this._images.container.add(mesh);
        mesh.matrix.copy(this.computeFrustumMatrix(imageSource));
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrixWorld(true);

        const imageObject: ImageObject = { mesh, material, wasDisposed: false };

        if (hasUrl) {
            // only trigger texture fetching once when the mesh is visible
            mesh.onBeforeRender = async (): Promise<void> => {
                mesh.onBeforeRender = (): void => {};

                try {
                    const texture = await Fetcher.texture(url, {
                        flipY: true,
                    });
                    if (imageObject.wasDisposed) {
                        texture.dispose();
                    } else {
                        texture.generateMipmaps = true;
                        texture.colorSpace = SRGBColorSpace;
                        material.map = texture;
                        material.visible = true;
                        material.transparent = transparent;
                        material.opacity = actualOpacity;
                        material.needsUpdate = true;
                        this.notifyChange(this);
                    }
                } catch (error: unknown) {
                    material.color = new Color('red');
                    material.visible = true;
                    material.opacity = 1;
                    console.error(`Failed to load texture "${imageSource.imageUrl}": `, error);
                    this.notifyChange(this);
                }
            };
        } else {
            material.color = this._frustums.material.color;
            material.opacity = actualOpacity;
        }

        return imageObject;
    }
}
