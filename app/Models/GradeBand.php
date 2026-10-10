<?php

namespace App\Models;

use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * Grading policy row scoped per school (tenant-scoped divergence from ERD global).
 *
 * @property string $id
 * @property string $school_id
 * @property string $letter
 * @property string $from_percent
 * @property string $to_percent
 * @property string $meaning
 * @property string $standard_remark
 * @property int $rank_order
 */
class GradeBand extends Model
{
    use BelongsToSchool, HasUuids;

    protected $fillable = [
        'school_id',
        'letter',
        'from_percent',
        'to_percent',
        'meaning',
        'standard_remark',
        'rank_order',
    ];

    /**
     * The scale a school starts with, out of 20.
     *
     * @var list<array{letter: string, from: float, to: float, meaning: string, remark: string}>
     */
    public const array STANDARD = [
        ['letter' => 'A', 'from' => 16.0, 'to' => 20.0, 'meaning' => 'Excellent', 'remark' => 'Excellent work. Keep it up.'],
        ['letter' => 'B', 'from' => 14.0, 'to' => 15.99, 'meaning' => 'Very good', 'remark' => 'Very good. Aim higher.'],
        ['letter' => 'C', 'from' => 12.0, 'to' => 13.99, 'meaning' => 'Good', 'remark' => 'Good effort. Keep improving.'],
        ['letter' => 'D', 'from' => 10.0, 'to' => 11.99, 'meaning' => 'Fair', 'remark' => 'Fair. More effort is needed.'],
        ['letter' => 'E', 'from' => 8.0, 'to' => 9.99, 'meaning' => 'Weak', 'remark' => 'Weak. Needs close follow-up.'],
        ['letter' => 'F', 'from' => 0.0, 'to' => 7.99, 'meaning' => 'Very weak', 'remark' => 'Very weak. Please meet the form master.'],
    ];

    /**
     * A school's scale out of 20, best band first: its own bands, or
     * the standard scale until it saves one.
     *
     * @return list<array{id: string|null, letter: string, from: float, to: float, meaning: string, remark: string}>
     */
    public static function scale(string $schoolId): array
    {
        $bands = static::where('school_id', $schoolId)->orderBy('rank_order')->get();

        if ($bands->isEmpty()) {
            return array_map(fn (array $band) => ['id' => null, ...$band], static::STANDARD);
        }

        return array_values($bands->map(fn (self $band) => [
            'id' => $band->id,
            'letter' => trim($band->letter),
            'from' => round((float) $band->from_percent / 5, 2),
            'to' => round((float) $band->to_percent / 5, 2),
            'meaning' => $band->meaning,
            'remark' => $band->standard_remark,
        ])->all());
    }

    /**
     * The band a score out of 20 falls in.
     *
     * @return array{id: string|null, letter: string, from: float, to: float, meaning: string, remark: string}|null
     */
    public static function forScore(string $schoolId, ?float $score): ?array
    {
        if ($score === null) {
            return null;
        }

        foreach (static::scale($schoolId) as $band) {
            if ($score >= $band['from'] - 0.001) {
                return $band;
            }
        }

        return null;
    }
}
