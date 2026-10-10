<?php

namespace App\Enums;

enum EmploymentType: string
{
    case SchoolPaid = 'school_paid';
    case Government = 'government';

    public function label(): string
    {
        return match ($this) {
            self::SchoolPaid => 'School-paid',
            self::Government => 'Government employee',
        };
    }
}
