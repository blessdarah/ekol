<?php

/*
 * Standard structures for "Start from a standard structure". Each level
 * is [name, short code, cycle, uses series], listed in school order.
 */

return [
    'anglophone_full' => [
        'name' => 'Anglophone · Form 1 to Upper Sixth',
        'description' => 'Five secondary forms, then Lower and Upper Sixth with series on.',
        'subsystem' => 'anglophone',
        'levels' => [
            ['Form 1', 'F1', 'secondary', false],
            ['Form 2', 'F2', 'secondary', false],
            ['Form 3', 'F3', 'secondary', false],
            ['Form 4', 'F4', 'secondary', false],
            ['Form 5', 'F5', 'secondary', false],
            ['Lower Sixth', 'L6', 'high_school', true],
            ['Upper Sixth', 'U6', 'high_school', true],
        ],
    ],
    'anglophone_secondary' => [
        'name' => 'Anglophone · Forms 1 to 5 only',
        'description' => 'For a school without a sixth form.',
        'subsystem' => 'anglophone',
        'levels' => [
            ['Form 1', 'F1', 'secondary', false],
            ['Form 2', 'F2', 'secondary', false],
            ['Form 3', 'F3', 'secondary', false],
            ['Form 4', 'F4', 'secondary', false],
            ['Form 5', 'F5', 'secondary', false],
        ],
    ],
    'francophone' => [
        'name' => 'Francophone · Sixième to Terminale',
        'description' => 'Seven levels, no series.',
        'subsystem' => 'francophone',
        'levels' => [
            ['Sixième', '6E', 'secondary', false],
            ['Cinquième', '5E', 'secondary', false],
            ['Quatrième', '4E', 'secondary', false],
            ['Troisième', '3E', 'secondary', false],
            ['Seconde', '2NDE', 'high_school', false],
            ['Première', '1ERE', 'high_school', false],
            ['Terminale', 'TLE', 'high_school', false],
        ],
    ],
];
