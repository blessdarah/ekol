<?php

namespace App\Http;

use App\Models\AcademicYear;
use App\Models\School;
use App\Models\Term;
use Illuminate\Validation\ValidationException;

/**
 * The school a request is for, with its current year and term and the
 * year being prepared next. Each is looked up once per request; the
 * tenant middleware starts a fresh context for every request.
 */
class SchoolContext
{
    protected ?AcademicYear $year = null;

    protected ?Term $term = null;

    protected ?AcademicYear $nextYear = null;

    /**
     * @var array<string, true>
     */
    protected array $looked = [];

    protected ?School $school = null;

    public function bind(School $school): void
    {
        $this->refresh();
        $this->school = $school;
    }

    public function clear(): void
    {
        $this->school = null;
        $this->refresh();
    }

    /**
     * The school, or a 404 outside one.
     */
    public function school(): School
    {
        abort_unless($this->school instanceof School, 404);

        return $this->school;
    }

    /**
     * Whether the request is for a school at all.
     */
    public function hasSchool(): bool
    {
        return $this->school instanceof School;
    }

    /**
     * The academic year the school is running now.
     */
    public function year(): ?AcademicYear
    {
        if (! isset($this->looked['year'])) {
            $this->year = $this->school()->academicYears()->current()->first();
            $this->looked['year'] = true;
        }

        return $this->year;
    }

    /**
     * The term the school is in now.
     */
    public function term(): ?Term
    {
        if (! isset($this->looked['term'])) {
            $this->term = $this->school()->terms()->current()->first();
            $this->looked['term'] = true;
        }

        return $this->term;
    }

    /**
     * The year enrolment is being prepared for: the first planned year
     * after the current one.
     */
    public function nextYear(): ?AcademicYear
    {
        if (! isset($this->looked['nextYear'])) {
            $this->nextYear = $this->school()->academicYears()->planned()->startingAfter($this->year())->first();
            $this->looked['nextYear'] = true;
        }

        return $this->nextYear;
    }

    public function requireNextYear(): AcademicYear
    {
        return $this->nextYear() ?? throw ValidationException::withMessages([
            'year' => __('Enrolment needs a planned academic year. Add next year in School Setup first.'),
        ]);
    }

    /**
     * Look the year and term up again, after a change to which is current.
     */
    public function refresh(): void
    {
        $this->looked = [];
        $this->year = null;
        $this->term = null;
        $this->nextYear = null;
    }
}
