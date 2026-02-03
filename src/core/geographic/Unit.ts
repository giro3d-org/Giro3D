/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

export type UnitType = 'linear' | 'angular';

export interface Unit {
    type: UnitType;
    name: string;
    getSymbol(): string;
}

function getUnitSymbol(unit: Unit): string {
    switch (unit.name.toLowerCase()) {
        case 'deg':
        case 'degree':
        case 'degrees':
            return '°';
        case 'rad':
        case 'radian':
        case 'radians':
            return 'rad';
        case 'm':
        case 'meter':
        case 'metre':
        case 'meters':
        case 'metres':
            return 'm';
        case 'ft':
        case 'foot':
        case 'feet':
        case 'us-ft':
        case 'us survey feet':
        case 'us survey foot':
            return 'ft';
        default:
            return '';
    }
}

/**
 * Measure unit for linear distances.
 */
export class LinearUnit implements Unit {
    public readonly type: UnitType = 'linear' as const;

    public constructor(
        public readonly name: string,
        public readonly metersPerUnit: number,
    ) {}

    public getSymbol(): string {
        return getUnitSymbol(this);
    }

    public static readonly meters = new LinearUnit('meters', 1);
    public static readonly feet = new LinearUnit('feet', 0.3048);
    public static readonly usSurveyFeet = new LinearUnit('US Survey feet', 0.304800609601219);

    public equals(other: LinearUnit): boolean {
        return other.metersPerUnit === this.metersPerUnit;
    }

    public static isLinearUnit(unit: Unit | undefined): unit is LinearUnit {
        if (!unit) {
            return false;
        }
        return unit.type === 'linear';
    }
}

/**
 * Measure unit for angles.
 */
export class AngularUnit implements Unit {
    public readonly type: UnitType = 'angular' as const;

    public constructor(
        public readonly name: string,
        public readonly degreesPerUnit: number,
    ) {}

    public getSymbol(): string {
        return getUnitSymbol(this);
    }

    public static readonly degrees = new AngularUnit('degrees', 1);
    public static readonly radians = new AngularUnit('radians', 57.29578);

    public equals(other: AngularUnit): boolean {
        return other.degreesPerUnit === this.degreesPerUnit;
    }

    public static isAngularUnit(unit: Unit | undefined): unit is AngularUnit {
        if (!unit) {
            return false;
        }
        return unit.type === 'angular';
    }
}

export function parseUnit(text: string): Unit | undefined {
    switch (text.trim().toLowerCase()) {
        case 'deg':
        case 'degree':
        case 'degrees':
            return AngularUnit.degrees;

        case 'rad':
        case 'radian':
        case 'radians':
            return AngularUnit.radians;

        case 'm':
        case 'meter':
        case 'meters':
        case 'metre':
        case 'metres':
            return LinearUnit.meters;

        case 'ft':
        case 'feet':
        case 'foot':
            return LinearUnit.feet;

        case 'us-ft':
        case 'us survey feet':
        case 'us survey foot':
        case 'foot (us survey)':
            return LinearUnit.usSurveyFeet;

        default:
            return undefined;
    }
}
