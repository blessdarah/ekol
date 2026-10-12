<?php

namespace App\Enums;

enum EmploymentType: string
{
    case SchoolPaid = 'school_paid';
    case Government = 'government';

    public function label(): string
    {
        return match ($this) {
            self::SchoolPaid => __('School-paid'),
            self::Government => __('Government employee'),
        };
    }
}
