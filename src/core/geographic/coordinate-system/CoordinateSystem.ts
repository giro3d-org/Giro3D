/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

// @ts-expect-error no types
import parseCode from 'proj4/lib/parseCode';

import LinearUnit from './LinearUnit';
import SRID from './SRID';

type ID = Record<string, number>;

type Unit = { name: string; convert: number; AUTHORITY?: object };

type ProjCS = { type: 'PROJCS'; name: string; UNIT: Unit; AUTHORITY?: object };
type VertCS = { UNIT: Unit };

type ProjCRS = { ID: ID };

type CompoundCS = { type: 'COMPD_CS'; PROJCS: ProjCS; VERT_CS: VertCS };

function parseLinearUnit(unit: Unit): LinearUnit {
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
    horizontal?: { unit: LinearUnit };
    vertical?: { unit: LinearUnit };
    definition?: string;
};

export default class CoordinateSystem {
    public static fromWkt(wkt: string): CoordinateSystem {
        try {
            const parsed = parseCode(wkt) as ProjCRS | ProjCS | CompoundCS | object;

            if ('ID' in parsed) {
                // WKT 2 / PROJCRS
                return new CoordinateSystem({
                    name: getNicename(parsed),
                    srid: parseSRID(parsed.ID),
                    definition: wkt,
                });
            } else if ('PROJCS' in parsed) {
                // WKT 1 / COMPD_CS
                const projCsInfos = getProjCsInfos(parsed['PROJCS']);
                const parameters: Parameters = {
                    name: projCsInfos.name,
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
                    name: projCsInfos.name,
                    srid: projCsInfos.srid,
                    definition: wkt,
                    horizontal: { unit: projCsInfos.unit },
                });
            } else {
                const name = getNicename(parsed);
                if (
                    'AUTHORITY' in parsed &&
                    typeof parsed.AUTHORITY === 'object' &&
                    parsed.AUTHORITY
                ) {
                    return new CoordinateSystem({ name, srid: parseSRID(parsed.AUTHORITY) });
                }

                if ('title' in parsed && typeof parsed.title === 'string') {
                    return new CoordinateSystem({ name, srid: SRID.parse(parsed.title) });
                }

                return new CoordinateSystem({ name });
            }
        } catch (error: unknown) {
            console.error(`Failed to parse wkt "${wkt}".`);
            throw error;
        }
    }

    public static fromEpsg(code: number): CoordinateSystem {
        const srid = new SRID('EPSG', code);
        return new CoordinateSystem({ name: srid.toString(), srid: srid });
    }

    public static fromSrid(code: string): CoordinateSystem {
        const authority = SRID.parse(code);
        return new CoordinateSystem({ name: authority.toString(), srid: authority });
    }

    public static readonly equirectangular = new CoordinateSystem({ name: 'equirectangular' });

    public static readonly unknown = new CoordinateSystem({ name: 'unknown' });

    public static readonly epsg3857 = CoordinateSystem.fromEpsg(3857);
    public static readonly epsg4326 = CoordinateSystem.fromEpsg(4326);
    public static readonly epsg4978 = CoordinateSystem.fromEpsg(4978);
    public static readonly epsg4979 = CoordinateSystem.fromEpsg(4979);

    public readonly name: string;
    public readonly srid?: SRID;
    public readonly horizontal?: { readonly unit: LinearUnit };
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
        if (typeof params.srid !== 'undefined') {
            this.srid = params.srid;
        }
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

    public get metersPerHorizontalUnit(): number {
        if (this.horizontal) {
            return this.horizontal.unit.metersPerUnit;
        }
        return 1;
    }

    public get metersPerVerticalUnit(): number {
        if (this.vertical) {
            return this.vertical.unit.metersPerUnit;
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
