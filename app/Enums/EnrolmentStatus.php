<?php

namespace App\Enums;

enum EnrolmentStatus: string
{
    case Admitted = 'admitted';
    case Placed = 'placed';
    case Enrolled = 'enrolled';
    case Left = 'left';
}
