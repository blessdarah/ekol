<?php

namespace App\Enums;

enum ApplicationStage: string
{
    case ToReview = 'to_review';
    case Admitted = 'admitted';
    case Waitlist = 'waitlist';
    case Declined = 'declined';
}
