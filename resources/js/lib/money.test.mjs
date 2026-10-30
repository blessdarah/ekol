import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    moneyDecimal,
    moneyNumber,
    moneySum,
    moneyUnits,
    percentageDiscount,
} from './money.ts';

await test('decimal inputs are parsed into exact integer hundredths', () => {
    assert.equal(moneyUnits('30.80'), 3080n);
    assert.equal(moneyUnits('.5'), 50n);
    assert.equal(moneyUnits('99999999.99'), 9999999999n);
    assert.equal(moneyDecimal(-1n), '-0.01');
    assert.equal(moneyDecimal(6000100n), '60001.00');
});

await test('invalid or incomplete inputs do not produce rounded previews', () => {
    for (const input of ['', '.', '-', 'NaN', '1e3', '0.001']) {
        assert.equal(moneyUnits(input), null);
    }
});

await test('payment previews and receipt history settle to an exact zero balance', () => {
    const paid = moneySum([10.1, '20.70']);

    assert.equal(paid, 3080n);
    assert.equal(3080n - paid, 0n);
    assert.equal(moneyNumber(paid), 30.8);
    assert.equal(moneySum(['0.10', '0.20', '0.30']), 60n);
});

await test('projected fees remain exact when multiplication exceeds safe numeric precision', () => {
    const projected = moneySum(['99999999.99', '0.01']) * 1000000n;

    assert.equal(moneyDecimal(projected), '100000000000000.00');
});

await test('percentage previews keep whole-unit rounding and cap full fractional exemptions', () => {
    assert.equal(percentageDiscount(6000000n, 2500n), 1500000n);
    assert.equal(percentageDiscount(350n, 5000n), 200n);
    assert.equal(percentageDiscount(3080n, 10000n), 3080n);
    assert.equal(percentageDiscount(1n, 10000n), 1n);
});
