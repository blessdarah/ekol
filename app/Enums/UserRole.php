<?php

namespace App\Enums;

enum UserRole: string
{
    case Principal = 'principal';
    case AcademicLead = 'academic_lead';
    case Teacher = 'teacher';
    case FormMaster = 'form_master';
    case Admin = 'admin';
    case Accountant = 'accountant';
    case HeadOfDepartment = 'head_of_department';
    case Registrar = 'registrar';
    case Bursar = 'bursar';

    /**
     * Roles the school can hand out when it opens a portal account.
     *
     * @return array<int, self>
     */
    public static function assignable(): array
    {
        return [
            self::Teacher,
            self::HeadOfDepartment,
            self::Registrar,
            self::Bursar,
            self::Admin,
        ];
    }

    public function label(): string
    {
        return match ($this) {
            self::Principal => 'Principal',
            self::AcademicLead => 'Academic lead',
            self::Teacher => 'Teacher',
            self::FormMaster => 'Form master',
            self::Admin => 'Administrator',
            self::Accountant => 'Accountant',
            self::HeadOfDepartment => 'Head of department',
            self::Registrar => 'Registrar',
            self::Bursar => 'Bursar',
        };
    }

    /**
     * What the role opens in the portal, in the school's words.
     */
    public function portalSummary(): string
    {
        return match ($this) {
            self::Teacher, self::FormMaster => 'A teacher sees her classes, registers and marks. Fees, salaries and other staff records stay closed.',
            self::HeadOfDepartment, self::AcademicLead => 'A head of department sees the classes and marks of her whole department, and her own.',
            self::Registrar => 'A registrar sees students, enrolment and class lists. Fees and marks entry stay closed.',
            self::Bursar, self::Accountant => 'A bursar sees fees, invoices and payments. Marks and staff records stay closed.',
            self::Admin, self::Principal => 'An administrator sees everything, including school setup and staff records.',
        };
    }

    /**
     * Whether the role may change levels, classes and series.
     */
    public function managesStructure(): bool
    {
        return $this->managesStaff();
    }

    /**
     * Whether the role may register students and edit their records.
     */
    public function managesStudents(): bool
    {
        return in_array($this, [self::Admin, self::Principal, self::Registrar], true);
    }

    /**
     * Religion and disability are for the principal and administrator only.
     */
    public function seesPrivateStudentDetails(): bool
    {
        return in_array($this, [self::Admin, self::Principal], true);
    }

    /**
     * Whether the role may set fees and record payments.
     */
    public function managesFees(): bool
    {
        return in_array($this, [self::Admin, self::Principal, self::Bursar, self::Accountant], true);
    }

    /**
     * Whether the role may register and manage other staff.
     */
    public function managesStaff(): bool
    {
        return in_array($this, [self::Admin, self::Principal], true);
    }
}
