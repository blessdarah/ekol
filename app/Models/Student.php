<?php

namespace App\Models;

use App\Enums\EnrolmentStatus;
use App\Enums\Gender;
use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Read-only record in this system: no login, no credentials.
 * One row covers the student's whole life; the class for a given
 * year lives on enrolments.
 *
 * @property string $id
 * @property string $school_id
 * @property string $admission_no
 * @property string $full_name
 * @property Gender $gender
 * @property Carbon $date_of_birth
 * @property string $guardian_name
 * @property string $guardian_phone
 * @property Carbon $admitted_on
 * @property string|null $surname
 * @property string|null $given_names
 * @property string|null $place_of_birth
 * @property string|null $religion
 * @property bool $has_disability
 * @property array<int, string>|null $disability_types
 * @property string|null $disability_support
 * @property bool $transferred
 * @property string|null $previous_school
 * @property string|null $previous_class
 * @property int|null $previous_year_left
 * @property bool $transfer_certificate_received
 * @property bool $last_report_received
 * @property bool $on_whatsapp
 * @property string|null $lives_with
 * @property string|null $family_id
 */
class Student extends Model
{
    use BelongsToSchool, HasUuids, SoftDeletes;

    protected $fillable = [
        'school_id',
        'admission_no',
        'full_name',
        'gender',
        'date_of_birth',
        'guardian_name',
        'guardian_phone',
        'admitted_on',
        'surname',
        'given_names',
        'place_of_birth',
        'religion',
        'has_disability',
        'disability_types',
        'disability_support',
        'transferred',
        'previous_school',
        'previous_class',
        'previous_year_left',
        'transfer_certificate_received',
        'last_report_received',
        'on_whatsapp',
        'lives_with',
        'family_id',
    ];

    public const array RELIGIONS = [
        'Catholic', 'Presbyterian', 'Baptist', 'Pentecostal', 'Other Christian',
        'Muslim', 'Traditional', 'None', 'Prefer not to say',
    ];

    public const array DISABILITY_TYPES = ['Visual', 'Hearing', 'Physical', 'Speech', 'Learning', 'Other'];

    public const array LIVES_WITH = ['Both parents', 'Father', 'Mother', 'Guardian', 'Boarding'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'gender' => Gender::class,
            'date_of_birth' => 'date',
            'admitted_on' => 'date',
            'has_disability' => 'boolean',
            'disability_types' => 'array',
            'transferred' => 'boolean',
            'transfer_certificate_received' => 'boolean',
            'last_report_received' => 'boolean',
            'on_whatsapp' => 'boolean',
        ];
    }

    /**
     * The next matricule for a school: its code, the two-digit admission
     * year and a running number, like GBHS-25-0412. Never reused, so
     * withdrawn students still count.
     */
    public static function nextMatricule(School $school, \DateTimeInterface $admittedOn): string
    {
        $prefix = mb_strtoupper($school->code).'-'.$admittedOn->format('y').'-';

        $last = static::withTrashed()
            ->where('school_id', $school->id)
            ->where('admission_no', 'like', $prefix.'%')
            ->pluck('admission_no')
            ->map(fn (string $number) => (int) substr($number, strlen($prefix)))
            ->max();

        return $prefix.str_pad((string) (((int) $last) + 1), 4, '0', STR_PAD_LEFT);
    }

    /**
     * Admit a student: matricule, parents, a place in a class, an
     * optional series, and the year's fee plan when the level has one.
     *
     * @param  array<string, mixed>  $profile
     * @param  list<array{relation: string, name: string, phone: string|null, occupation: string|null, is_main: bool}>  $guardians
     */
    public static function admit(
        School $school,
        AcademicYear $year,
        ?Term $term,
        SchoolClass $class,
        array $profile,
        array $guardians,
        ?Series $series = null,
    ): self {
        return DB::transaction(function () use ($school, $year, $term, $class, $profile, $guardians, $series) {
            $student = new self([
                ...$profile,
                'school_id' => $school->id,
                'admission_no' => static::nextMatricule($school, today()),
                'admitted_on' => today(),
            ]);
            $student->applyMainContact($guardians)->save();
            $student->guardians()->createMany($guardians);

            Enrolment::create([
                'student_id' => $student->id,
                'academic_year_id' => $year->id,
                'school_class_id' => $class->id,
                'status' => EnrolmentStatus::Enrolled,
            ]);

            if ($series && $term) {
                StudentSeries::create([
                    'student_id' => $student->id,
                    'series_id' => $series->id,
                    'term_id' => $term->id,
                ]);
            }

            $plan = FeePlan::where('school_id', $school->id)
                ->where('level_id', $class->level_id)
                ->where('academic_year_id', $year->id)
                ->first();

            if ($plan && $term) {
                Invoice::issue($student, $term, $plan, (string) $plan->annual_amount);
            }

            return $student;
        });
    }

    /**
     * Replace the parents and guardian, keeping the main contact mirrored.
     *
     * @param  list<array{relation: string, name: string, phone: string|null, occupation: string|null, is_main: bool}>  $guardians
     */
    public function replaceGuardians(array $guardians): void
    {
        $this->guardians()->delete();
        $this->guardians()->createMany($guardians);
        $this->applyMainContact($guardians)->save();
    }

    /**
     * @param  list<array{relation: string, name: string, phone: string|null, occupation: string|null, is_main: bool}>  $guardians
     */
    protected function applyMainContact(array $guardians): static
    {
        $main = collect($guardians)->firstWhere('is_main', true) ?? $guardians[0];

        return $this->fill([
            'guardian_name' => $main['name'],
            'guardian_phone' => (string) $main['phone'],
        ]);
    }

    /**
     * @return HasMany<StudentGuardian, $this>
     */
    public function guardians(): HasMany
    {
        return $this->hasMany(StudentGuardian::class);
    }

    /**
     * @return HasMany<Enrolment, $this>
     */
    public function enrolments(): HasMany
    {
        return $this->hasMany(Enrolment::class);
    }

    /**
     * @return HasMany<StudentSeries, $this>
     */
    public function studentSeries(): HasMany
    {
        return $this->hasMany(StudentSeries::class);
    }

    /**
     * @return HasMany<Mark, $this>
     */
    public function marks(): HasMany
    {
        return $this->hasMany(Mark::class);
    }

    /**
     * @return HasMany<Invoice, $this>
     */
    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    /**
     * @return HasMany<Report, $this>
     */
    public function reports(): HasMany
    {
        return $this->hasMany(Report::class);
    }
}
