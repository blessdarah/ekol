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
}
