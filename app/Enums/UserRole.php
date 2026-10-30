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
     * The abilities a role can hold, each a gate of the same name.
     */
    public const array ABILITIES = [
        'manage-structure',
        'manage-students',
        'see-private-student-details',
        'manage-assessments',
        'manage-schemes',
        'follow-schemes',
        'manage-fees',
        'read-student-fees',
        'manage-staff',
    ];

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
            self::Principal => __('Principal'),
            self::AcademicLead => __('Academic lead'),
            self::Teacher => __('Teacher'),
            self::FormMaster => __('Form master'),
            self::Admin => __('Administrator'),
            self::Accountant => __('Accountant'),
            self::HeadOfDepartment => __('Head of department'),
            self::Registrar => __('Registrar'),
            self::Bursar => __('Bursar'),
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
     * Whether the role's work is in the classroom, so the portal opens
     * on her day rather than on the school's administration.
     */
    public function teaches(): bool
    {
        return in_array($this, [self::Teacher, self::FormMaster, self::HeadOfDepartment], true);
    }

    /**
     * Whether the role may plan assessments, follow marks and publish results.
     */
    public function managesAssessments(): bool
    {
        return in_array($this, [self::Admin, self::Principal, self::AcademicLead], true);
    }

    /**
     * Whether the role may write the syllabus, open and close schemes
     * of work, and approve any scheme.
     */
    public function managesSchemes(): bool
    {
        return in_array($this, [self::Admin, self::Principal, self::AcademicLead], true);
    }

    /**
     * Whether the role follows the school's schemes of work: those who
     * manage them, and heads of department, who approve their own.
     */
    public function followsSchemes(): bool
    {
        return $this->managesSchemes() || $this === self::HeadOfDepartment;
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

    /**
     * Whether the role holds an ability from ABILITIES.
     */
    public function allows(string $ability): bool
    {
        return match ($ability) {
            'manage-structure' => $this->managesStructure(),
            'manage-students' => $this->managesStudents(),
            'see-private-student-details' => $this->seesPrivateStudentDetails(),
            'manage-assessments' => $this->managesAssessments(),
            'manage-schemes' => $this->managesSchemes(),
            'follow-schemes' => $this->followsSchemes(),
            'manage-fees' => $this->managesFees(),
            'read-student-fees' => $this->managesFees() || $this->managesStudents(),
            'manage-staff' => $this->managesStaff(),
            default => false,
        };
    }
}
