import * as p from '@giro3d/giro3d/utils/predicates';
import {
    AmbientLight,
    Box2,
    Box3,
    BufferGeometry,
    Color,
    DataTexture,
    DirectionalLight,
    Euler,
    HemisphereLight,
    Matrix3,
    Matrix4,
    Mesh,
    MeshStandardMaterial,
    Object3D,
    OrthographicCamera,
    PerspectiveCamera,
    PointLight,
    Quaternion,
    ShaderMaterial,
    Texture,
    Vector2,
    Vector3,
    Vector4,
} from 'three';
import { CSS2DObject } from 'three/examples/jsm/Addons.js';

describe('predicates', () => {
    test('isObject3D', () => {
        expect(p.isObject3D(null)).toEqual(false);
        expect(p.isObject3D(undefined)).toEqual(false);
        expect(p.isObject3D('no')).toEqual(false);
        expect(p.isObject3D(new Object3D())).toEqual(true);
    });
    test('isMesh', () => {
        expect(p.isMesh(undefined)).toEqual(false);
        expect(p.isMesh(null)).toEqual(false);
        expect(p.isMesh('no')).toEqual(false);
        expect(p.isMesh(new Mesh())).toEqual(true);
    });
    test('isLight', () => {
        expect(p.isLight(undefined)).toEqual(false);
        expect(p.isLight(null)).toEqual(false);
        expect(p.isLight('no')).toEqual(false);
        expect(p.isLight(new DirectionalLight())).toEqual(true);
        expect(p.isLight(new PointLight())).toEqual(true);
        expect(p.isLight(new AmbientLight())).toEqual(true);
        expect(p.isLight(new HemisphereLight())).toEqual(true);
    });
    test('isBufferGeometry', () => {
        expect(p.isBufferGeometry(undefined)).toEqual(false);
        expect(p.isBufferGeometry(null)).toEqual(false);
        expect(p.isBufferGeometry('no')).toEqual(false);
        expect(p.isBufferGeometry(new BufferGeometry())).toEqual(true);
    });
    test('isTexture', () => {
        expect(p.isTexture(undefined)).toEqual(false);
        expect(p.isTexture(null)).toEqual(false);
        expect(p.isTexture('no')).toEqual(false);
        expect(p.isTexture(new Texture())).toEqual(true);
        expect(p.isTexture(new DataTexture())).toEqual(true);
    });
    test('isDataTexture', () => {
        expect(p.isDataTexture(undefined)).toEqual(false);
        expect(p.isDataTexture(null)).toEqual(false);
        expect(p.isDataTexture('no')).toEqual(false);
        expect(p.isDataTexture(new Texture())).toEqual(false);
        expect(p.isDataTexture(new DataTexture())).toEqual(true);
    });
    test('isQuaternion', () => {
        expect(p.isQuaternion(undefined)).toEqual(false);
        expect(p.isQuaternion(null)).toEqual(false);
        expect(p.isQuaternion('no')).toEqual(false);
        expect(p.isQuaternion(new Quaternion())).toEqual(true);
    });
    test('isEuler', () => {
        expect(p.isEuler(undefined)).toEqual(false);
        expect(p.isEuler(null)).toEqual(false);
        expect(p.isEuler('no')).toEqual(false);
        expect(p.isEuler(new Euler())).toEqual(true);
    });
    test('isMatrix3', () => {
        expect(p.isMatrix3(undefined)).toEqual(false);
        expect(p.isMatrix3(null)).toEqual(false);
        expect(p.isMatrix3('no')).toEqual(false);
        expect(p.isMatrix3(new Matrix3())).toEqual(true);
    });
    test('isMatrix4', () => {
        expect(p.isMatrix4(undefined)).toEqual(false);
        expect(p.isMatrix4(null)).toEqual(false);
        expect(p.isMatrix4('no')).toEqual(false);
        expect(p.isMatrix4(new Matrix4())).toEqual(true);
    });
    test('isPerspectiveCamera', () => {
        expect(p.isPerspectiveCamera(undefined)).toEqual(false);
        expect(p.isPerspectiveCamera(null)).toEqual(false);
        expect(p.isPerspectiveCamera('no')).toEqual(false);
        expect(p.isPerspectiveCamera(new OrthographicCamera())).toEqual(false);
        expect(p.isPerspectiveCamera(new PerspectiveCamera())).toEqual(true);
    });
    test('isOrthographicCamera', () => {
        expect(p.isOrthographicCamera(undefined)).toEqual(false);
        expect(p.isOrthographicCamera(null)).toEqual(false);
        expect(p.isOrthographicCamera(new PerspectiveCamera())).toEqual(false);
        expect(p.isOrthographicCamera(new OrthographicCamera())).toEqual(true);
    });
    test('isColor', () => {
        expect(p.isColor(undefined)).toEqual(false);
        expect(p.isColor(null)).toEqual(false);
        expect(p.isColor('no')).toEqual(false);
        expect(p.isColor(new Color('blue'))).toEqual(true);
    });
    test('isMaterial', () => {
        expect(p.isMaterial(undefined)).toEqual(false);
        expect(p.isMaterial(null)).toEqual(false);
        expect(p.isMaterial('no')).toEqual(false);
        expect(p.isMaterial(new MeshStandardMaterial())).toEqual(true);
    });
    test('isShaderMaterial', () => {
        expect(p.isShaderMaterial(undefined)).toEqual(false);
        expect(p.isShaderMaterial(null)).toEqual(false);
        expect(p.isShaderMaterial('no')).toEqual(false);
        expect(p.isShaderMaterial(new ShaderMaterial())).toEqual(true);
    });
    test('isVector2', () => {
        expect(p.isVector2(undefined)).toEqual(false);
        expect(p.isVector2(null)).toEqual(false);
        expect(p.isVector2('no')).toEqual(false);
        expect(p.isVector2(new Vector3())).toEqual(false);
        expect(p.isVector2(new Vector2())).toEqual(true);
    });
    test('isVector3', () => {
        expect(p.isVector3(undefined)).toEqual(false);
        expect(p.isVector3(null)).toEqual(false);
        expect(p.isVector3('no')).toEqual(false);
        expect(p.isVector3(new Vector2())).toEqual(false);
        expect(p.isVector3(new Vector3())).toEqual(true);
    });
    test('isVector4', () => {
        expect(p.isVector4(undefined)).toEqual(false);
        expect(p.isVector4(null)).toEqual(false);
        expect(p.isVector4('no')).toEqual(false);
        expect(p.isVector4(new Vector2())).toEqual(false);
        expect(p.isVector4(new Vector4())).toEqual(true);
    });
    test('isBox3', () => {
        expect(p.isBox3(undefined)).toEqual(false);
        expect(p.isBox3(null)).toEqual(false);
        expect(p.isBox3('no')).toEqual(false);
        expect(p.isBox3(new Box2())).toEqual(false);
        expect(p.isBox3(new Box3())).toEqual(true);
    });
    test('isCSS2DObject', () => {
        expect(p.isCSS2DObject(undefined)).toEqual(false);
        expect(p.isCSS2DObject(null)).toEqual(false);
        expect(p.isCSS2DObject('no')).toEqual(false);
        expect(
            p.isCSS2DObject(
                new CSS2DObject({
                    style: {} as CSSStyleDeclaration,
                    setAttribute: jest.fn() as (arg0: string, arg1: string) => void,
                } as HTMLElement),
            ),
        ).toEqual(true);
    });
});
