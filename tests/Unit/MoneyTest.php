<?php

use App\Models\Money;
use Brick\Math\Exception\RoundingNecessaryException;

test('decimal values are parsed and formatted without floating point arithmetic', function (string $decimal, int $units, string $formatted) {
    expect(Money::units($decimal))->toBe($units)
        ->and(Money::decimal($units))->toBe($formatted);
})->with([
    ['0.10', 10, '0.10'],
    ['30.80', 3080, '30.80'],
    ['60001', 6000100, '60001.00'],
    ['99999999.99', 9999999999, '99999999.99'],
    ['-0.01', -1, '-0.01'],
]);

test('amounts with unsupported precision cannot silently lose money', function () {
    expect(fn () => Money::units('0.001'))->toThrow(RoundingNecessaryException::class);
});

test('decimal sums and proportional allocations preserve the exact total', function () {
    expect(Money::sum(['10.10', '20.70']))->toBe(3080)
        ->and(Money::allocate(6000100, [5000, 3000, 2000]))->toBe([3000050, 1800030, 1200020])
        ->and(Money::allocate(2, [1, 1, 1, 1]))->toBe([1, 0, 1, 0]);
});

test('proportions do not overflow when both inputs approach the storage limit', function () {
    expect(Money::ratio(9999999999, 9999999998, 9999999999))->toBe(9999999998)
        ->and(Money::allocate(9999999999, [4999999999, 5000000000]))->toBe([4999999999, 5000000000]);
});
