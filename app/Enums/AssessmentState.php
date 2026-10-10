<?php

namespace App\Enums;

enum AssessmentState: string
{
    case Draft = 'draft';
    case Scheduled = 'scheduled';
    case MarksOpen = 'marks_open';
    case MarksClosed = 'marks_closed';
    case Published = 'published';
}
