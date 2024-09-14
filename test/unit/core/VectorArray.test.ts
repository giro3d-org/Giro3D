import { Vector2Array, Vector3Array, Vector4Array } from '@giro3d/giro3d/core/VectorArray';
import { Vector2, Vector3, Vector4 } from 'three';

describe('Vector2Array', () => {
    describe('constructor', () => {
        it('should throw if provided Float32Array has an incorrect size', () => {
            const buffer = new Float32Array(3);
            expect(() => new Vector2Array(buffer)).toThrow(
                /invalid size, expected a multiple of 2, got 3/,
            );
        });
    });

    describe('expand', () => {
        it('should replace the underlying array', () => {
            const array = new Vector2Array(new Float32Array(2 * 2));
            const buf = array.array;

            const v0 = new Vector2(5, 1);
            const v1 = new Vector2(10, 455);

            array.set(0, v0.x, v0.y);
            array.set(1, v1.x, v1.y);

            const expanded = array.expand(3);

            const v2 = new Vector2(-9, 0);
            array.set(2, v2.x, v2.y);

            expect(expanded).toBe(array);

            expect(expanded.array).not.toBe(buf);

            expect(expanded.array[0]).toEqual(v0.x);
            expect(expanded.array[1]).toEqual(v0.y);
            expect(expanded.array[2]).toEqual(v1.x);
            expect(expanded.array[3]).toEqual(v1.y);
            expect(expanded.array[4]).toEqual(v2.x);
            expect(expanded.array[5]).toEqual(v2.y);
        });
    });

    describe('set', () => {
        it('should throw if out of bounds', () => {
            const array = new Vector2Array(new Float32Array(3 * 2));

            expect(() => array.set(999, 0, 0)).toThrow(/index out of bounds/);
        });
    });

    describe('copyItem', () => {
        it('correctly copy the item from source to target index', () => {
            const array = new Vector2Array(new Float32Array(2 * 3));

            const v0 = new Vector2(5, 1);
            const v1 = new Vector2(10, 455);

            array.set(0, v0.x, v0.y);
            array.set(1, -999, -999);
            array.set(2, v1.x, v1.y);

            array.copyItem(0, 2);

            expect(array.getX(1)).toEqual(-999);
            expect(array.getY(1)).toEqual(-999);

            expect(array.getX(2)).toEqual(5);
            expect(array.getY(2)).toEqual(1);
        });
    });

    describe('get/set', () => {
        it('should assign correct values at correct locations', () => {
            const array = new Vector2Array(new Float32Array(2 * 3));

            const v0 = new Vector2(5, 1);
            const v1 = new Vector2(10, 455);
            const v2 = new Vector2(-9, 0);

            array.set(0, v0.x, v0.y);
            array.set(1, v1.x, v1.y);
            array.set(2, v2.x, v2.y);

            expect(array.get(0)).toEqual(v0);
            expect(array.get(1)).toEqual(v1);
            expect(array.get(2)).toEqual(v2);
        });
    });

    describe('setVector', () => {
        it('should assign correct values at correct locations', () => {
            const array = new Vector2Array(new Float32Array(2 * 3));

            const v0 = new Vector2(5, 1);
            const v1 = new Vector2(10, 455);
            const v2 = new Vector2(-9, 0);

            array.setVector(0, v0);
            array.setVector(1, v1);
            array.setVector(2, v2);

            expect(array.get(0)).toEqual(v0);
            expect(array.get(1)).toEqual(v1);
            expect(array.get(2)).toEqual(v2);
        });
    });

    describe('forEach', () => {
        it('should visit all elements in the correct order', () => {
            const array = new Vector2Array(new Int16Array(2 * 3));

            const v0 = new Vector2(5, 1);
            const v1 = new Vector2(10, 455);
            const v2 = new Vector2(-9, 0);

            array.setVector(0, v0);
            array.setVector(1, v1);
            array.setVector(2, v2);

            const visited: Vector2[] = [];

            array.forEach(v => visited.push(v.clone()));

            expect(visited).toHaveLength(3);
            expect(visited[0]).toEqual(v0);
            expect(visited[1]).toEqual(v1);
            expect(visited[2]).toEqual(v2);
        });

        it('should allow mutating the array', () => {
            const array = new Vector2Array(new Int16Array(2 * 3));

            const v0 = new Vector2(5, 1);
            const v1 = new Vector2(10, 455);
            const v2 = new Vector2(-9, 0);

            array.setVector(0, v0);
            array.setVector(1, v1);
            array.setVector(2, v2);

            array.forEach((v, idx) => array.setY(idx, v.y + 2));

            expect(array.getY(0)).toEqual(v0.y + 2);
            expect(array.getY(1)).toEqual(v1.y + 2);
            expect(array.getY(2)).toEqual(v2.y + 2);
        });
    });

    describe('setX/Y/Z/W', () => {
        it('should ignore Z and W', () => {
            const array = new Vector2Array(new Int32Array(4 * 3));

            array.setX(0, 555);
            array.setY(2, 123);
            array.setZ(1, 998);
            array.setW(0, 2);

            expect(array.getX(0)).toEqual(555);
            expect(array.getY(2)).toEqual(123);
            expect(array.getZ(1)).toBeNull();
            expect(array.getW(0)).toBeNull();
        });
    });

    describe('getZ/getW', () => {
        it('should return null', () => {
            const array = new Vector2Array(new Float32Array(2 * 1));

            const v0 = new Vector2(5, 1);

            array.set(0, v0.x, v0.y);

            expect(array.getZ(0)).toBeNull();
            expect(array.getW(0)).toBeNull();
        });
    });

    describe('clone', () => {
        it('should return a different object', () => {
            const array = new Vector2Array(new Float32Array(2 * 3));
            const clone = array.clone();

            expect(array).not.toBe(clone);
        });

        it('should return a an array initialized with the same values', () => {
            const array = new Vector2Array(new Float32Array(2 * 3));

            const v0 = new Vector2(5, 1);
            const v1 = new Vector2(10, 455);
            const v2 = new Vector2(-9, 0);

            array.set(0, v0.x, v0.y);
            array.set(1, v1.x, v1.y);
            array.set(2, v2.x, v2.y);

            const clone = array.clone();

            expect(clone.get(0)).toEqual(v0);
            expect(clone.get(1)).toEqual(v1);
            expect(clone.get(2)).toEqual(v2);
        });
    });
});

describe('Vector3Array', () => {
    describe('constructor', () => {
        it('should throw if provided Float32Array has an incorrect size', () => {
            const buffer = new Float32Array(4);
            expect(() => new Vector3Array(buffer)).toThrow(
                /invalid size, expected a multiple of 3, got 4/,
            );
        });

        it('should create a Float32Array with correct size', () => {
            const array = new Vector3Array(new Float32Array(3 * 11));

            expect(array).toHaveLength(11);
            expect(array.array).toHaveLength(33);
        });
    });

    describe('get/set', () => {
        it('should assign correct values at correct locations', () => {
            const array = new Vector3Array(new Float32Array(3 * 3));

            const v0 = new Vector3(5, 1, 5);
            const v1 = new Vector3(10, 455, 2);
            const v2 = new Vector3(-9, 0, 9);

            array.set(0, v0.x, v0.y, v0.z);
            array.set(1, v1.x, v1.y, v1.z);
            array.set(2, v2.x, v2.y, v2.z);

            expect(array.get(0)).toEqual(v0);
            expect(array.get(1)).toEqual(v1);
            expect(array.get(2)).toEqual(v2);
        });
    });

    describe('setVector', () => {
        it('should assign correct values at correct locations', () => {
            const array = new Vector3Array(new Float32Array(3 * 3));

            const v0 = new Vector3(5, 1, 5);
            const v1 = new Vector3(10, 455, 2);
            const v2 = new Vector3(-9, 0, 9);

            array.setVector(0, v0);
            array.setVector(1, v1);
            array.setVector(2, v2);

            expect(array.get(0)).toEqual(v0);
            expect(array.get(1)).toEqual(v1);
            expect(array.get(2)).toEqual(v2);
        });
    });

    describe('forEach', () => {
        it('should visit all elements in the correct order', () => {
            const array = new Vector3Array(new Int16Array(3 * 3));

            const v0 = new Vector3(5, 1, 5);
            const v1 = new Vector3(10, 455, 2);
            const v2 = new Vector3(-9, 0, 9);

            array.setVector(0, v0);
            array.setVector(1, v1);
            array.setVector(2, v2);

            const visited: Vector3[] = [];

            array.forEach(v => visited.push(v.clone()));

            expect(visited).toHaveLength(3);
            expect(visited[0]).toEqual(v0);
            expect(visited[1]).toEqual(v1);
            expect(visited[2]).toEqual(v2);
        });
    });

    describe('getZ/getW', () => {
        it('should return null for getW', () => {
            const array = new Vector3Array(new Float32Array(3 * 1));

            const v0 = new Vector3(5, 1, 7);

            array.set(0, v0.x, v0.y, v0.z);

            expect(array.getZ(0)).toEqual(7);
            expect(array.getW(0)).toBeNull();
        });
    });

    describe('copyItem', () => {
        it('correctly copy the item from source to target index', () => {
            const array = new Vector3Array(new Float32Array(3 * 3));

            const v0 = new Vector3(5, 1, 7);
            const v1 = new Vector3(10, 455, 98);

            array.set(0, v0.x, v0.y, v0.z);
            array.set(1, -999, -999, -999);
            array.set(2, v1.x, v1.y, v1.z);

            array.copyItem(0, 2);

            expect(array.getX(1)).toEqual(-999);
            expect(array.getY(1)).toEqual(-999);
            expect(array.getZ(1)).toEqual(-999);

            expect(array.getX(2)).toEqual(5);
            expect(array.getY(2)).toEqual(1);
            expect(array.getZ(2)).toEqual(7);
        });
    });

    describe('clone', () => {
        it('should return a different object', () => {
            const array = new Vector3Array(new Float32Array(3 * 3));
            const clone = array.clone();

            expect(array).not.toBe(clone);
        });

        it('should return a an array initialized with the same values', () => {
            const array = new Vector3Array(new Int32Array(3 * 3));

            const v0 = new Vector3(5, 1, 4);
            const v1 = new Vector3(10, 455, 2);
            const v2 = new Vector3(-9, 0, 9);

            array.set(0, v0.x, v0.y, v0.z);
            array.set(1, v1.x, v1.y, v1.z);
            array.set(2, v2.x, v2.y, v2.z);

            const clone = array.clone();

            expect(clone.get(0)).toEqual(v0);
            expect(clone.get(1)).toEqual(v1);
            expect(clone.get(2)).toEqual(v2);
        });
    });
});

describe('Vector4Array', () => {
    describe('constructor', () => {
        it('should throw if provided Float32Array has an incorrect size', () => {
            const buffer = new Float32Array(5);
            expect(() => new Vector4Array(buffer)).toThrow(
                /invalid size, expected a multiple of 4, got 5/,
            );
        });
    });

    describe('get/set', () => {
        it('should assign correct values at correct locations', () => {
            const array = new Vector4Array(new Int32Array(4 * 3));

            const v0 = new Vector4(5, 1, 5, 5);
            const v1 = new Vector4(10, 455, 2, 3);
            const v2 = new Vector4(-9, 0, 9, 1);

            array.set(0, v0.x, v0.y, v0.z, v0.w);
            array.set(1, v1.x, v1.y, v1.z, v1.w);
            array.set(2, v2.x, v2.y, v2.z, v2.w);

            expect(array.get(0)).toEqual(v0);
            expect(array.get(1)).toEqual(v1);
            expect(array.get(2)).toEqual(v2);
        });
    });

    describe('setVector', () => {
        it('should assign correct values at correct locations', () => {
            const array = new Vector4Array(new Int32Array(4 * 3));

            const v0 = new Vector4(5, 1, 5, 5);
            const v1 = new Vector4(10, 455, 2, 3);
            const v2 = new Vector4(-9, 0, 9, 1);

            array.setVector(0, v0);
            array.setVector(1, v1);
            array.setVector(2, v2);

            expect(array.get(0)).toEqual(v0);
            expect(array.get(1)).toEqual(v1);
            expect(array.get(2)).toEqual(v2);
        });
    });

    describe('forEach', () => {
        it('should visit all elements in the correct order', () => {
            const array = new Vector4Array(new Int32Array(4 * 3));

            const v0 = new Vector4(5, 1, 5, 5);
            const v1 = new Vector4(10, 455, 2, 3);
            const v2 = new Vector4(-9, 0, 9, 1);

            array.setVector(0, v0);
            array.setVector(1, v1);
            array.setVector(2, v2);

            const visited: Vector4[] = [];

            array.forEach(v => visited.push(v.clone()));

            expect(visited).toHaveLength(3);
            expect(visited[0]).toEqual(v0);
            expect(visited[1]).toEqual(v1);
            expect(visited[2]).toEqual(v2);
        });
    });

    describe('getZ/getW', () => {
        it('should return correct values', () => {
            const array = new Vector4Array(new Float32Array(4 * 1));

            const v0 = new Vector4(5, 1, 7, 9);

            array.set(0, v0.x, v0.y, v0.z, v0.w);

            expect(array.getZ(0)).toEqual(7);
            expect(array.getW(0)).toEqual(9);
        });
    });

    describe('copyItem', () => {
        it('correctly copy the item from source to target index', () => {
            const array = new Vector4Array(new Float32Array(4 * 3));

            const v0 = new Vector4(5, 1, 7, 4);
            const v1 = new Vector4(10, 455, 98, 32);

            array.set(0, v0.x, v0.y, v0.z, v0.w);
            array.set(1, -999, -999, -999, -999);
            array.set(2, v1.x, v1.y, v1.z, v1.w);

            array.copyItem(0, 2);

            expect(array.getX(1)).toEqual(-999);
            expect(array.getY(1)).toEqual(-999);
            expect(array.getZ(1)).toEqual(-999);
            expect(array.getW(1)).toEqual(-999);

            expect(array.getX(2)).toEqual(5);
            expect(array.getY(2)).toEqual(1);
            expect(array.getZ(2)).toEqual(7);
            expect(array.getW(2)).toEqual(4);
        });
    });

    describe('clone', () => {
        it('should return a different object', () => {
            const array = new Vector4Array(new Float32Array(4 * 3));
            const clone = array.clone();

            expect(array).not.toBe(clone);
        });

        it('should return a an array initialized with the same values', () => {
            const array = new Vector4Array(new Float32Array(4 * 3));

            const v0 = new Vector4(5, 1, 4, 8);
            const v1 = new Vector4(10, 455, 2, 7);
            const v2 = new Vector4(-9, 0, 9, -1000);

            array.set(0, v0.x, v0.y, v0.z, v0.w);
            array.set(1, v1.x, v1.y, v1.z, v1.w);
            array.set(2, v2.x, v2.y, v2.z, v2.w);

            const clone = array.clone();

            expect(clone.get(0)).toEqual(v0);
            expect(clone.get(1)).toEqual(v1);
            expect(clone.get(2)).toEqual(v2);
        });
    });

    describe('toFloat32Array', () => {
        it('should return the same array if already in Float32', () => {
            const array = new Vector4Array(new Float32Array(4 * 3));

            const float32 = array.toFloat32Array();
            expect(float32).toBe(array.array);
        });

        it('should return a different array if not already in Float32', () => {
            const array = new Vector4Array(new Float64Array(4 * 3));

            const float32 = array.toFloat32Array();
            expect(float32).not.toBe(array.array);
            expect(float32).toBeInstanceOf(Float32Array);
        });

        it('should return a correctly filled array', () => {
            const array = new Vector4Array(new Float64Array(4 * 3));

            array.set(0, 1, 2, 3, 4);
            array.set(1, 5, 6, 7, 8);
            array.set(2, 9, 10, 11, 12);

            const float32 = array.toFloat32Array();

            expect([...float32]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        });
    });

    describe('setX/Y/Z/W', () => {
        it('should set the correct values', () => {
            const array = new Vector4Array(new Int32Array(4 * 3));

            array.setX(0, 555);
            array.setY(2, 123);
            array.setZ(1, 998);
            array.setW(0, 2);

            expect(array.getX(0)).toEqual(555);
            expect(array.getY(2)).toEqual(123);
            expect(array.getZ(1)).toEqual(998);
            expect(array.getW(0)).toEqual(2);
        });
    });
});
