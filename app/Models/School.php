<?php

namespace App\Models;

use App\Enums\SchoolCycle;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property string $id
 * @property string $name
 * @property string $code
 * @property string $slug
 * @property string $ownership
 * @property string|null $region
 * @property string|null $town
 * @property SchoolCycle|null $cycle
 * @property string|null $subsystem
 * @property string $currency
 * @property string $timezone
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
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'cycle' => SchoolCycle::class,
        ];
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
