import Entity3D from '@giro3d/giro3d/entities/Entity3D';
import {
    Box3,
    BoxGeometry,
    BufferGeometry,
    Group,
    Mesh,
    MeshStandardMaterial,
    Object3D,
    PerspectiveCamera,
    Plane,
    Vector3,
    type Material,
} from 'three';

/**
 * Creates a valid {@link Entity3D} for unit testing.
 *
 * @param obj3d - an optional object3d to inject
 */
function sut(obj3d: Object3D | undefined = undefined) {
    const object3d = obj3d ?? new Group();

    const entity = new Entity3D(object3d);
    return entity;
}

describe('Entity3D', () => {
    describe('constructor', () => {
        it('should throw on undefined object3d', () => {
            // @ts-expect-error argument is not an Object3D
            expect(() => new Entity3D(undefined)).toThrow();
            // @ts-expect-error argument is not an Object3D
            expect(() => new Entity3D({ isObject3D: false })).toThrow();
        });

        it('should assign the provided properties', () => {
            const obj3d = new Object3D();

            const entity = new Entity3D(obj3d);

            expect(entity.type).toStrictEqual('Entity3D');
            expect(entity.object3d).toBe(obj3d);
        });

        it('should assign the object3d.name with id if it is a group', () => {
            const obj3d = new Group();

            const entity = new Entity3D(obj3d);

            expect(entity.object3d.name).toEqual(entity.id);
        });

        it('should define the "opacity" property with default value 1.0', () => {
            const entity = sut();

            expect(entity.opacity).toEqual(1.0);
        });
    });

    describe('clippingPlanes', () => {
        it('should assign the property', () => {
            const entity = sut();

            expect(entity.clippingPlanes).toBeNull();
            const newValue = [new Plane()];
            entity.clippingPlanes = newValue;
            expect(entity.clippingPlanes).toBe(newValue);
        });

        it('should raise an event when the propert is assigned', () => {
            const entity = sut();
            const listener = jest.fn();
            entity.addEventListener('clippingPlanes-property-changed', listener);

            const newValue = [new Plane()];
            entity.clippingPlanes = newValue;
            entity.clippingPlanes = newValue;
            entity.clippingPlanes = newValue;
            expect(listener).toHaveBeenCalledTimes(3);
            entity.clippingPlanes = newValue;
            expect(listener).toHaveBeenCalledTimes(4);
        });

        it('should traverse the hierarchy and assign the clippingPlanes property on materials', () => {
            const entity = sut();
            const child1 = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
            const child2 = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
            const child3 = new Mesh(new BoxGeometry(), new MeshStandardMaterial());

            entity.object3d.add(child1, child2, child3);

            const newValue = [new Plane()];
            entity.clippingPlanes = newValue;

            expect(child1.material.clippingPlanes).toBe(newValue);
            expect(child2.material.clippingPlanes).toBe(newValue);
            expect(child3.material.clippingPlanes).toBe(newValue);
        });
    });

    describe('renderOrder', () => {
        it('should assign the property', () => {
            const entity = sut();

            expect(entity.renderOrder).toBe(0);
            entity.renderOrder = 2;
            expect(entity.renderOrder).toBe(2);
        });

        it('should raise an event only if the value has changed', () => {
            const entity = sut();
            const listener = jest.fn();
            entity.addEventListener('renderOrder-property-changed', listener);

            entity.renderOrder = 1;
            entity.renderOrder = 1;
            entity.renderOrder = 1;
            expect(listener).toHaveBeenCalledTimes(1);
            entity.renderOrder = 2;
            expect(listener).toHaveBeenCalledTimes(2);
        });

        it('should traverse the hierarchy and assign the renderOrder property on objects', () => {
            const entity = sut();
            const child1 = new Object3D();
            const child2 = new Object3D();
            const child3 = new Object3D();

            entity.object3d.add(child1, child2, child3);

            const newValue = 5;
            entity.renderOrder = newValue;

            expect(child1.renderOrder).toEqual(newValue);
            expect(child2.renderOrder).toEqual(newValue);
            expect(child3.renderOrder).toEqual(newValue);
        });
    });

    describe('visible', () => {
        it('should assign the property', () => {
            const entity = sut();

            expect(entity.visible).toBe(true);
            entity.visible = false;
            expect(entity.visible).toBe(false);
        });

        it('should raise an event only if the value has changed', () => {
            const entity = sut();
            const listener = jest.fn();
            entity.addEventListener('visible-property-changed', listener);

            entity.visible = false;
            entity.visible = false;
            entity.visible = false;
            expect(listener).toHaveBeenCalledTimes(1);
            entity.visible = true;
            expect(listener).toHaveBeenCalledTimes(2);
        });

        it('should set the root object visibility', () => {
            const entity = sut();

            expect(entity.object3d.visible).toEqual(true);
            entity.visible = false;
            expect(entity.object3d.visible).toEqual(false);
        });
    });

    describe('object3d', () => {
        it('should return the provided object', () => {
            const obj = new Object3D();
            const entity = sut(obj);

            expect(entity.object3d).toBe(obj);
        });
    });

    describe('mixin from EventDispatcher', () => {
        it('contains the dispatchEvent method', () => {
            const entity = sut();
            expect(entity.dispatchEvent).toBeDefined();
        });

        it('contains the addEventListener method', () => {
            const entity = sut();
            expect(entity.addEventListener).toBeDefined();
        });

        it('contains the hasEventListener method', () => {
            const entity = sut();
            expect(entity.hasEventListener).toBeDefined();
        });

        it('contains the removeEventListener method', () => {
            const entity = sut();
            expect(entity.removeEventListener).toBeDefined();
        });

        it('should dispatch the opacity-property-changed event', () => {
            const o3d = new Object3D();
            const entity = sut(o3d);
            const listener = jest.fn();

            entity.addEventListener('opacity-property-changed', listener);
            entity.opacity = 0;
            expect(listener).toHaveBeenCalled();
        });
    });

    describe('opacity', () => {
        it('should traverse the object3d', () => {
            const o3d = new Object3D();
            o3d.traverse = jest.fn();
            const entity = sut(o3d);
            entity.opacity = 0.5;
            expect(o3d.traverse).toHaveBeenCalled();
        });

        it('should assign the property', () => {
            const entity = sut();
            entity.object3d.traverse = jest.fn();

            expect(entity.opacity).toEqual(1.0);
            entity.opacity = 0.5;
            expect(entity.opacity).toEqual(0.5);
        });

        it('should raise an event only if the value has changed', () => {
            const entity = sut();
            entity.object3d.traverse = jest.fn();
            const listener = jest.fn();
            entity.addEventListener('opacity-property-changed', listener);

            entity.opacity = 0.5;
            entity.opacity = 0.5;
            entity.opacity = 0.5;
            expect(listener).toHaveBeenCalledTimes(1);
            entity.opacity = 0.3;
            expect(listener).toHaveBeenCalledTimes(2);
        });

        it('should traverse the hierarchy and assign the opacity property of materials', () => {
            const object3d = new Group();
            const entity = sut(object3d);

            entity.object3d.add(new Mesh(new BufferGeometry(), new MeshStandardMaterial()));
            entity.object3d.add(new Mesh(new BufferGeometry(), new MeshStandardMaterial()));
            entity.object3d.add(new Mesh(new BufferGeometry(), new MeshStandardMaterial()));
            entity.object3d.add(new Mesh(new BufferGeometry(), new MeshStandardMaterial()));

            entity.opacity = 0.5;

            object3d.traverse(o => {
                if ((o as Mesh).isMesh) {
                    const mesh = o as Mesh<BufferGeometry, Material>;
                    expect(mesh.material.opacity).toEqual(0.5);
                    expect(mesh.material.transparent).toEqual(true);
                }
            });
        });
    });

    describe('onObjectCreated', () => {
        it('should assign the parentEntity in the userData property of the created object and its descendants', () => {
            const entity = sut();

            const o = new Object3D();
            o.add(new Object3D());
            o.add(new Object3D());
            o.add(new Object3D().add(new Object3D()));

            // @ts-expect-error protected method
            entity.onObjectCreated(o);

            o.traverse(desc => {
                expect(desc.userData.parentEntity).toBe(entity);
            });
        });

        it('should assign the clipping planes property of the created object and its descendants', () => {
            const entity = sut();
            const planes = [new Plane()];
            entity.clippingPlanes = planes;

            const o = new Object3D();
            o.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
            o.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
            o.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));

            // @ts-expect-error protected method
            entity.onObjectCreated(o);

            for (const child of o.children) {
                const mesh = child as Mesh<BoxGeometry, MeshStandardMaterial>;
                expect(mesh.material.clippingPlanes).toBe(planes);
            }
        });

        it('should set the opacity of the created object and its descendants to the current opacity value', () => {
            const entity = sut();

            const o = new Object3D();
            o.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
            o.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
            o.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
            // @ts-expect-error protected method
            entity.onObjectCreated(o);
            for (const child of o.children) {
                const mesh = child as Mesh<BoxGeometry, MeshStandardMaterial>;
                expect(mesh.material.opacity).toBe(1);
                expect(mesh.material.transparent).toBe(false);
            }

            entity.opacity = 0.7;
            // @ts-expect-error protected method
            entity.onObjectCreated(o);
            for (const child of o.children) {
                const mesh = child as Mesh<BoxGeometry, MeshStandardMaterial>;
                expect(mesh.material.opacity).toBe(0.7);
                expect(mesh.material.transparent).toBe(true);
            }
        });

        it('should fire a "object-created" event', done => {
            const entity = sut();
            const o = new Object3D();
            o.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
            o.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
            o.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));

            entity.addEventListener('object-created', evt => {
                expect(evt.type).toBe('object-created');
                expect(evt.obj).toBe(o);
                done();
            });

            // @ts-expect-error protected method
            entity.onObjectCreated(o);
        });
    });

    describe('getDefaultPointOfView', () => {
        class StubEntity extends Entity3D {
            constructor() {
                super(new Group());
            }
        }

        it('should compute a POV from the bounding box of the entity', () => {
            Object3D.DEFAULT_UP.set(0, 0, 1);

            const entity = new StubEntity();
            const box = new Box3().setFromCenterAndSize(new Vector3(1, 2, 3), new Vector3(5, 5, 5));
            entity.getBoundingBox = jest.fn(() => box);

            const getDefaultPointOfView = jest.fn();

            // @ts-expect-error instance is readonly
            entity._instance = {
                // @ts-expect-error incomplete
                view: { getDefaultPointOfView },
            };

            const camera = new PerspectiveCamera(45);

            entity.getDefaultPointOfView({ camera });

            expect(getDefaultPointOfView).toHaveBeenCalledWith(box, { camera });
        });
    });
});
