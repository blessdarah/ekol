<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A parent or guardian of one student. Exactly one per student is the
 * main contact, mirrored onto the student's guardian name and phone.
 *
 * @property string $id
 * @property string $student_id
 * @property string $relation
 * @property string $name
 * @property string|null $phone
 * @property string|null $occupation
 * @property bool $is_main
 */
class StudentGuardian extends Model
{
    use HasUuids;

    public const array RELATIONS = ['father', 'mother', 'guardian'];

    protected $fillable = [
        'student_id',
        'relation',
        'name',
        'phone',
        'occupation',
        'is_main',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_main' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<Student, $this>
     */
    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }
}
