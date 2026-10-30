<?php

namespace App\Models;

use App\Enums\AcademicYearStatus;
use App\Enums\ApplicationStage;
use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $school_id
 * @property string $label
 * @property Carbon $starts_on
 * @property Carbon $ends_on
 * @property AcademicYearStatus $status
 * @property Carbon $created_at
 * @property Carbon|null $enrolment_confirmed_at
 */
class AcademicYear extends Model
{
    use BelongsToSchool, HasUuids;

    public $timestamps = false;

    protected $table = 'academic_years';

    protected $fillable = [
        'school_id',
        'label',
        'starts_on',
        'ends_on',
        'status',
        'created_at',
        'enrolment_confirmed_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'starts_on' => 'date',
            'ends_on' => 'date',
            'status' => AcademicYearStatus::class,
            'created_at' => 'datetime',
            'enrolment_confirmed_at' => 'datetime',
        ];
    }

    /**
     * @return HasMany<Term, $this>
     */
    public function terms(): HasMany
    {
        return $this->hasMany(Term::class);
    }

    /**
     * The year the school is running now.
     *
     * @param  Builder<static>  $query
     */
    public function scopeCurrent(Builder $query): void
    {
        $query->where('status', AcademicYearStatus::Current);
    }

    /**
     * Years set up ahead, not started yet.
     *
     * @param  Builder<static>  $query
     */
    public function scopePlanned(Builder $query): void
    {
        $query->where('status', AcademicYearStatus::Planned);
    }

    /**
     * Years starting after another one, earliest first. With no year
     * given, every year qualifies.
     *
     * @param  Builder<static>  $query
     */
    public function scopeStartingAfter(Builder $query, ?AcademicYear $year): void
    {
        $query->when($year, fn (Builder $query) => $query->whereDate('starts_on', '>', $year?->starts_on))
            ->orderBy('starts_on');
    }

    /**
     * @return HasMany<FeePlan, $this>
     */
    public function feePlans(): HasMany
    {
        return $this->hasMany(FeePlan::class);
    }

    /**
     * @return HasMany<SchoolClass, $this>
     */
    public function schoolClasses(): HasMany
    {
        return $this->hasMany(SchoolClass::class);
    }

    /**
     * @return HasMany<Enrolment, $this>
     */
    public function enrolments(): HasMany
    {
        return $this->hasMany(Enrolment::class);
    }

    /**
     * Where enrolment stands, shared by every enrolment page for its
     * tabs and for the checks before confirming.
     *
     * @return array{year: string, confirmed: bool, ready: bool, to_review: int, undecided: int, unplaced: int, expected: int, classes: int, over_levels: list<string>, over_classes: int, has_fee_plan: bool}
     */
    public function enrolmentProgress(School $school, ?AcademicYear $current): array
    {
        $successors = $school->successorLevels();
        $undecided = Enrolment::continuingFor($school, $current)
            ->filter(fn (Enrolment $enrolment) => $enrolment->decision === null
                && isset($successors[(string) $enrolment->schoolClass?->level_id]))
            ->count();
        $toReview = Application::where('academic_year_id', $this->id)
            ->where('stage', ApplicationStage::ToReview)
            ->count();
        $levels = $this->enrolmentCapacity($school);
        $expected = (int) array_sum(array_column($levels, 'expected'));
        $unplaced = $expected - (int) array_sum(array_column($levels, 'placed'));
        $overClasses = SchoolClass::where('academic_year_id', $this->id)
            ->withCount('enrolments')
            ->get()
            ->filter(fn (SchoolClass $class) => (int) $class->getAttribute('enrolments_count') > $class->capacity)
            ->count();

        return [
            'year' => $this->label,
            'confirmed' => $this->enrolment_confirmed_at !== null,
            'ready' => $toReview === 0 && $undecided === 0 && $unplaced === 0 && $expected > 0 && $overClasses === 0,
            'to_review' => $toReview,
            'undecided' => $undecided,
            'unplaced' => $unplaced,
            'expected' => $expected,
            'classes' => (int) array_sum(array_column($levels, 'classes')),
            'over_levels' => array_column(
                array_filter($levels, fn (array $level) => $level['expected'] > $level['seats']),
                'name',
            ),
            'over_classes' => $overClasses,
            'has_fee_plan' => FeePlan::where('school_id', $school->id)->where('academic_year_id', $this->id)->exists(),
        ];
    }

    /**
     * Each level's seats in the coming year against the students headed
     * for it: promoted, repeating and admitted.
     *
     * @return list<array{id: string, name: string, classes: int, seats: int, expected: int, placed: int}>
     */
    public function enrolmentCapacity(School $school): array
    {
        $classes = SchoolClass::where('academic_year_id', $this->id)->get(['id', 'level_id', 'capacity'])->groupBy('level_id');
        $enrolments = Enrolment::where('academic_year_id', $this->id)->get(['id', 'level_id', 'school_class_id'])->groupBy('level_id');

        return array_values(Level::where('school_id', $school->id)
            ->orderBy('ordinal')
            ->get()
            ->map(fn (Level $level) => [
                'id' => $level->id,
                'name' => $level->name,
                'classes' => $classes->get($level->id)?->count() ?? 0,
                'seats' => (int) ($classes->get($level->id)?->sum('capacity') ?? 0),
                'expected' => $enrolments->get($level->id)?->count() ?? 0,
                'placed' => $enrolments->get($level->id)?->whereNotNull('school_class_id')->count() ?? 0,
            ])
            ->all());
    }
}
