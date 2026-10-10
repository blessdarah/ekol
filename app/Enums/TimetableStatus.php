<?php

namespace App\Enums;

enum TimetableStatus: string
{
    case Draft = 'draft';
    case Live = 'live';
    case Archived = 'archived';
}
