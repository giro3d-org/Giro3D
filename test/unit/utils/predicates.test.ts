/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

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
import { expect, it, vitest } from 'vitest';

import * as p from '@giro3d/giro3d/utils/predicates';

it('isObject3D', () => {
    expect(p.isObject3D(null)).toEqual(false);
    expect(p.isObject3D(undefined)).toEqual(false);
    expect(p.isObject3D('no')).toEqual(false);
    expect(p.isObject3D(new Object3D())).toEqual(true);
});
it('isMesh', () => {
    expect(p.isMesh(undefined)).toEqual(false);
    expect(p.isMesh(null)).toEqual(false);
    expect(p.isMesh('no')).toEqual(false);
    expect(p.isMesh(new Mesh())).toEqual(true);
});
it('isLight', () => {
    expect(p.isLight(undefined)).toEqual(false);
    expect(p.isLight(null)).toEqual(false);
    expect(p.isLight('no')).toEqual(false);
    expect(p.isLight(new DirectionalLight())).toEqual(true);
    expect(p.isLight(new PointLight())).toEqual(true);
    expect(p.isLight(new AmbientLight())).toEqual(true);
    expect(p.isLight(new HemisphereLight())).toEqual(true);
});
it('isBufferGeometry', () => {
    expect(p.isBufferGeometry(undefined)).toEqual(false);
    expect(p.isBufferGeometry(null)).toEqual(false);
    expect(p.isBufferGeometry('no')).toEqual(false);
    expect(p.isBufferGeometry(new BufferGeometry())).toEqual(true);
});
it('isTexture', () => {
    expect(p.isTexture(undefined)).toEqual(false);
    expect(p.isTexture(null)).toEqual(false);
    expect(p.isTexture('no')).toEqual(false);
    expect(p.isTexture(new Texture())).toEqual(true);
    expect(p.isTexture(new DataTexture())).toEqual(true);
});
it('isDataTexture', () => {
    expect(p.isDataTexture(undefined)).toEqual(false);
    expect(p.isDataTexture(null)).toEqual(false);
    expect(p.isDataTexture('no')).toEqual(false);
    expect(p.isDataTexture(new Texture())).toEqual(false);
    expect(p.isDataTexture(new DataTexture())).toEqual(true);
});
it('isQuaternion', () => {
    expect(p.isQuaternion(undefined)).toEqual(false);
    expect(p.isQuaternion(null)).toEqual(false);
    expect(p.isQuaternion('no')).toEqual(false);
    expect(p.isQuaternion(new Quaternion())).toEqual(true);
});
it('isEuler', () => {
    expect(p.isEuler(undefined)).toEqual(false);
    expect(p.isEuler(null)).toEqual(false);
    expect(p.isEuler('no')).toEqual(false);
    expect(p.isEuler(new Euler())).toEqual(true);
});
it('isMatrix3', () => {
    expect(p.isMatrix3(undefined)).toEqual(false);
    expect(p.isMatrix3(null)).toEqual(false);
    expect(p.isMatrix3('no')).toEqual(false);
    expect(p.isMatrix3(new Matrix3())).toEqual(true);
});
it('isMatrix4', () => {
    expect(p.isMatrix4(undefined)).toEqual(false);
    expect(p.isMatrix4(null)).toEqual(false);
    expect(p.isMatrix4('no')).toEqual(false);
    expect(p.isMatrix4(new Matrix4())).toEqual(true);
});
it('isPerspectiveCamera', () => {
    expect(p.isPerspectiveCamera(undefined)).toEqual(false);
    expect(p.isPerspectiveCamera(null)).toEqual(false);
    expect(p.isPerspectiveCamera('no')).toEqual(false);
    expect(p.isPerspectiveCamera(new OrthographicCamera())).toEqual(false);
    expect(p.isPerspectiveCamera(new PerspectiveCamera())).toEqual(true);
});
it('isOrthographicCamera', () => {
    expect(p.isOrthographicCamera(undefined)).toEqual(false);
    expect(p.isOrthographicCamera(null)).toEqual(false);
    expect(p.isOrthographicCamera(new PerspectiveCamera())).toEqual(false);
    expect(p.isOrthographicCamera(new OrthographicCamera())).toEqual(true);
});
it('isColor', () => {
    expect(p.isColor(undefined)).toEqual(false);
    expect(p.isColor(null)).toEqual(false);
    expect(p.isColor('no')).toEqual(false);
    expect(p.isColor(new Color('blue'))).toEqual(true);
});
it('isMaterial', () => {
    expect(p.isMaterial(undefined)).toEqual(false);
    expect(p.isMaterial(null)).toEqual(false);
    expect(p.isMaterial('no')).toEqual(false);
    expect(p.isMaterial(new MeshStandardMaterial())).toEqual(true);
});
it('isShaderMaterial', () => {
    expect(p.isShaderMaterial(undefined)).toEqual(false);
    expect(p.isShaderMaterial(null)).toEqual(false);
    expect(p.isShaderMaterial('no')).toEqual(false);
    expect(p.isShaderMaterial(new ShaderMaterial())).toEqual(true);
});
it('isVector2', () => {
    expect(p.isVector2(undefined)).toEqual(false);
    expect(p.isVector2(null)).toEqual(false);
    expect(p.isVector2('no')).toEqual(false);
    expect(p.isVector2(new Vector3())).toEqual(false);
    expect(p.isVector2(new Vector2())).toEqual(true);
});
it('isVector3', () => {
    expect(p.isVector3(undefined)).toEqual(false);
    expect(p.isVector3(null)).toEqual(false);
    expect(p.isVector3('no')).toEqual(false);
    expect(p.isVector3(new Vector2())).toEqual(false);
    expect(p.isVector3(new Vector3())).toEqual(true);
});
it('isVector4', () => {
    expect(p.isVector4(undefined)).toEqual(false);
    expect(p.isVector4(null)).toEqual(false);
    expect(p.isVector4('no')).toEqual(false);
    expect(p.isVector4(new Vector2())).toEqual(false);
    expect(p.isVector4(new Vector4())).toEqual(true);
});
it('isBox3', () => {
    expect(p.isBox3(undefined)).toEqual(false);
    expect(p.isBox3(null)).toEqual(false);
    expect(p.isBox3('no')).toEqual(false);
    expect(p.isBox3(new Box2())).toEqual(false);
    expect(p.isBox3(new Box3())).toEqual(true);
});
it('isCSS2DObject', () => {
    expect(p.isCSS2DObject(undefined)).toEqual(false);
    expect(p.isCSS2DObject(null)).toEqual(false);
    expect(p.isCSS2DObject('no')).toEqual(false);
    expect(
        p.isCSS2DObject(
            new CSS2DObject({
                style: {} as CSSStyleDeclaration,
                setAttribute: vitest.fn() as (arg0: string, arg1: string) => void,
            } as HTMLElement),
        ),
    ).toEqual(true);
});
