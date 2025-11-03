/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { Vector2 } from 'three';
import { describe, expect, it } from 'vitest';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem';
import ProjUtils from '@giro3d/giro3d/utils/ProjUtils';

describe('transformBufferInPlace', () => {
    it('should do nothing if both CRSes are equal', () => {
        const buffer = new Float64Array([0, 1, 2]);
        ProjUtils.transformBufferInPlace(buffer, {
            srcCrs: CoordinateSystem.fromEpsg(1234),
            dstCrs: CoordinateSystem.fromEpsg(1234),
            stride: 3,
        });

        expect(buffer[0]).toEqual(0);
        expect(buffer[1]).toEqual(1);
        expect(buffer[2]).toEqual(2);
    });

    it('should honor the stride, leaving unrelated values untouched', () => {
        const Z = 99999;
        const W = 12345;
        const vec3Buffer = new Float64Array([1.2, 0.2, Z, 2.3, 10.2, Z]);
        const vec4Buffer = new Float64Array([1.2, 0.2, Z, W, 2.3, 10.2, Z, W]);

        ProjUtils.transformBufferInPlace(vec3Buffer, {
            srcCrs: CoordinateSystem.epsg4326,
            dstCrs: CoordinateSystem.epsg3857,
            stride: 3,
        });

        expect(vec3Buffer[0]).toBeCloseTo(133583.38895192827);
        expect(vec3Buffer[1]).toBeCloseTo(22263.943371933852);
        expect(vec3Buffer[2]).toEqual(Z);

        expect(vec3Buffer[3]).toBeCloseTo(256034.82882452922);
        expect(vec3Buffer[4]).toBeCloseTo(1141504.335717432);
        expect(vec3Buffer[5]).toEqual(Z);

        ProjUtils.transformBufferInPlace(vec4Buffer, {
            srcCrs: CoordinateSystem.epsg4326,
            dstCrs: CoordinateSystem.epsg3857,
            stride: 4,
        });

        expect(vec4Buffer[0]).toBeCloseTo(133583.38895192827);
        expect(vec4Buffer[1]).toBeCloseTo(22263.943371933852);
        expect(vec4Buffer[2]).toEqual(Z);
        expect(vec4Buffer[3]).toEqual(W);

        expect(vec4Buffer[4]).toBeCloseTo(256034.82882452922);
        expect(vec4Buffer[5]).toBeCloseTo(1141504.335717432);
        expect(vec4Buffer[6]).toEqual(Z);
        expect(vec4Buffer[7]).toEqual(W);
    });

    it('should honor the offset', () => {
        const Z = 99999;
        const vec3Buffer = new Float64Array([1.2, 0.2, Z, 2.3, 10.2, Z]);

        ProjUtils.transformBufferInPlace(vec3Buffer, {
            srcCrs: CoordinateSystem.epsg4326,
            dstCrs: CoordinateSystem.epsg3857,
            stride: 3,
            offset: new Vector2(-1000, -1000),
        });

        expect(vec3Buffer[0]).toBeCloseTo(132583.38895192827);
        expect(vec3Buffer[1]).toBeCloseTo(21263.943371933852);
        expect(vec3Buffer[2]).toEqual(Z);

        expect(vec3Buffer[3]).toBeCloseTo(255034.82882452922);
        expect(vec3Buffer[4]).toBeCloseTo(1140504.335717432);
        expect(vec3Buffer[5]).toEqual(Z);
    });
});

describe('readCrsFromWkt', () => {
    it('should return correct CRS name for WKT', () => {
        const wkt = `
        PROJCS["RGF93 v1 / Lambert-93",
            GEOGCS["RGF93 v1",
                DATUM["Reseau_Geodesique_Francais_1993_v1",
                    SPHEROID["GRS 1980",6378137,298.257222101],
                    TOWGS84[0,0,0,0,0,0,0]],
                PRIMEM["Greenwich",0,
                    AUTHORITY["EPSG","8901"]],
                UNIT["degree",0.0174532925199433,
                    AUTHORITY["EPSG","9122"]],
                AUTHORITY["EPSG","4171"]],
            PROJECTION["Lambert_Conformal_Conic_2SP"],
            PARAMETER["latitude_of_origin",46.5],
            PARAMETER["central_meridian",3],
            PARAMETER["standard_parallel_1",49],
            PARAMETER["standard_parallel_2",44],
            PARAMETER["false_easting",700000],
            PARAMETER["false_northing",6600000],
            UNIT["metre",1,
                AUTHORITY["EPSG","9001"]],
            AXIS["Easting",EAST],
            AXIS["Northing",NORTH],
            AUTHORITY["EPSG","2154"]]
        `;

        const parsedCrs = CoordinateSystem.fromWkt(wkt);
        expect(parsedCrs).toBeDefined();
        expect(parsedCrs!.name).toEqual('RGF93 v1 / Lambert-93');
        expect(parsedCrs!.srid?.toString()).toEqual('EPSG:2154');
        expect(parsedCrs!.srid?.isEpsg(2154)).toEqual(true);
    });

    it('should return correct CRS name for COMPD_CS WKT without authority', () => {
        const wkt = `
        COMPD_CS["Compound CRS NAD83(2011) / UTM zone 14N + NAVD88 height",
            PROJCS["NAD83(2011) / UTM zone 14N",
                GEOGCS["NAD83(2011)",
                    DATUM["NAD83_National_Spatial_Reference_System_2011",
                        SPHEROID["GRS 1980",6378137,298.257222101]],
                    PRIMEM["Greenwich",0,
                        AUTHORITY["EPSG","8901"]],
                    UNIT["degree",0.0174532925199433,
                        AUTHORITY["EPSG","9122"]],
                    AUTHORITY["EPSG","6318"]],
                PROJECTION["Transverse_Mercator"],
                PARAMETER["latitude_of_origin",0],
                PARAMETER["central_meridian",-99],
                PARAMETER["scale_factor",0.9996],
                PARAMETER["false_easting",500000],
                PARAMETER["false_northing",0],
                UNIT["metre",1,
                    AUTHORITY["EPSG","9001"]],
                AXIS["Easting",EAST],
                AXIS["Northing",NORTH]],
            VERT_CS["NAVD88 height",
                VERT_DATUM["North American Vertical Datum 1988",2005],
                UNIT["metre",1,
                    AUTHORITY["EPSG","9001"]],
                AXIS["Gravity-related height",UP],
                AUTHORITY["EPSG","5703"]]]
        `;

        const parsedCrs = CoordinateSystem.fromWkt(wkt);
        expect(parsedCrs).toBeDefined();
        expect(parsedCrs!.name).toEqual('NAD83(2011) / UTM zone 14N');
        expect(parsedCrs!.srid).toBeUndefined();
    });

    it('should return correct CRS name for PROJCS WKT without authority', () => {
        const wkt = `PROJCS["Projected CRS NAD83(2011) / Tennessee (ftUS) with ellipsoidal NAD83(2011) height demoted to 2D",
    GEOGCS["NAD83(2011)",
        DATUM["NAD83_National_Spatial_Reference_System_2011",
            SPHEROID["GRS 1980",6378137,298.257222101],
            AUTHORITY["EPSG","1116"]],
        PRIMEM["Greenwich",0,
            AUTHORITY["EPSG","8901"]],
        UNIT["degree",0.0174532925199433,
            AUTHORITY["EPSG","9122"]]],
    PROJECTION["Lambert_Conformal_Conic_2SP"],
    PARAMETER["latitude_of_origin",34.3333333333333],
    PARAMETER["central_meridian",-86],
    PARAMETER["standard_parallel_1",36.4166666666667],
    PARAMETER["standard_parallel_2",35.25],
    PARAMETER["false_easting",1968500],
    PARAMETER["false_northing",0],
    UNIT["US survey foot",0.304800609601219],
    AXIS["Easting",EAST],
    AXIS["Northing",NORTH]]`;

        const parsedCrs = CoordinateSystem.fromWkt(wkt);
        expect(parsedCrs).toBeDefined();
        expect(parsedCrs!.name).toEqual(
            'Projected CRS NAD83(2011) / Tennessee (ftUS) with ellipsoidal NAD83(2011) height demoted to 2D',
        );
        expect(parsedCrs!.srid).toBeUndefined();
    });

    it('should return correct CRS name for GEOGCS WKT', () => {
        const wkt = `
        GEOCCS["WGS 84",
            DATUM["WGS_1984",
                SPHEROID["WGS 84",6378137,298.257223563,
                    AUTHORITY["EPSG","7030"]],
                AUTHORITY["EPSG","6326"]],
            PRIMEM["Greenwich",0,
                AUTHORITY["EPSG","8901"]],
            UNIT["metre",1,
                AUTHORITY["EPSG","9001"]],
            AXIS["Geocentric X",OTHER],
            AXIS["Geocentric Y",OTHER],
            AXIS["Geocentric Z",NORTH],
            AUTHORITY["EPSG","4978"]]
        `;

        const parsedCrs = CoordinateSystem.fromWkt(wkt);
        expect(parsedCrs).toBeDefined();
        expect(parsedCrs!.name).toEqual('WGS 84');
        expect(parsedCrs!.srid?.toString()).toEqual('EPSG:4978');
        expect(parsedCrs!.srid?.isEpsg(4978)).toEqual(true);
    });

    describe('should return correct CRS name for WKT 2', () => {
        it('EPSG:3857', () => {
            const wkt = `
            PROJCRS["WGS 84 / Pseudo-Mercator",
                BASEGEOGCRS["WGS 84",
                    ENSEMBLE["World Geodetic System 1984 ensemble",
                        MEMBER["World Geodetic System 1984 (Transit)"],
                        MEMBER["World Geodetic System 1984 (G730)"],
                        MEMBER["World Geodetic System 1984 (G873)"],
                        MEMBER["World Geodetic System 1984 (G1150)"],
                        MEMBER["World Geodetic System 1984 (G1674)"],
                        MEMBER["World Geodetic System 1984 (G1762)"],
                        MEMBER["World Geodetic System 1984 (G2139)"],
                        MEMBER["World Geodetic System 1984 (G2296)"],
                        ELLIPSOID["WGS 84",6378137,298.257223563,
                            LENGTHUNIT["metre",1]],
                        ENSEMBLEACCURACY[2.0]],
                    PRIMEM["Greenwich",0,
                        ANGLEUNIT["degree",0.0174532925199433]],
                    ID["EPSG",4326]],
                CONVERSION["Popular Visualisation Pseudo-Mercator",
                    METHOD["Popular Visualisation Pseudo Mercator",
                        ID["EPSG",1024]],
                    PARAMETER["Latitude of natural origin",0,
                        ANGLEUNIT["degree",0.0174532925199433],
                        ID["EPSG",8801]],
                    PARAMETER["Longitude of natural origin",0,
                        ANGLEUNIT["degree",0.0174532925199433],
                        ID["EPSG",8802]],
                    PARAMETER["False easting",0,
                        LENGTHUNIT["metre",1],
                        ID["EPSG",8806]],
                    PARAMETER["False northing",0,
                        LENGTHUNIT["metre",1],
                        ID["EPSG",8807]]],
                CS[Cartesian,2],
                    AXIS["easting (X)",east,
                        ORDER[1],
                        LENGTHUNIT["metre",1]],
                    AXIS["northing (Y)",north,
                        ORDER[2],
                        LENGTHUNIT["metre",1]],
                USAGE[
                    SCOPE["Web mapping and visualisation."],
                    AREA["World between 85.06°S and 85.06°N."],
                    BBOX[-85.06,-180,85.06,180]],
                ID["EPSG",3857]]
            `;

            const parsedCrs = CoordinateSystem.fromWkt(wkt);
            expect(parsedCrs).toBeDefined();
            expect(parsedCrs!.name).toEqual('WGS 84 / Pseudo-Mercator');
            expect(parsedCrs!.srid?.toString()).toEqual('EPSG:3857');
            expect(parsedCrs!.srid?.isEpsg(3857)).toEqual(true);
        });

        it('EPSG:2154', () => {
            const wkt = `
            PROJCRS["RGF93 v1 / Lambert-93",
                BASEGEOGCRS["RGF93 v1",
                    DATUM["Reseau Geodesique Francais 1993 v1",
                        ELLIPSOID["GRS 1980",6378137,298.257222101,
                            LENGTHUNIT["metre",1]]],
                    PRIMEM["Greenwich",0,
                        ANGLEUNIT["degree",0.0174532925199433]],
                    ID["EPSG",4171]],
                CONVERSION["Lambert-93",
                    METHOD["Lambert Conic Conformal (2SP)",
                        ID["EPSG",9802]],
                    PARAMETER["Latitude of false origin",46.5,
                        ANGLEUNIT["degree",0.0174532925199433],
                        ID["EPSG",8821]],
                    PARAMETER["Longitude of false origin",3,
                        ANGLEUNIT["degree",0.0174532925199433],
                        ID["EPSG",8822]],
                    PARAMETER["Latitude of 1st standard parallel",49,
                        ANGLEUNIT["degree",0.0174532925199433],
                        ID["EPSG",8823]],
                    PARAMETER["Latitude of 2nd standard parallel",44,
                        ANGLEUNIT["degree",0.0174532925199433],
                        ID["EPSG",8824]],
                    PARAMETER["Easting at false origin",700000,
                        LENGTHUNIT["metre",1],
                        ID["EPSG",8826]],
                    PARAMETER["Northing at false origin",6600000,
                        LENGTHUNIT["metre",1],
                        ID["EPSG",8827]]],
                CS[Cartesian,2],
                    AXIS["easting (X)",east,
                        ORDER[1],
                        LENGTHUNIT["metre",1]],
                    AXIS["northing (Y)",north,
                        ORDER[2],
                        LENGTHUNIT["metre",1]],
                USAGE[
                    SCOPE["Engineering survey, topographic mapping."],
                    AREA["France - onshore and offshore, mainland and Corsica (France métropolitaine including Corsica)."],
                    BBOX[41.15,-9.86,51.56,10.38]],
                ID["EPSG",2154]]
            `;

            const parsedCrs = CoordinateSystem.fromWkt(wkt);
            expect(parsedCrs).toBeDefined();
            expect(parsedCrs!.name).toEqual('RGF93 v1 / Lambert-93');
            expect(parsedCrs!.srid?.toString()).toEqual('EPSG:2154');
            expect(parsedCrs!.srid?.isEpsg(2154)).toEqual(true);
        });
    });
});
