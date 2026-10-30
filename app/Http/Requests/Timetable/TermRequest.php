<?php

namespace App\Http\Requests\Timetable;

use App\Http\Controllers\StudentController;
use App\Http\Requests\SchoolRequest;

/**
 * A timetable request that carries a date, which has to fall inside
 * the term the timetable is built for.
 */
abstract class TermRequest extends SchoolRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->can('manage-structure');
    }

    /**
     * Date rules that keep a day inside the current term. Empty when
     * no term is active; the controller refuses the request then.
     *
     * @return list<string>
     */
    protected function insideTerm(): array
    {
        $term = StudentController::currentTerm($this->school());

        return $term
            ? ['after_or_equal:'.$term->starts_on->toDateString(), 'before_or_equal:'.$term->ends_on->toDateString()]
            : [];
    }
}
