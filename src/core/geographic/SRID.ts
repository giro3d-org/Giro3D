/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

/**
 * Represents a spatial reference identifier (SRID).
 */
export default class SRID {
    private readonly _authority: string;
    private readonly _code: number;

    public constructor(authority: string, code: number) {
        this._authority = authority;
        this._code = code;
    }

    /**
     * Parses an SRID in the form 'auth:code' (e.g EPSG:1234)
     * @param text - The text to parse.
     * @returns The parsed SRID, or throw an error if the SRID could not be parsed.
     */
    public static parse(text: string): SRID {
        const split = text.trim().split(':');
        if (split.length === 2) {
            const code = Number.parseInt(split[1]);
            return new SRID(split[0], code);
        }

        throw new Error('could not parse SRID');
    }

    public get authority(): string {
        return this._authority;
    }

    public get code(): number {
        return this._code;
    }

    public toString(): string {
        return `${this._authority}:${this._code}`;
    }

    public isEpsg(code: number): boolean {
        return this._authority === 'EPSG' && this._code === code;
    }

    public tryGetEpsgCode(): number | null {
        if (this._authority !== 'EPSG') {
            return null;
        }

        return this._code;
    }
}
