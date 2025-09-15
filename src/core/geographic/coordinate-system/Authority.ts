/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

export default class Authority {
    private readonly _name: string | null = null;
    private readonly _code: string | null = null;

    public constructor(public readonly asString: string) {
        const [name, code] = asString.split(':');

        if (typeof name === 'string' && typeof code === 'string') {
            this._name = name;
            this._code = code;
        }
    }

    public isEpsg(code?: number): boolean {
        const actualCode = this.tryGetEpsgCode();
        if (actualCode === null) {
            return false;
        }

        if (typeof code === 'undefined') {
            return true;
        }

        return actualCode === code;
    }

    public tryGetEpsgCode(): number | null {
        if (this._name !== 'EPSG' || this._code === null) {
            return null;
        }
        const codeNumber = Number(this._code);
        if (!Number.isInteger(codeNumber)) {
            return null;
        }
        return codeNumber;
    }
}
