<?php

namespace App\Http\Requests;

use App\Http\SchoolContext;
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
        return $this->schoolContext()->school();
    }

    protected function schoolContext(): SchoolContext
    {
        return $this->container->make(SchoolContext::class);
    }
}
