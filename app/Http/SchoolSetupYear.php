<?php

namespace App\Http;

use App\Models\AcademicYear;
use App\Models\School;
use Illuminate\Http\Request;

class SchoolSetupYear
{
    public static function selected(Request $request, School $school): ?AcademicYear
    {
        $yearId = $request->query('year');

        $query = AcademicYear::where('school_id', $school->id)->orderByDesc('starts_on');

        if ($yearId) {
            return $query->clone()->where('id', $yearId)->firstOrFail();
        }

        return $query->clone()->current()->first()
            ?? $query->first();
    }
}
