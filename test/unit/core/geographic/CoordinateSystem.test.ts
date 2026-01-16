/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';

import CoordinateSystem from '@giro3d/giro3d/core/geographic/CoordinateSystem';
import { AngularUnit, LinearUnit } from '@giro3d/giro3d/core/geographic/Unit';
import { readDataFileSync, readJsonSync } from '../../../data/utils';

const WKT_UTM_ZONE_11 = `
    PROJCRS["WGS 84 / UTM zone 11N",
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
        CONVERSION["UTM zone 11N",
            METHOD["Transverse Mercator",
                ID["EPSG",9807]],
            PARAMETER["Latitude of natural origin",0,
                ANGLEUNIT["degree",0.0174532925199433],
                ID["EPSG",8801]],
            PARAMETER["Longitude of natural origin",-117,
                ANGLEUNIT["degree",0.0174532925199433],
                ID["EPSG",8802]],
            PARAMETER["Scale factor at natural origin",0.9996,
                SCALEUNIT["unity",1],
                ID["EPSG",8805]],
            PARAMETER["False easting",500000,
                LENGTHUNIT["metre",1],
                ID["EPSG",8806]],
            PARAMETER["False northing",0,
                LENGTHUNIT["metre",1],
                ID["EPSG",8807]]],
        CS[Cartesian,2],
            AXIS["(E)",east,
                ORDER[1],
                LENGTHUNIT["metre",1]],
            AXIS["(N)",north,
                ORDER[2],
                LENGTHUNIT["metre",1]],
        USAGE[
            SCOPE["Navigation and medium accuracy spatial referencing."],
            AREA["Between 120°W and 114°W, northern hemisphere between equator and 84°N, onshore and offshore. Canada - Alberta; British Columbia (BC); Northwest Territories (NWT); Nunavut. Mexico. United States (USA)."],
            BBOX[0,-120,84,-114]],
        ID["EPSG",32611]]
        `;

beforeEach(() => {
    CoordinateSystem.clearRegistry();
});

describe('fromWkt', () => {
    describe('WKT 1', () => {
        it('should parse correctly a PROJCS with AUTHORITY', () => {
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
            expect((coordinateSystem.horizontal?.unit as LinearUnit).metersPerUnit).toEqual(1);
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
            expect((coordinateSystem.horizontal?.unit as LinearUnit).metersPerUnit).toEqual(1);
            expect(coordinateSystem.vertical).toBeDefined();
            expect(coordinateSystem.vertical?.unit.name).toEqual('metre');
            expect(coordinateSystem.vertical?.unit.metersPerUnit).toEqual(1);
            expect(coordinateSystem.metersPerVerticalUnit).toBe(1);
        });

        it('should parse correctly a PROJCS WKT without authority and us survey foot horizontal unit', () => {
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
            expect((coordinateSystem.horizontal?.unit as LinearUnit).metersPerUnit).toEqual(
                0.304800609601219,
            );
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
            expect(coordinateSystem.horizontal).toBeDefined();
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
            expect(coordinateSystem.isEpsg(2992)).toEqual(true);
            expect(coordinateSystem.name).toEqual('NAD83 / Oregon GIC Lambert (ft)');
            expect(coordinateSystem.srid).toBeDefined();
            expect(coordinateSystem.srid?.isEpsg(2992)).toEqual(true);
            expect(coordinateSystem.horizontal).toBeDefined();
            expect(coordinateSystem.horizontal?.unit.name).toEqual('foot');
            expect(coordinateSystem.vertical).toBeDefined();
            expect(coordinateSystem.vertical?.unit.name).toEqual('us survey foot');
            expect(coordinateSystem.vertical?.unit.metersPerUnit).toEqual(0.304800609601219);
            expect(coordinateSystem.metersPerVerticalUnit).toBe(0.304800609601219);
            expect(coordinateSystem.metersPerHorizontalUnit).toBe(0.3048);
        });

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
    });

    describe('WKT 2', () => {
        it('should parse correctly a PROJCRS', () => {
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
            expect(coordinateSystem.horizontal).toBeDefined();
            expect(coordinateSystem.vertical).toBeUndefined();
            expect(coordinateSystem.metersPerVerticalUnit).toBe(1);
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

            it('should correctly parse EPSG:3857', () => {
                const wkt = `
                PROJCS["WGS 84 / Pseudo-Mercator",
                    GEOGCS["WGS 84",
                        DATUM["WGS_1984",
                            SPHEROID["WGS 84",6378137,298.257223563,
                                AUTHORITY["EPSG","7030"]],
                            AUTHORITY["EPSG","6326"]],
                        PRIMEM["Greenwich",0,
                            AUTHORITY["EPSG","8901"]],
                        UNIT["degree",0.0174532925199433,
                            AUTHORITY["EPSG","9122"]],
                        AUTHORITY["EPSG","4326"]],
                    PROJECTION["Mercator_1SP"],
                    PARAMETER["central_meridian",0],
                    PARAMETER["scale_factor",1],
                    PARAMETER["false_easting",0],
                    PARAMETER["false_northing",0],
                    UNIT["metre",1,
                        AUTHORITY["EPSG","9001"]],
                    AXIS["Easting",EAST],
                    AXIS["Northing",NORTH],
                    EXTENSION["PROJ4","+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs"],
                    AUTHORITY["EPSG","3857"]]
                `;

                const coordinateSystem = CoordinateSystem.fromWkt(wkt);
                expect(coordinateSystem).toBeDefined();
                expect(coordinateSystem.isEpsg(3857)).toEqual(true);
                expect(coordinateSystem.name).toEqual('WGS 84 / Pseudo-Mercator');
                expect(coordinateSystem.srid).toBeDefined();
                expect(coordinateSystem.srid?.isEpsg(3857)).toEqual(true);
                expect(coordinateSystem.horizontal).toBeDefined();
                expect(coordinateSystem.horizontal?.unit.name).toEqual('metre');
                expect((coordinateSystem.horizontal?.unit as LinearUnit).metersPerUnit).toEqual(1);
                expect(coordinateSystem.vertical).toBeUndefined();
                expect(coordinateSystem.metersPerVerticalUnit).toBe(1);
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
});

describe('presets', () => {
    it('unknown', () => {
        const coordinateSystem = CoordinateSystem.unknown;
        expect(coordinateSystem.id).toEqual('unknown');
        expect(coordinateSystem.isUnknown()).toEqual(true);
    });

    it('equirectangular', () => {
        const coordinateSystem = CoordinateSystem.equirectangular;
        expect(coordinateSystem.id).toEqual('equirectangular');
        expect(coordinateSystem.isEquirectangular()).toEqual(true);
    });

    it('epsg3857', () => {
        expect(CoordinateSystem.epsg3857.isEpsg(3857)).toEqual(true);
        expect(CoordinateSystem.epsg3857.horizontal!.unit).toEqual(LinearUnit.meters);
        expect(CoordinateSystem.epsg3857.vertical!.unit).toEqual(LinearUnit.meters);
    });

    it('epsg4326', () => {
        expect(CoordinateSystem.epsg4326.isEpsg(4326)).toEqual(true);
        expect(CoordinateSystem.epsg4326.horizontal!.unit).toEqual(AngularUnit.degrees);
    });

    it('epsg4978', () => {
        expect(CoordinateSystem.epsg4978.isEpsg(4978)).toEqual(true);
        expect(CoordinateSystem.epsg4978.horizontal!.unit).toEqual(LinearUnit.meters);
        expect(CoordinateSystem.epsg4978.vertical!.unit).toEqual(LinearUnit.meters);
    });

    it('epsg4979', () => {
        expect(CoordinateSystem.epsg4979.isEpsg(4979)).toEqual(true);
        expect(CoordinateSystem.epsg4979.horizontal!.unit).toEqual(AngularUnit.degrees);
        expect(CoordinateSystem.epsg4979.vertical!.unit).toEqual(LinearUnit.meters);
    });
});

describe('register', () => {
    it('should always return the same CoordinateSystem instance for the given SRID', () => {
        const crs = CoordinateSystem.register(
            'IGNF:WGS84G',
            'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]',
        );

        const crs2 = CoordinateSystem.register(
            'IGNF:WGS84G',
            'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]',
        );

        expect(crs).toBeDefined();
        expect(crs).toBe(crs2);
    });

    it('should trim the input string', () => {
        const wkt = `
        PROJCRS["WGS 84 / UTM zone 11N",
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
            CONVERSION["UTM zone 11N",
                METHOD["Transverse Mercator",
                    ID["EPSG",9807]],
                PARAMETER["Latitude of natural origin",0,
                    ANGLEUNIT["degree",0.0174532925199433],
                    ID["EPSG",8801]],
                PARAMETER["Longitude of natural origin",-117,
                    ANGLEUNIT["degree",0.0174532925199433],
                    ID["EPSG",8802]],
                PARAMETER["Scale factor at natural origin",0.9996,
                    SCALEUNIT["unity",1],
                    ID["EPSG",8805]],
                PARAMETER["False easting",500000,
                    LENGTHUNIT["metre",1],
                    ID["EPSG",8806]],
                PARAMETER["False northing",0,
                    LENGTHUNIT["metre",1],
                    ID["EPSG",8807]]],
            CS[Cartesian,2],
                AXIS["(E)",east,
                    ORDER[1],
                    LENGTHUNIT["metre",1]],
                AXIS["(N)",north,
                    ORDER[2],
                    LENGTHUNIT["metre",1]],
            USAGE[
                SCOPE["Navigation and medium accuracy spatial referencing."],
                AREA["Between 120°W and 114°W, northern hemisphere between equator and 84°N, onshore and offshore. Canada - Alberta; British Columbia (BC); Northwest Territories (NWT); Nunavut. Mexico. United States (USA)."],
                BBOX[0,-120,84,-114]],
            ID["EPSG",32611]]
            `;

        const crs = CoordinateSystem.register('EPSG:32611', wkt);
        expect(crs.id).toEqual('EPSG:32611');
    });
});

describe('get', () => {
    it('should return a previously registered CRS', () => {
        const crs = CoordinateSystem.register(
            'IGNF:WGS84G',
            'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]',
        );

        const crs2 = CoordinateSystem.get('IGNF:WGS84G');

        expect(crs).toBeDefined();
        expect(crs).toBe(crs2);
    });
});

describe('id', () => {
    it('should return the custom id if specified', () => {
        const crs = CoordinateSystem.fromWkt(WKT_UTM_ZONE_11, { id: 'FOO' });

        expect(crs).toBeDefined();
        expect(crs.id).toEqual('FOO');
        expect(crs.name).toEqual('WGS 84 / UTM zone 11N');
        expect(crs.srid?.toString()).toEqual('EPSG:32611');
    });

    it('should return the SRID if specified, when no ID is present', () => {
        const crs = CoordinateSystem.fromWkt(WKT_UTM_ZONE_11);

        expect(crs).toBeDefined();
        expect(crs.id).toEqual('EPSG:32611');
        expect(crs.name).toEqual('WGS 84 / UTM zone 11N');
        expect(crs.srid?.toString()).toEqual('EPSG:32611');
    });

    it('should return the name if specified, when no ID nor SRID are present', () => {
        const wkt =
            'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';
        const crs = CoordinateSystem.fromWkt(wkt);

        expect(crs).toBeDefined();
        expect(crs.id).toEqual('GCS_WGS_1984');
        expect(crs.name).toEqual('GCS_WGS_1984');
        expect(crs.srid).toBeUndefined();
    });
});

describe('registerMany', () => {
    it('should accept all systems in a PostGIS database', () => {
        const contents = readJsonSync('spatial_ref_sys.json');
        const json = JSON.parse(contents);
        const list = json.crs as { id: string; definition: string }[];

        const blacklist = new Set(['EPSG:3823', 'EPSG:3888', 'EPSG:6979', 'EPSG:6982']);

        const filtered = list.filter(
            x =>
                !blacklist.has(x.id) &&
                !x.definition.includes('GEOCCS') &&
                !x.definition.includes('BOUNDCRS'),
        );

        CoordinateSystem.registerMany(filtered);
    });
});
