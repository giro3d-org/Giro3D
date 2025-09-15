/**
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2025, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

export function formatPointCount(count, numberFormat = undefined) {
    let displayedPointCount = count;
    let suffix = '';

    if (count > 1_000_000) {
        displayedPointCount /= 1_000_000;
        suffix = 'M';
    } else if (count > 1_000_000_000) {
        displayedPointCount /= 1_000_000_000;
        suffix = 'B';
    }

    if (numberFormat == null) {
        numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
    }

    return numberFormat.format(displayedPointCount) + suffix;
}
