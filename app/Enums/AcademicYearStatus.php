<?php

namespace App\Enums;

enum AcademicYearStatus: string
{
    case Planned = 'planned';
    case Current = 'current';
    case Closed = 'closed';
}
