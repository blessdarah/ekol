<?php

namespace App\Enums;

enum CoefficientStatus: string
{
    case Draft = 'draft';
    case Pending = 'pending';
    case Complete = 'complete';
}
