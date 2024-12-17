import ProjUtils from '@giro3d/giro3d/utils/ProjUtils';
import { Vector2 } from 'three';

describe('transformBufferInPlace', () => {
    it('should do nothing if both CRSes are equal', () => {
        const buffer = new Float64Array([0, 1, 2]);
        ProjUtils.transformBufferInPlace(buffer, {
            srcCrs: 'EPSG:1234',
            dstCrs: 'EPSG:1234',
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
            srcCrs: 'EPSG:4326',
            dstCrs: 'EPSG:3857',
            stride: 3,
        });

        expect(vec3Buffer[0]).toBeCloseTo(133583.38895192827);
        expect(vec3Buffer[1]).toBeCloseTo(22263.943371933852);
        expect(vec3Buffer[2]).toEqual(Z);

        expect(vec3Buffer[3]).toBeCloseTo(256034.82882452922);
        expect(vec3Buffer[4]).toBeCloseTo(1141504.335717432);
        expect(vec3Buffer[5]).toEqual(Z);

        ProjUtils.transformBufferInPlace(vec4Buffer, {
            srcCrs: 'EPSG:4326',
            dstCrs: 'EPSG:3857',
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
            srcCrs: 'EPSG:4326',
            dstCrs: 'EPSG:3857',
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

describe('getWKTCrsCode', () => {
    it('should return correct CRS code for WKT', () => {
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

        expect(ProjUtils.getWKTCrsCode(wkt)).toEqual('EPSG:2154');
    });

    it('should return correct CRS code for WKT 2', () => {
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

        expect(ProjUtils.getWKTCrsCode(wkt)).toEqual('EPSG:2154');
    });
});
