/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { register } from 'ol/proj/proj4.js';
import proj4 from 'proj4';
// @ts-expect-error no types
import parseCode from 'proj4/lib/parseCode';

import SRID from './SRID';
import { LinearUnit, AngularUnit, parseUnit, type Unit } from './Unit';

type ID = Record<string, number>;

type WktUnit = { name: string; convert: number; AUTHORITY?: object };

type ProjCS = { type: 'PROJCS'; name: string; UNIT: WktUnit; AUTHORITY?: object };
type VertCS = { UNIT: WktUnit };

type ProjCRS = { ID: ID };

type CompoundCS = { type: 'COMPD_CS'; PROJCS: ProjCS; VERT_CS: VertCS };

function parseLinearUnit(unit: WktUnit): LinearUnit {
    return new LinearUnit(unit.name, unit.convert);
}

function parseSRID(authority: object): SRID {
    const [name, code] = Object.entries(authority)[0];
    return new SRID(name, Number.parseInt(code));
}

function getNicename(obj: object): string {
    if ('name' in obj && typeof obj.name === 'string') {
        return obj.name;
    }
    return '<unknown>';
}

type ProjCSInfos = { name: string; srid?: SRID; unit: LinearUnit };
function getProjCsInfos(projCs: ProjCS): ProjCSInfos {
    const name = getNicename(projCs);
    const unit = parseLinearUnit(projCs.UNIT);

    if (projCs.AUTHORITY) {
        const authority = parseSRID(projCs.AUTHORITY);
        return { name, srid: authority, unit };
    }
    return { name, unit };
}

type Parameters = {
    name: string;
    srid?: SRID;
    horizontal?: { unit: Unit };
    vertical?: { unit: LinearUnit };
    definition?: string;
};

/**
 * Contains information about coordinate systems, as well as methods to register new coordinate systems.
 */
export default class CoordinateSystem {
    /**
     * The EPSG:3857 / pseudo-mercator coordinate systems.
     */
    public static readonly epsg3857 = new CoordinateSystem({
        name: 'WGS 84 / Pseudo-Mercator',
        srid: new SRID('EPSG', 3857),
        horizontal: { unit: LinearUnit.meters },
        vertical: { unit: LinearUnit.meters },
    });
    public static readonly epsg4326 = new CoordinateSystem({
        name: 'WGS 84',
        srid: new SRID('EPSG', 4326),
        horizontal: { unit: AngularUnit.degrees },
        vertical: { unit: LinearUnit.meters },
    });
    public static readonly epsg4978 = new CoordinateSystem({
        name: 'WGS 84',
        srid: new SRID('EPSG', 4978),
        horizontal: { unit: LinearUnit.meters },
        vertical: { unit: LinearUnit.meters },
    });
    public static readonly epsg4979 = new CoordinateSystem({
        name: 'WGS 84',
        srid: new SRID('EPSG', 4979),
        horizontal: { unit: AngularUnit.degrees },
        vertical: { unit: LinearUnit.meters },
    });
    /**
     * A special coordinate system used for spherical projections.
     */
    public static readonly equirectangular = new CoordinateSystem({
        name: 'equirectangular',
        horizontal: { unit: AngularUnit.degrees },
    });

    public static readonly unknown = new CoordinateSystem({ name: 'unknown' });

    private static readonly _registry: Map<string, CoordinateSystem> = new Map([
        ['EPSG:3857', CoordinateSystem.epsg3857],
        ['EPSG:4326', CoordinateSystem.epsg4326],
        ['EPSG:4978', CoordinateSystem.epsg4978],
        ['EPSG:4979', CoordinateSystem.epsg4979],
        ['equirectangular', CoordinateSystem.equirectangular],
        ['unknown', CoordinateSystem.unknown],
    ]);

    /**
     * Registers a coordinate system with the underlying proj and OpenLayers libraries.
     *
     * Note: it is recommended to provide WKT definitions instead of proj strings, since
     * they provide more metadata about the CRS (such as name, SRID, etc).
     *
     * Note 2: some coordinate systems definitions (such as WKT 2's `COMPOUNDCRS`) are
     * not supported by the underlying proj library. However, if you are not planning
     * to use any feature of Giro3D that requires the proj library, you may ignore
     * failures and warnings.
     *
     * @param id - The id of the coordinate system.
     * @param definition - The WKT or proj definition.
     * @param options - Registration options.
     * @example
     * const wkt = `
     * PROJCS["RGF93 v1 / Lambert-93",
     *     GEOGCS["RGF93 v1",
     *         DATUM["Reseau_Geodesique_Francais_1993_v1",
     *             SPHEROID["GRS 1980",6378137,298.257222101],
     *             TOWGS84[0,0,0,0,0,0,0]],
     *         PRIMEM["Greenwich",0,
     *             AUTHORITY["EPSG","8901"]],
     *         UNIT["degree",0.0174532925199433,
     *             AUTHORITY["EPSG","9122"]],
     *         AUTHORITY["EPSG","4171"]],
     *     PROJECTION["Lambert_Conformal_Conic_2SP"],
     *     PARAMETER["latitude_of_origin",46.5],
     *     PARAMETER["central_meridian",3],
     *     PARAMETER["standard_parallel_1",49],
     *     PARAMETER["standard_parallel_2",44],
     *     PARAMETER["false_easting",700000],
     *     PARAMETER["false_northing",6600000],
     *     UNIT["metre",1,
     *         AUTHORITY["EPSG","9001"]],
     *     AXIS["Easting",EAST],
     *     AXIS["Northing",NORTH],
     *     AUTHORITY["EPSG","2154"]]
     * `;
     *
     * const crs = CoordinateSystem.register('EPSG:2154', wkt);
     * console.log(crs.name);
     * @returns A {@link CoordinateSystem} instance.
     */
    public static register(
        /**
         * The ID of the coordinate system.
         */
        id: string,
        /**
         * The WKT or proj definition.
         */
        definition: string,
        options?: {
            /**
             * If true, any error that occurs when registering the
             * coordinate system definition with proj4.js is re-thrown.
             * Otherwise, a simple warning is logged instead.
             */
            throwIfFailedToRegisterWithProj?: boolean;
        },
    ): CoordinateSystem {
        if (this._registry.has(id)) {
            return this._registry.get(id) as CoordinateSystem;
        }
        try {
            this.registerCRSWithProjAndOpenLayers(id, definition);
        } catch (error) {
            // proj4.js is not able to parse all WKT definitions, especially compound CRSes.
            // this does not mean that the coordinate system cannot be used at all, just that
            // it cannot be used by proj4.js or OpenLayers.
            // In other words, if the Giro3D scene is purely 3D without any mapping component
            // that will use proj4.js, then it should be fine.
            if (options?.throwIfFailedToRegisterWithProj === true) {
                throw error;
            } else {
                console.warn(error);
            }
        }
        const crs = CoordinateSystem.fromWkt(definition, id);
        this._registry.set(id, crs);
        return crs;
    }

    /**
     * Mostly used for unit testing.
     * @internal
     */
    public static clearRegistry(): void {
        this._registry.clear();

        this._registry.set('EPSG:3857', CoordinateSystem.epsg3857);
        this._registry.set('EPSG:4326', CoordinateSystem.epsg4326);
        this._registry.set('EPSG:4978', CoordinateSystem.epsg4978);
        this._registry.set('EPSG:4979', CoordinateSystem.epsg4979);
        this._registry.set('equirectangular', CoordinateSystem.equirectangular);
        this._registry.set('unknown', CoordinateSystem.unknown);
    }

    /**
     * Registers a new coordinate reference system.
     * This should be done before creating the instance.
     * This method can be called several times to add multiple CRS.
     *
     * ```js
     *  // register the CRS first...
     *  Instance.registerCRS(
     *  'EPSG:102115',
     *  '+proj=utm +zone=5 +ellps=clrk66 +units=m +no_defs +type=crs');
     *
     *  // ...then create the instance
     *  const instance = new Instance({ crs: 'EPSG:102115' });
     * ```
     * @param name - the short name, or EPSG code to identify this CRS.
     * @param value - the CRS definition, either in proj syntax, or in WKT syntax.
     */
    private static registerCRSWithProjAndOpenLayers(name: string, value: string): void {
        if (!name || name === '') {
            throw new Error('missing CRS name');
        }
        if (!value || value === '') {
            throw new Error('missing CRS PROJ string');
        }

        try {
            // define the CRS with PROJ
            proj4.defs(name, value);
        } catch (e) {
            let message = '';
            if (e instanceof Error) {
                message = ': ' + e.message;
            }
            throw new Error(`failed to register PROJ definition for ${name}${message}`);
        }
        try {
            // register this CRS with OpenLayers
            register(proj4);
        } catch (e) {
            let message = '';
            if (e instanceof Error) {
                message = ': ' + e.message;
            }
            throw new Error(`failed to register PROJ definitions in OpenLayers${message}`);
        }
    }

    public static get(srid: string): CoordinateSystem {
        const crs = this._registry.get(srid);

        if (crs) {
            return crs;
        }

        throw new Error(`coordinate system not found: ${srid}`);
    }

    /**
     * Creates a {@link CoordinateSystem} from its WKT definition.
     *
     * Note: this does not register the coordinate system with proj4.js. Use {@link register} instead.
     * @param wkt - The WKT 1 or WKT 2 definition.
     * @returns The created coordinate system, or throws an error if the definition could not be parsed.
     */
    public static fromWkt(wkt: string, name?: string): CoordinateSystem {
        try {
            const parsed = parseCode(wkt) as ProjCRS | ProjCS | CompoundCS | object;

            if ('ID' in parsed) {
                // WKT 2 / PROJCRS
                return new CoordinateSystem({
                    name: name ?? getNicename(parsed),
                    srid: parseSRID(parsed.ID),
                    definition: wkt,
                });
            } else if ('PROJCS' in parsed) {
                // WKT 1 / COMPD_CS
                const projCsInfos = getProjCsInfos(parsed['PROJCS']);
                const parameters: Parameters = {
                    name: name ?? projCsInfos.name,
                    srid: projCsInfos.srid,
                    definition: wkt,
                    horizontal: { unit: projCsInfos.unit },
                };
                if ('VERT_CS' in parsed) {
                    parameters.vertical = { unit: parseLinearUnit(parsed.VERT_CS.UNIT) };
                }
                return new CoordinateSystem(parameters);
            } else if ('type' in parsed && parsed.type === 'PROJCS') {
                // WKT 1 / PROJCS
                const projCsInfos = getProjCsInfos(parsed);
                return new CoordinateSystem({
                    name: name ?? projCsInfos.name,
                    srid: projCsInfos.srid,
                    definition: wkt,
                    horizontal: { unit: projCsInfos.unit },
                });
            } else {
                let srid: SRID | undefined = undefined;
                let unit: Unit | undefined = undefined;

                if (
                    'AUTHORITY' in parsed &&
                    typeof parsed.AUTHORITY === 'object' &&
                    parsed.AUTHORITY
                ) {
                    srid = parseSRID(parsed.AUTHORITY);
                }

                if ('title' in parsed && typeof parsed.title === 'string') {
                    srid = SRID.parse(parsed.title);
                }

                if ('units' in parsed && typeof parsed.units === 'string') {
                    unit = parseUnit(parsed.units);
                }

                return new CoordinateSystem({
                    name: name ?? getNicename(parsed),
                    srid,
                    horizontal: unit != null ? { unit } : undefined,
                });
            }
        } catch (error: unknown) {
            console.error(`Failed to parse wkt "${wkt}".`);
            throw error;
        }
    }

    public readonly name: string;
    public readonly srid?: SRID;
    public readonly horizontal?: { readonly unit: Unit };
    public readonly vertical?: { readonly unit: LinearUnit };
    public readonly definition?: string;
    public get id(): string {
        if (typeof this.srid !== 'undefined') {
            return this.srid.toString();
        }
        return this.name;
    }
    public constructor(params: Parameters) {
        this.name = params.name;
        this.srid = params.srid;

        if (typeof params.horizontal !== 'undefined') {
            this.horizontal = params.horizontal;
        }
        if (typeof params.vertical !== 'undefined') {
            this.vertical = params.vertical;
        }
        if (typeof params.definition !== 'undefined') {
            this.definition = params.definition;
        }
    }

    public isGeographic(): boolean {
        const unit = this.horizontal?.unit;
        if (AngularUnit.isAngularUnit(unit)) {
            return true;
        }

        return false;
    }

    public get metersPerHorizontalUnit(): number {
        const unit = this.horizontal?.unit;
        if (LinearUnit.isLinearUnit(unit)) {
            return unit.metersPerUnit;
        }
        return 1;
    }

    public get metersPerVerticalUnit(): number {
        const unit = this.vertical?.unit;
        if (LinearUnit.isLinearUnit(unit)) {
            return unit.metersPerUnit;
        }
        return this.metersPerHorizontalUnit;
    }

    public isEpsg(code: number): boolean {
        if (typeof this.srid !== 'undefined') {
            return this.srid.isEpsg(code);
        }
        return false;
    }

    public isEquirectangular(): boolean {
        return this.name === 'equirectangular';
    }

    public isUnknown(): boolean {
        return this.name === 'unknown' && typeof this.definition === 'undefined';
    }

    public equals(other: CoordinateSystem): boolean {
        return this.id === other.id;
    }
}
