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
}
