<?php

namespace App\Models;

use App\Enums\ApplicationStage;
use App\Enums\Gender;
use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A request to join the school in a coming year. It stays an
 * application until someone admits it, which creates the student.
 *
 * @property string $id
 * @property string $school_id
 * @property string $academic_year_id
 * @property string $level_id
 * @property string $reference
 * @property string $surname
 * @property string $given_names
 * @property string $full_name
 * @property Carbon $date_of_birth
 * @property Gender $gender
 * @property string|null $place_of_birth
 * @property string|null $religion
 * @property string|null $disability
 * @property bool $transferred
 * @property string|null $previous_school
 * @property string|null $previous_class
 * @property string|null $reason
 * @property list<array{relation: string, name: string, phone: string|null, occupation: string|null, is_main: bool}> $guardians
 * @property list<string> $documents
 * @property ApplicationStage $stage
 * @property string|null $condition
 * @property string|null $student_id
 * @property string|null $decided_by
 * @property Carbon|null $decided_at
 * @property Carbon $created_at
 */
class Application extends Model
{
    use BelongsToSchool, HasUuids;

    /**
     * Papers the school asks for, by key. The transfer certificate is
     * only asked of students coming from another school.
     */
    public const array DOCUMENTS = [
        'birth_certificate' => 'Birth certificate',
        'transfer_certificate' => 'Transfer certificate',
        'last_report' => 'Last report card',
        'passport_photo' => 'Passport photo',
    ];

    protected $fillable = [
        'school_id',
        'academic_year_id',
        'level_id',
        'reference',
        'surname',
        'given_names',
        'full_name',
        'date_of_birth',
        'gender',
        'place_of_birth',
        'religion',
        'disability',
        'transferred',
        'previous_school',
        'previous_class',
        'reason',
        'guardians',
        'documents',
        'stage',
        'condition',
        'student_id',
        'decided_by',
        'decided_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
            'gender' => Gender::class,
            'transferred' => 'boolean',
            'guardians' => 'array',
            'documents' => 'array',
            'stage' => ApplicationStage::class,
            'decided_at' => 'datetime',
        ];
    }

    /**
     * The next reference for a school and year, like APP-26-0031.
     */
    public static function nextReference(School $school, AcademicYear $year): string
    {
        $prefix = 'APP-'.$year->starts_on->format('y').'-';

        $last = static::where('school_id', $school->id)
            ->where('reference', 'like', $prefix.'%')
            ->pluck('reference')
            ->map(fn (string $reference) => (int) substr($reference, strlen($prefix)))
            ->max();

        return $prefix.str_pad((string) (((int) $last) + 1), 4, '0', STR_PAD_LEFT);
    }

    /**
     * The papers this applicant has to bring, by key.
     *
     * @return array<string, string>
     */
    public function requiredDocuments(): array
    {
        return array_filter(
            static::DOCUMENTS,
            fn (string $key) => $this->transferred || $key !== 'transfer_certificate',
            ARRAY_FILTER_USE_KEY,
        );
    }

    /**
     * @return list<string>
     */
    public function missingDocuments(): array
    {
        return array_values(array_diff(array_keys($this->requiredDocuments()), $this->documents));
    }

    /**
     * @return BelongsTo<AcademicYear, $this>
     */
    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }

    /**
     * @return BelongsTo<Level, $this>
     */
    public function level(): BelongsTo
    {
        return $this->belongsTo(Level::class);
    }

    /**
     * @return BelongsTo<Student, $this>
     */
    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }
}
