/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import GeoJSONUtils from '@giro3d/giro3d/utils/GeoJSONUtils';
import { describe, expect, it } from 'vitest';

const dataSet = [
    { type: 'Point', flat3Coordinates: [[1, 2, 3]], geojsonCoordinates: [1, 2, 3] },
    {
        type: 'MultiPoint',
        flat3Coordinates: [
            [1, 2, 3],
            [4, 5, 6],
        ],
        geojsonCoordinates: [
            [1, 2, 3],
            [4, 5, 6],
        ],
    },
    {
        type: 'LineString',
        flat3Coordinates: [
            [1, 2, 3],
            [4, 5, 6],
        ],
        geojsonCoordinates: [
            [1, 2, 3],
            [4, 5, 6],
        ],
    },
    // Polygons: just an outer ring
    {
        type: 'Polygon',
        flat3Coordinates: [
            [1, 2, 3],
            [4, 5, 6],
            [1, 2, 3],
        ],
        geojsonCoordinates: [
            [
                [1, 2, 3],
                [4, 5, 6],
                [1, 2, 3],
            ],
        ],
    },
    // MultiLineString: not very multi, assume just one LineString...
    {
        type: 'MultiLineString',
        flat3Coordinates: [
            [1, 2, 3],
            [4, 5, 6],
            [7, 8, 9],
        ],
        geojsonCoordinates: [
            [
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9],
            ],
        ],
    },
    // MultiPolygon: not very multi, assume just one Polygon...
    {
        type: 'MultiPolygon',
        flat3Coordinates: [
            [1, 2, 3],
            [4, 5, 6],
            [1, 2, 3],
        ],
        geojsonCoordinates: [
            [
                [
                    [1, 2, 3],
                    [4, 5, 6],
                    [1, 2, 3],
                ],
            ],
        ],
    },
];

describe('toFlatCoordinates', () => {
    it.each(dataSet)(
        'should return flat coordinates for $type',
        ({ type, flat3Coordinates, geojsonCoordinates }) => {
            const geometry = {
                type,
                coordinates: geojsonCoordinates,
            };

            const flatCoords = GeoJSONUtils.toFlatCoordinates(geometry as GeoJSON.Geometry);

            expect(flatCoords).toEqual(flat3Coordinates.flat(3));
        },
    );

    it('should fail on GeometryCollection', () => {
        const geometry: GeoJSON.Geometry = {
            type: 'GeometryCollection',
            geometries: [],
        };

        expect(() => GeoJSONUtils.toFlatCoordinates(geometry)).toThrowError();
    });
});

describe('fromFlat3Coordinates', () => {
    it.each(dataSet)(
        'should return a geometry for $type',
        ({ type, flat3Coordinates, geojsonCoordinates }) => {
            const geom = GeoJSONUtils.fromFlat3Coordinates(
                flat3Coordinates as [number, number, number][],
                type as GeoJSON.GeoJsonGeometryTypes,
            );

            expect(geom).toEqual({
                type,
                coordinates: geojsonCoordinates,
            });
        },
    );

    it('should fail on GeometryCollection', () => {
        expect(() => GeoJSONUtils.fromFlat3Coordinates([], 'GeometryCollection')).toThrowError();
    });

    it('should fail on other type of geometry', () => {
        expect(() =>
            GeoJSONUtils.fromFlat3Coordinates([], 'Circle' as GeoJSON.GeoJsonGeometryTypes),
        ).toThrowError();
    });
});

describe('fromFlatCoordinates', () => {
    it.each(dataSet)(
        'should return a geometry for $type',
        ({ type, flat3Coordinates, geojsonCoordinates }) => {
            const geom = GeoJSONUtils.fromFlatCoordinates(
                flat3Coordinates.flat(3),
                type as GeoJSON.GeoJsonGeometryTypes,
            );

            expect(geom).toEqual({
                type,
                coordinates: geojsonCoordinates,
            });
        },
    );

    it('should fail on GeometryCollection', () => {
        expect(() => GeoJSONUtils.fromFlat3Coordinates([], 'GeometryCollection')).toThrowError();
    });

    it('should fail on other type of geometry', () => {
        expect(() =>
            GeoJSONUtils.fromFlat3Coordinates([], 'Circle' as GeoJSON.GeoJsonGeometryTypes),
        ).toThrowError();
    });
});
