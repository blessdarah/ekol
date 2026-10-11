<?php

namespace App\Http\Requests;

use App\Models\School;
use Illuminate\Foundation\Http\FormRequest;

/**
 * A request made inside a school's workspace. Its rules can scope
 * themselves to the school the subdomain resolved to.
 */
abstract class SchoolRequest extends FormRequest
{
    public function school(): School
    {
        $school = app()->bound('currentSchool') ? app('currentSchool') : null;

        if (! $school instanceof School) {
            abort(404);
        }

        return $school;
    }
}
