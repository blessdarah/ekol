<?php

namespace App\Enums;

enum EnrolmentDecision: string
{
    case Promote = 'promote';
    case Repeat = 'repeat';
    case Leaving = 'leaving';
}
