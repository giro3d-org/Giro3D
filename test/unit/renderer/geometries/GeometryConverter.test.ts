/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { LineString, MultiLineString, MultiPoint, MultiPolygon, Point, Polygon } from 'ol/geom';
import { Color, Vector3, type MeshBasicMaterial } from 'three';
import { beforeEach, describe, expect, it } from 'vitest';

import type LineStringMesh from '@giro3d/giro3d/renderer/geometries/LineStringMesh';
import type MultiLineStringMesh from '@giro3d/giro3d/renderer/geometries/MultiLineStringMesh';
import type MultiPolygonMesh from '@giro3d/giro3d/renderer/geometries/MultiPolygonMesh';
import type PointMesh from '@giro3d/giro3d/renderer/geometries/PointMesh';
import type PolygonMesh from '@giro3d/giro3d/renderer/geometries/PolygonMesh';

import {
    getFullFillStyle,
    getFullPointStyle,
    getFullStrokeStyle,
} from '@giro3d/giro3d/core/FeatureTypes';
import GeometryConverter from '@giro3d/giro3d/renderer/geometries/GeometryConverter';
import { isPointMesh } from '@giro3d/giro3d/renderer/geometries/PointMesh';
import { nonNull } from '@giro3d/giro3d/utils/tsutils';

const SIMPLE_SQUARE = [
    [
        [0, 0, 0],
        [0, 1, 0],
        [1, 1, 0],
        [1, 0, 0],
        [0, 0, 0],
    ],
];
const SIMPLE_SQUARE_VERTICES = new Float32Array([0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0]);
const SIMPLE_SQUARE_INDICES = new Uint16Array([1, 0, 3, 3, 2, 1]);

const SIMPLE_SQUARE_ON_VERTICAL_PLANE = [
    [
        [0, 0, 0],
        [0, 0, 1],
        [1, 0, 1],
        [1, 0, 0],
        [0, 0, 0],
    ],
];
const SIMPLE_SQUARE_ON_VERTICAL_PLANE_VERTICES = new Float32Array([
    0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0,
]);

/*
 * More or less this shape
 * *----------*
 * |          |
 * |          |
 * |  /\      |
 * | /__\     |
 * |          |
 * *----------* */
const SQUARE_WITH_HOLE = [
    [
        [0, 0, 0],
        [0, 1, 0],
        [1, 1, 0],
        [1, 0, 0],
        [0, 0, 0],
    ],
    [
        [0.2, 0.2, 0],
        [0.2, 0.3, 0],
        [0.3, 0.2, 0],
        [0.2, 0.2, 0],
    ],
];
const SQUARE_WITH_HOLE_VERTICES = new Float32Array([
    0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 0.2, 0.2, 0, 0.2, 0.3, 0, 0.3, 0.2, 0,
]);
// this is the vertices extruded with 1
const EXTRUDED_SQUARE_WITH_HOLE_VERTICES = new Float32Array([
    // bottom face, with the hole
    0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 0.2, 0.2, 0, 0.2, 0.3, 0, 0.3, 0.2, 0,
    // top face, only z changes
    0, 0, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 0.2, 0.2, 1, 0.2, 0.3, 1, 0.3, 0.2, 1,
    // walls on the outer ring
    // 1st wall, first 2 coordinates of bottom face and first 2 coordinates of top face
    0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1,
    // 2nd wall
    0, 1, 0, 1, 1, 0, 0, 1, 1, 1, 1, 1,
    // 3rd
    1, 1, 0, 1, 0, 0, 1, 1, 1, 1, 0, 1,
    // 4rd
    1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1,
    // walls for the hole
    0.2, 0.2, 0, 0.2, 0.3, 0, 0.2, 0.2, 1, 0.2, 0.3, 1, 0.2, 0.3, 0, 0.3, 0.2, 0, 0.2, 0.3, 1, 0.3,
    0.2, 1, 0.3, 0.2, 0, 0.2, 0.2, 0, 0.3, 0.2, 1, 0.2, 0.2, 1,
]);

const SQUARE_WITH_HOLE_INDICES = new Uint16Array([
    0, 4, 5, 6, 4, 0, 3, 2, 1, 1, 0, 5, 6, 0, 3, 3, 1, 5, 5, 6, 3,
]);

describe('build', () => {
    let generator: GeometryConverter;

    beforeEach(() => {
        generator = new GeometryConverter();
    });

    describe('Point', () => {
        it('should convert a Point to a PointMesh', () => {
            const x = 1;
            const y = 2;
            const z = 3;

            const point = new Point([x, y, z]);
            const mesh = generator.build(point, {});

            expect(mesh.isPointMesh).toEqual(true);
            expect(mesh.position).toEqual(new Vector3(x, y, z));
        });

        it('should honor the style', () => {
            const x = 1;
            const y = 2;
            const z = 3;

            const point = new Point([x, y, z]);
            const style = getFullPointStyle({
                color: 'red',
                pointSize: 10,
                renderOrder: 4,
                opacity: 0.2,
                depthTest: true,
            });
            const mesh = generator.build(point, style);

            const material = mesh.material;
            expect(material.color).toEqual(new Color('red'));
            expect(material.opacity).toEqual(0.2);
            expect(material.depthTest).toEqual(true);
        });
    });

    describe('MultiPoint', () => {
        it('should convert a MultiPoint to a MultiPointMesh', () => {
            const multiPoint = new MultiPoint([
                [1, 2, 3],
                [4, 5, 6],
            ]);

            const mesh = generator.build(multiPoint, {});

            expect(mesh.isMultiPointMesh).toEqual(true);
            expect(mesh.children).toHaveLength(2);
            expect(mesh.children[0].position).toEqual(new Vector3(1, 2, 3));
            expect(mesh.children[1].position).toEqual(new Vector3(4, 5, 6));
            expect(isPointMesh(mesh.children[0])).toEqual(true);
            expect(isPointMesh(mesh.children[1])).toEqual(true);
        });

        it('should honor the style', () => {
            const multiPoint = new MultiPoint([
                [1, 2, 3],
                [4, 5, 6],
            ]);
            const style = getFullPointStyle({
                opacity: 0.1,
                color: 'cyan',
                depthTest: false,
                renderOrder: 10,
                pointSize: 12,
                sizeAttenuation: true,
            });

            const mesh = generator.build(multiPoint, style);

            const point0 = mesh.children[0] as PointMesh;
            const point1 = mesh.children[1] as PointMesh;

            expect(point0.material).toBe(point1.material);

            expect(point0.material.opacity).toEqual(0.1);
            expect(point0.material.color).toEqual(new Color('cyan'));
            expect(point0.material.depthTest).toEqual(false);
            expect(point0.material.sizeAttenuation).toEqual(true);
        });
    });

    describe('Polygon', () => {
        it('should return correct geometry for square case', () => {
            const polygon = new Polygon(SIMPLE_SQUARE);

            const fill = getFullFillStyle();
            const mesh = generator.build(polygon, { fill });
            // NOTE: last (closing) vertex removed
            expect(mesh.surface!.geometry.getAttribute('position').array).toEqual(
                SIMPLE_SQUARE_VERTICES,
            );
            expect(mesh.surface!.geometry.index!.array).toEqual(SIMPLE_SQUARE_INDICES);
        });

        it('should return correct geometry for square case when vertices lie in a vertical plane', () => {
            const polygon = new Polygon(SIMPLE_SQUARE_ON_VERTICAL_PLANE);

            const fill = getFullFillStyle();
            const mesh = generator.build(polygon, { fill });
            // NOTE: last (closing) vertex removed
            expect(mesh.surface!.geometry.getAttribute('position').array).toEqual(
                SIMPLE_SQUARE_ON_VERTICAL_PLANE_VERTICES,
            );
            expect(mesh.surface!.geometry.index!.array).toEqual(SIMPLE_SQUARE_INDICES);
        });

        it('should deal with a polygon with a hole', () => {
            const polygon = new Polygon(SQUARE_WITH_HOLE);

            const fill = getFullFillStyle();
            const mesh = generator.build(polygon, { fill, origin: new Vector3(0, 0, 0) });

            expect(mesh.surface!.geometry.getAttribute('position').array).toEqual(
                SQUARE_WITH_HOLE_VERTICES,
            );
            expect(mesh.surface!.geometry.index!.array).toEqual(SQUARE_WITH_HOLE_INDICES);
        });

        it('should deal with a polygon with simple extrusion', () => {
            const polygon = new Polygon([
                [
                    [0, 0, 0],
                    [0, 1, 0],
                    [1, 1, 0],
                    [1, 0, 0],
                    [0, 0, 0],
                ],
                [
                    [0.2, 0.2, 0],
                    [0.2, 0.3, 0],
                    [0.3, 0.2, 0],
                    [0.2, 0.2, 0],
                ],
            ]);

            const fill = getFullFillStyle();
            const mesh = generator.build(polygon, { fill, extrusionOffset: 1 });

            expect(nonNull(mesh.surface).geometry.getAttribute('position').array).toEqual(
                EXTRUDED_SQUARE_WITH_HOLE_VERTICES,
            );
        });

        it('should honor specified origin', () => {
            const polygon = new Polygon(SIMPLE_SQUARE);

            const fill = getFullFillStyle();

            const origin = new Vector3(2, 3, 4);
            const mesh = generator.build(polygon, {
                fill,
                origin,
            });

            // NOTE: last (closing) vertex removed
            const offsetPos = new Float32Array(SIMPLE_SQUARE_VERTICES);
            for (let i = 0; i < offsetPos.length; i += 3) {
                offsetPos[i + 0] -= origin.x;
                offsetPos[i + 1] -= origin.y;
                offsetPos[i + 2] -= origin.z;
            }

            const surface = nonNull(mesh.surface);

            expect(surface.geometry.getAttribute('position').array).toEqual(offsetPos);
            expect(surface.geometry.index!.array).toEqual(SIMPLE_SQUARE_INDICES);
        });

        it('should honor fill style', () => {
            const polygon = new Polygon(SIMPLE_SQUARE);

            const fill = getFullFillStyle({
                opacity: 0.1,
                renderOrder: 30,
                color: 'green',
                depthTest: false,
            });
            const mesh = generator.build(polygon, { fill });

            expect(mesh.isPolygonMesh).toEqual(true);
            expect(mesh.surface).toBeDefined();
            expect(mesh.linearRings).toBeNull();

            const material = mesh.surface!.material as MeshBasicMaterial;

            expect(material.opacity).toEqual(0.1);
            expect(material.color).toEqual(new Color('green'));
            expect(material.depthTest).toEqual(false);
        });

        it('should honor stroke style', () => {
            const polygon = new Polygon(SIMPLE_SQUARE);

            const stroke = getFullStrokeStyle({
                color: 'blue',
                depthTest: false,
                lineWidth: 12,
                renderOrder: 9,
                lineWidthUnits: 'world',
                opacity: 0.4,
            });

            const mesh = generator.build(polygon, { stroke });

            expect(mesh.isPolygonMesh).toEqual(true);
            expect(mesh.surface).toBeNull();
            expect(mesh.linearRings).toHaveLength(1);

            const ring = mesh.linearRings![0];

            expect(ring.material.opacity).toEqual(0.4);
            expect(ring.material.worldUnits).toEqual(true);
            expect(ring.material.linewidth).toEqual(12);
            expect(ring.material.depthTest).toEqual(false);
            expect(ring.material.color).toEqual(new Color('blue'));
        });
    });

    describe('MultiPolygon', () => {
        it('should honor holes', () => {
            const multiPolygon = new MultiPolygon([
                new Polygon(SQUARE_WITH_HOLE),
                new Polygon(SQUARE_WITH_HOLE),
            ]);

            const fill = getFullFillStyle({
                opacity: 0.1,
                renderOrder: 30,
                color: 'green',
                depthTest: false,
            });
            const mesh = generator.build(multiPolygon, { fill }) as MultiPolygonMesh;

            expect(mesh.isMultiPolygonMesh).toEqual(true);
            expect(mesh.children).toHaveLength(2);

            const p0 = mesh.children[0] as PolygonMesh;
            const p1 = mesh.children[0] as PolygonMesh;

            function check(p: PolygonMesh) {
                expect(p.surface).toBeDefined();
                expect(p.linearRings).toBeNull();

                expect(p.surface!.geometry.getAttribute('position').array).toEqual(
                    SQUARE_WITH_HOLE_VERTICES,
                );

                expect(p.surface!.geometry.index!.array).toEqual(SQUARE_WITH_HOLE_INDICES);

                const material = p.surface!.material as MeshBasicMaterial;

                expect(material.opacity).toEqual(0.1);
                expect(material.color).toEqual(new Color('green'));
                expect(material.depthTest).toEqual(false);
            }

            check(p0);
            check(p1);
        });

        it('should return a PolygonMesh if input MultiPolygon has only one geometry with a multipolygon with holes and extrusion', () => {
            const multiPolygon = new MultiPolygon([SQUARE_WITH_HOLE]);
            const fill = getFullFillStyle();
            const mesh = generator.build(multiPolygon, { fill, extrusionOffset: 1 }) as PolygonMesh;

            expect(mesh.isPolygonMesh).toBe(true);
        });

        it('should deal with a multipolygon with holes and extrusion', () => {
            const multiPolygon = new MultiPolygon([SQUARE_WITH_HOLE, SQUARE_WITH_HOLE]);
            const fill = getFullFillStyle();
            const mesh = generator.build(multiPolygon, { fill, extrusionOffset: 1 });

            const polygonMesh = mesh.children[0] as PolygonMesh;

            expect(polygonMesh.surface!.geometry.getAttribute('position').array).toEqual(
                EXTRUDED_SQUARE_WITH_HOLE_VERTICES,
            );
        });

        it('should honor fill style', () => {
            const multiPolygon = new MultiPolygon([
                new Polygon(SIMPLE_SQUARE),
                new Polygon(SIMPLE_SQUARE),
            ]);

            const fill = getFullFillStyle({
                opacity: 0.1,
                renderOrder: 30,
                color: 'green',
                depthTest: false,
            });
            const mesh = generator.build(multiPolygon, { fill }) as MultiPolygonMesh;

            expect(mesh.isMultiPolygonMesh).toEqual(true);
            expect(mesh.children).toHaveLength(2);

            const p0 = mesh.children[0] as PolygonMesh;
            const p1 = mesh.children[0] as PolygonMesh;

            function check(p: PolygonMesh) {
                expect(p.surface).toBeDefined();
                expect(p.linearRings).toBeNull();

                expect(p.surface!.geometry.getAttribute('position').array).toEqual(
                    SIMPLE_SQUARE_VERTICES,
                );

                expect(p.surface!.geometry.index!.array).toEqual(SIMPLE_SQUARE_INDICES);

                const material = p.surface!.material as MeshBasicMaterial;

                expect(material.opacity).toEqual(0.1);
                expect(material.color).toEqual(new Color('green'));
                expect(material.depthTest).toEqual(false);
            }

            check(p0);
            check(p1);
        });

        it('should honor stroke style', () => {
            const multiPolygon = new MultiPolygon([
                new Polygon(SIMPLE_SQUARE),
                new Polygon(SIMPLE_SQUARE),
            ]);

            const stroke = getFullStrokeStyle({
                color: 'blue',
                depthTest: false,
                lineWidth: 12,
                renderOrder: 9,
                lineWidthUnits: 'world',
                opacity: 0.4,
            });
            const mesh = generator.build(multiPolygon, {
                stroke,
                origin: new Vector3(0, 0, 0),
            }) as MultiPolygonMesh;

            expect(mesh.isMultiPolygonMesh).toEqual(true);
            expect(mesh.children).toHaveLength(2);

            const p0 = mesh.children[0] as PolygonMesh;
            const p1 = mesh.children[0] as PolygonMesh;

            function check(polygonMesh: PolygonMesh) {
                const ring = polygonMesh.linearRings![0];

                expect(ring.material.opacity).toEqual(0.4);
                expect(ring.material.worldUnits).toEqual(true);
                expect(ring.material.linewidth).toEqual(12);
                expect(ring.material.depthTest).toEqual(false);
                expect(ring.material.color).toEqual(new Color('blue'));
            }

            check(p0);
            check(p1);
        });
    });

    describe('LineString', () => {
        it('should convert a LineString to a LineStringMesh', () => {
            const coordinates = [
                [0, 0, 0],
                [1, 1, 0],
            ];
            const lineString = new LineString(coordinates);

            const style = getFullStrokeStyle({
                opacity: 0.7,
                color: 'orange',
                depthTest: false,
                lineWidth: 11,
                lineWidthUnits: 'world',
                renderOrder: 10,
            });

            const mesh = generator.build(lineString, style);

            expect(mesh.isLineStringMesh).toEqual(true);

            expect(mesh.material.opacity).toEqual(0.7);
            expect(mesh.material.color).toEqual(new Color('orange'));
            expect(mesh.material.depthTest).toEqual(false);
            expect(mesh.material.worldUnits).toEqual(true);
            expect(mesh.material.linewidth).toEqual(11);
        });
    });

    describe('MultiLineString', () => {
        it('should convert a MultiLineString to a LineStringMesh if it has only one geometry', () => {
            const coordinates = [
                [0, 0, 0],
                [1, 1, 0],
            ];
            const multiLineString = new MultiLineString([new LineString(coordinates)]);

            const style = getFullStrokeStyle({
                opacity: 0.7,
                color: 'orange',
                depthTest: false,
                lineWidth: 11,
                lineWidthUnits: 'world',
                renderOrder: 10,
            });

            const mesh = generator.build(multiLineString, style) as LineStringMesh;

            expect(mesh.isLineStringMesh).toEqual(true);

            function check(lineString: LineStringMesh) {
                expect(lineString.material.opacity).toEqual(0.7);
                expect(lineString.material.color).toEqual(new Color('orange'));
                expect(lineString.material.depthTest).toEqual(false);
                expect(lineString.material.worldUnits).toEqual(true);
                expect(lineString.material.linewidth).toEqual(11);
            }

            check(mesh);
        });

        it('should convert a MultiLineString to a MultiLineStringMesh', () => {
            const coordinates = [
                [0, 0, 0],
                [1, 1, 0],
            ];
            const multiLineString = new MultiLineString([
                new LineString(coordinates),
                new LineString(coordinates),
            ]);

            const style = getFullStrokeStyle({
                opacity: 0.7,
                color: 'orange',
                depthTest: false,
                lineWidth: 11,
                lineWidthUnits: 'world',
                renderOrder: 10,
            });

            const mesh = generator.build(multiLineString, style) as MultiLineStringMesh;

            expect(mesh.isMultiLineStringMesh).toEqual(true);

            function check(lineString: LineStringMesh) {
                expect(lineString.material.opacity).toEqual(0.7);
                expect(lineString.material.color).toEqual(new Color('orange'));
                expect(lineString.material.depthTest).toEqual(false);
                expect(lineString.material.worldUnits).toEqual(true);
                expect(lineString.material.linewidth).toEqual(11);
            }

            check(mesh.children[0] as LineStringMesh);
            check(mesh.children[1] as LineStringMesh);
        });
    });
});
