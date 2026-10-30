<?php

namespace App\Models;

use Brick\Math\BigDecimal;
use Brick\Math\BigInteger;
use Brick\Math\RoundingMode;
use InvalidArgumentException;

final class Money
{
    /** Hundredths of the stored decimal amount, independent of currency. */
    public static function units(string $decimal): int
    {
        return BigDecimal::of($decimal)->toScale(2)->getUnscaledValue()->toInt();
    }

    public static function decimal(int $units): string
    {
        return (string) BigDecimal::ofUnscaledValue($units, 2);
    }

    /** Presentation only. Never use the result for accounting arithmetic. */
    public static function number(int $units): float
    {
        return (float) self::decimal($units);
    }

    /**
     * Database aggregates may be numeric strings or SQLite numbers.
     *
     * @param  iterable<string|int|float|null>  $amounts
     */
    public static function sum(iterable $amounts): int
    {
        $total = 0;

        foreach ($amounts as $amount) {
            $total += self::units((string) ($amount ?? 0));
        }

        return $total;
    }

    public static function ratio(int $amount, int $numerator, int $denominator): int
    {
        return BigInteger::of($amount)->multipliedBy($numerator)->dividedBy($denominator, RoundingMode::HalfUp)->toInt();
    }

    /**
     * Rounded cumulative boundaries keep every part nonnegative and preserve the total.
     *
     * @param  list<int>  $weights
     * @return list<int>
     */
    public static function allocate(int $total, array $weights): array
    {
        if ($total < 0 || array_any($weights, fn (int $weight) => $weight < 0)) {
            throw new InvalidArgumentException('Money allocations cannot be negative.');
        }

        $whole = array_sum($weights);
        $boundary = 0;
        $weight = 0;
        $parts = [];

        foreach ($weights as $share) {
            $weight += $share;
            $next = $whole > 0 ? self::ratio($total, $weight, $whole) : 0;
            $parts[] = $next - $boundary;
            $boundary = $next;
        }

        return $parts;
    }
}
