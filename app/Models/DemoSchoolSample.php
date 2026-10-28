<?php

namespace App\Models;

final class DemoSchoolSample
{
    public const array SUBJECTS = [
        ['code' => 'MATH', 'en' => 'Mathematics', 'fr' => 'Mathématiques', 'department' => 'Science', 'periods' => 4, 'coefficient' => 4,
            'teacher' => ['given' => 'Anne', 'family' => 'Nfor', 'gender' => 'female']],
        ['code' => 'ENG', 'en' => 'English', 'fr' => 'Anglais', 'department' => 'Languages', 'periods' => 3, 'coefficient' => 2,
            'teacher' => ['given' => 'Paul', 'family' => 'Tanjong', 'gender' => 'male']],
        ['code' => 'BIO', 'en' => 'Biology', 'fr' => 'Biologie', 'department' => 'Science', 'periods' => 3, 'coefficient' => 2,
            'teacher' => ['given' => 'Marie', 'family' => 'Fotso', 'gender' => 'female']],
    ];

    public const array CLASSES = [
        ['en' => 'Form 1', 'fr' => '6ème', 'code' => 'F1', 'age' => 12],
        ['en' => 'Form 2', 'fr' => '5ème', 'code' => 'F2', 'age' => 13],
    ];

    public const array STUDENTS = [
        ['surname' => 'Tabi', 'given' => 'Nkwain Junior', 'gender' => 'male'],
        ['surname' => 'Mbah', 'given' => 'Precious Ewi', 'gender' => 'female'],
        ['surname' => 'Atanga', 'given' => 'Fru Nelson', 'gender' => 'male'],
        ['surname' => 'Kum', 'given' => 'Sandrine Lum', 'gender' => 'female'],
        ['surname' => 'Tanyi', 'given' => 'Peter', 'gender' => 'male'],
        ['surname' => 'Bih', 'given' => 'Glory', 'gender' => 'female'],
        ['surname' => 'Achu', 'given' => 'Brandon', 'gender' => 'male'],
        ['surname' => 'Che', 'given' => 'Emmanuel', 'gender' => 'male'],
        ['surname' => 'Momo', 'given' => 'Estelle', 'gender' => 'female'],
        ['surname' => 'Nsame', 'given' => 'Junior', 'gender' => 'male'],
        ['surname' => 'Fonyuy', 'given' => 'Grace', 'gender' => 'female'],
        ['surname' => 'Ngwa', 'given' => 'Samuel', 'gender' => 'male'],
    ];

    public const array FEES = [
        ['en' => 'School fees', 'fr' => 'Frais de scolarité', 'amount' => 135000, 'spread' => true],
        ['en' => 'PTA contribution', 'fr' => 'Cotisation APE', 'amount' => 15000, 'spread' => false],
    ];

    public const array INSTALLMENTS = [40, 35, 25];

    public const array SAMPLE_PAYMENTS = [0, 20000, 69000, 150000, 0, 40000];
}
