/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { describe, expect, it } from 'vitest';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/coordinate-system/CoordinateSystem';

describe('fromWkt', () => {
    it('should handle correctly equirectangular', () => {
        const coordinateSystem = CoordinateSystem.equirectangular;
        expect(coordinateSystem.id).toEqual('equirectangular');
        expect(coordinateSystem.isEquirectangular()).toEqual(true);
    });

    it('should handle correctly unknown', () => {
        const coordinateSystem = CoordinateSystem.unknown;
        expect(coordinateSystem.id).toEqual('unknown');
        expect(coordinateSystem.isUnknown()).toEqual(true);
    });

    it('should parse correctly a PROJSG with AUTHORITY', () => {
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

        const coordinateSystem = CoordinateSystem.fromWkt(wkt);
        expect(coordinateSystem).toBeDefined();
        expect(coordinateSystem.isEpsg(2154)).toEqual(true);
        expect(coordinateSystem.name).toEqual('RGF93 v1 / Lambert-93');
        expect(coordinateSystem.srid).toBeDefined();
        expect(coordinateSystem.srid?.isEpsg(2154)).toEqual(true);
        expect(coordinateSystem.horizontal).toBeDefined();
        expect(coordinateSystem.horizontal?.unit.name).toEqual('metre');
        expect(coordinateSystem.horizontal?.unit.metersPerUnit).toEqual(1);
        expect(coordinateSystem.vertical).toBeUndefined();
        expect(coordinateSystem.metersPerVerticalUnit).toBe(1);
    });

    it('should parse correctly a COMPD_CS without AUTHORITY', () => {
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

        const coordinateSystem = CoordinateSystem.fromWkt(wkt);
        expect(coordinateSystem).toBeDefined();
        expect(coordinateSystem.name).toEqual('NAD83(2011) / UTM zone 14N');
        expect(coordinateSystem.srid).toBeUndefined();
        expect(coordinateSystem.horizontal).toBeDefined();
        expect(coordinateSystem.horizontal?.unit.name).toEqual('metre');
        expect(coordinateSystem.horizontal?.unit.metersPerUnit).toEqual(1);
        expect(coordinateSystem.vertical).toBeDefined();
        expect(coordinateSystem.vertical?.unit.name).toEqual('metre');
        expect(coordinateSystem.vertical?.unit.metersPerUnit).toEqual(1);
        expect(coordinateSystem.metersPerVerticalUnit).toBe(1);
    });

    it('should parse correctly a PROJCS WKT without authority and us foot horizontal unit', () => {
        const wkt = `
        PROJCS["Projected CRS NAD83(2011) / Tennessee (ftUS) with ellipsoidal NAD83(2011) height demoted to 2D",
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
            AXIS["Northing",NORTH]]
        `;

        const coordinateSystem = CoordinateSystem.fromWkt(wkt);
        expect(coordinateSystem).toBeDefined();
        expect(coordinateSystem.name).toEqual(
            'Projected CRS NAD83(2011) / Tennessee (ftUS) with ellipsoidal NAD83(2011) height demoted to 2D',
        );
        expect(coordinateSystem.srid).toBeUndefined();
        expect(coordinateSystem.horizontal).toBeDefined();
        expect(coordinateSystem.horizontal?.unit.name).toEqual('us survey foot');
        expect(coordinateSystem.horizontal?.unit.metersPerUnit).toEqual(0.304800609601219);
        expect(coordinateSystem.vertical).toBeUndefined();
        expect(coordinateSystem.metersPerVerticalUnit).toBe(0.304800609601219);
    });

    it('should parse correctly a GEOGCS WKT', () => {
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

        const coordinateSystem = CoordinateSystem.fromWkt(wkt);
        expect(coordinateSystem).toBeDefined();
        expect(coordinateSystem.isEpsg(4978)).toEqual(true);
        expect(coordinateSystem.name).toEqual('WGS 84');
        expect(coordinateSystem.srid).toBeDefined();
        expect(coordinateSystem.srid?.isEpsg(4978)).toEqual(true);
        expect(coordinateSystem.horizontal).toBeUndefined();
        expect(coordinateSystem.vertical).toBeUndefined();
        expect(coordinateSystem.metersPerVerticalUnit).toBe(1);
    });

    it('should parse correctly a WKT 2', () => {
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

        const coordinateSystem = CoordinateSystem.fromWkt(wkt);
        expect(coordinateSystem).toBeDefined();
        expect(coordinateSystem.isEpsg(2154)).toEqual(true);
        expect(coordinateSystem.name).toEqual('RGF93 v1 / Lambert-93');
        expect(coordinateSystem.srid).toBeDefined();
        expect(coordinateSystem.srid?.isEpsg(2154)).toEqual(true);
        expect(coordinateSystem.horizontal).toBeUndefined();
        expect(coordinateSystem.vertical).toBeUndefined();
        expect(coordinateSystem.metersPerVerticalUnit).toBe(1);
    });

    it('should parse correctly a COMPD_CS with foot horizontal unit and us foot vertical unit', () => {
        const wkt = `
        COMPD_CS["NAD83 / Oregon GIC Lambert (ft) + NAVD88 height (ftUS)",
            PROJCS["NAD83 / Oregon GIC Lambert (ft)",
                GEOGCS["NAD83",
                    DATUM["North_American_Datum_1983",
                        SPHEROID["GRS 1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],
                        AUTHORITY["EPSG","6269"]],
                    PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],
                    UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],
                    AUTHORITY["EPSG","4269"]],
                PROJECTION["Lambert_Conformal_Conic_2SP"],
                PARAMETER["latitude_of_origin",41.75],
                PARAMETER["central_meridian",-120.5],
                PARAMETER["standard_parallel_1",43],
                PARAMETER["standard_parallel_2",45.5],
                PARAMETER["false_easting",1312335.958],
                PARAMETER["false_northing",0],
                UNIT["foot",0.3048,AUTHORITY["EPSG","9002"]],
                AXIS["Easting",EAST],
                AXIS["Northing",NORTH],
                AUTHORITY["EPSG","2992"]],
            VERT_CS["NAVD88 height (ftUS)",
                VERT_DATUM["North American Vertical Datum 1988",2005,AUTHORITY["EPSG","5103"]],
                UNIT["US survey foot",0.304800609601219,AUTHORITY["EPSG","9003"]],
                AXIS["Gravity-related height",UP],
                AUTHORITY["EPSG","6360"]]]
        `;

        const coordinateSystem = CoordinateSystem.fromWkt(wkt);
        expect(coordinateSystem).toBeDefined();
        expect(coordinateSystem.isEpsg()).toEqual(true);
        expect(coordinateSystem.isEpsg(2992)).toEqual(true);
        expect(coordinateSystem.name).toEqual('NAD83 / Oregon GIC Lambert (ft)');
        expect(coordinateSystem.srid).toBeDefined();
        expect(coordinateSystem.srid?.isEpsg(2992)).toEqual(true);
        expect(coordinateSystem.horizontal).toBeDefined();
        expect(coordinateSystem.horizontal?.unit.name).toEqual('foot');
        expect(coordinateSystem.horizontal?.unit.metersPerUnit).toEqual(0.3048);
        expect(coordinateSystem.vertical).toBeDefined();
        expect(coordinateSystem.vertical?.unit.name).toEqual('us survey foot');
        expect(coordinateSystem.vertical?.unit.metersPerUnit).toEqual(0.304800609601219);
        expect(coordinateSystem.metersPerVerticalUnit).toBe(0.304800609601219);
    });
});

describe('fromEpsg', () => {
    it('fromEpsg', () => {
        const coordinateSystem = CoordinateSystem.fromEpsg(1234);
        expect(coordinateSystem).toBeDefined();
        expect(coordinateSystem.isEpsg(1234)).toEqual(true);
        expect(coordinateSystem.name).toEqual('EPSG:1234');
        expect(coordinateSystem.srid).toBeDefined();
        expect(coordinateSystem.srid?.isEpsg(1234)).toEqual(true);
    });
});

describe('epsg presets', () => {
    it('epsg3857', () => {
        expect(CoordinateSystem.epsg3857.isEpsg(3857)).toEqual(true);
    });

    it('epsg4326', () => {
        expect(CoordinateSystem.epsg4326.isEpsg(4326)).toEqual(true);
    });

    it('epsg4978', () => {
        expect(CoordinateSystem.epsg4978.isEpsg(4978)).toEqual(true);
    });

    it('epsg4979', () => {
        expect(CoordinateSystem.epsg4979.isEpsg(4979)).toEqual(true);
    });
});
