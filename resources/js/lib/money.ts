/** Parse decimal inputs and server values into exact hundredths. */
export function moneyUnits(value: string | number): bigint | null {
    const match = /^([+-]?)(\d*)(?:\.(\d{0,2}))?$/.exec(String(value).trim());

    if (!match || (!match[2] && !match[3])) {
        return null;
    }

    const units =
        BigInt(match[2] || '0') * 100n +
        BigInt((match[3] ?? '').padEnd(2, '0'));

    return match[1] === '-' ? -units : units;
}

export function moneyDecimal(units: bigint): string {
    const absolute = units < 0n ? -units : units;

    return `${units < 0n ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}

/** Presentation only; keep calculations in integer hundredths. */
export function moneyNumber(units: bigint): number {
    return Number(moneyDecimal(units));
}

export function moneySum(amounts: (string | number)[]): bigint {
    return amounts.reduce(
        (sum, amount) => sum + (moneyUnits(amount) ?? 0n),
        0n,
    );
}

/** Percentage exemptions retain whole-currency-unit rounding. */
export function percentageDiscount(gross: bigint, basisPoints: bigint): bigint {
    if (basisPoints === 10000n) {
        return gross;
    }

    const rounded = ((gross * basisPoints + 500000n) / 1000000n) * 100n;

    return rounded < gross ? rounded : gross;
}
