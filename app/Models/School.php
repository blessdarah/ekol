<?php

namespace App\Models;

use App\Enums\SchoolCycle;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Validation\ValidationException;

/**
 * @property string $id
 * @property string $name
 * @property string $locale
 * @property string $code
 * @property string $slug
 * @property string $ownership
 * @property string|null $region
 * @property string|null $town
 * @property SchoolCycle|null $cycle
 * @property string|null $subsystem
 * @property string $currency
 * @property string $timezone
 * @property string|null $logo_path
 * @property int $school_days
 * @property string $day_starts_at
 * @property int $period_minutes
 * @property string $pass_mark
 */
class School extends Model
{
    use HasUuids, SoftDeletes;

    /**
     * Subdomains that must never become a school slug (infra + app routes).
     *
     * @var list<string>
     */
    public const array RESERVED_SLUGS = [
        'admin', 'api', 'app', 'assets', 'beta', 'blog', 'cdn', 'demo',
        'docs', 'ftp', 'help', 'mail', 'root', 'smtp', 'staging',
        'static', 'status', 'support', 'test', 'www',
    ];

    /**
     * Ownership options shown as segmented selectors on screen 10.
     *
     * @var list<string>
     */
    public const array OWNERSHIP_OPTIONS = ['government', 'mission', 'private'];

    /**
     * Subsystem options shown as segmented selectors on screen 10.
     *
     * @var list<string>
     */
    public const array SUBSYSTEM_OPTIONS = ['anglophone', 'francophone', 'bilingual'];

    /**
     * Region options for the screen 10 Region select.
     *
     * @var list<string>
     */
    public const array REGIONS = [
        'Adamawa', 'Centre', 'East', 'Far North', 'Littoral',
        'North', 'North West', 'South', 'South West', 'West',
    ];

    /**
     * The languages the app can be read in, by locale code.
     */
    public const array LOCALES = ['en' => 'English', 'fr' => 'Français'];

    protected $fillable = [
        'name',
        'code',
        'slug',
        'ownership',
        'region',
        'town',
        'cycle',
        'subsystem',
        'currency',
        'timezone',
        'logo_path',
        'school_days',
        'day_starts_at',
        'period_minutes',
        'pass_mark',
        'locale',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'cycle' => SchoolCycle::class,
            'period_minutes' => 'integer',
        ];
    }

    /**
     * The workspace slug feeds subdomain resolution and must never
     * change after creation — not even via crafted requests.
     */
    protected static function booted(): void
    {
        static::saving(function (School $school) {
            if ($school->exists && $school->isDirty('slug')) {
                throw ValidationException::withMessages([
                    'slug' => __('The workspace address cannot be changed.'),
                ]);
            }
        });
    }

    /**
     * @return HasMany<User, $this>
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /**
     * @return HasMany<AcademicYear, $this>
     */
    public function academicYears(): HasMany
    {
        return $this->hasMany(AcademicYear::class);
    }

    /**
     * @return HasMany<Term, $this>
     */
    public function terms(): HasMany
    {
        return $this->hasMany(Term::class);
    }

    /**
     * @return HasMany<Student, $this>
     */
    public function students(): HasMany
    {
        return $this->hasMany(Student::class);
    }
}
