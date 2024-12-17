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
