<?php

/*
 * Prepared subject sets for "Start from a template". Each subject is
 * [name, code, department, coefficient, weekly periods, from], where
 * `from` skips that many of the cycle's lowest levels (2 = from the
 * third level up).
 */

return [
    'secondary' => [
        'name' => 'Secondary · Forms 1–5 (GCE O-Level)',
        'description' => 'Core and elective subjects for the general stream.',
        'cycle' => 'secondary',
        'subjects' => [
            ['Mathematics', 'MATH-101', 'Sciences', 4, 5, 0],
            ['English Language', 'ENG-102', 'Languages', 4, 5, 0],
            ['French', 'FRE-112', 'Languages', 3, 4, 0],
            ['Biology', 'BIO-203', 'Sciences', 3, 3, 0],
            ['Chemistry', 'CHE-202', 'Sciences', 3, 3, 2],
            ['Physics', 'PHY-201', 'Sciences', 3, 3, 2],
            ['Literature in English', 'LIT-104', 'Languages', 2, 3, 0],
            ['History', 'HIS-205', 'Arts', 2, 2, 0],
            ['Geography', 'GEO-206', 'Arts', 2, 2, 0],
            ['Economics', 'ECO-210', 'Arts', 2, 3, 2],
            ['Commerce', 'COM-211', 'Arts', 2, 3, 2],
            ['Computer Science', 'CSE-221', 'Sciences', 2, 2, 0],
            ['Food Science', 'FSC-115', 'General', 2, 2, 0],
            ['Home Economics', 'HEC-116', 'General', 2, 2, 0],
            ['Religious Studies', 'REL-130', 'General', 1, 1, 0],
            ['Citizenship', 'CIV-140', 'General', 1, 1, 0],
            ['Physical Education', 'PED-150', 'General', 1, 2, 0],
            ['Additional Mathematics', 'AMT-301', 'Sciences', 3, 3, 3],
        ],
    ],
    'advanced' => [
        'name' => 'Advanced Level · Lower & Upper Sixth',
        'description' => 'Science and arts series subjects.',
        'cycle' => 'high_school',
        'subjects' => [
            ['Pure Mathematics with Mechanics', 'PMM-401', 'Sciences', 5, 7, 0],
            ['Pure Mathematics with Statistics', 'PMS-402', 'Sciences', 5, 7, 0],
            ['Further Mathematics', 'FMT-302', 'Sciences', 5, 6, 0],
            ['Physics', 'PHY-411', 'Sciences', 5, 7, 0],
            ['Chemistry', 'CHE-412', 'Sciences', 5, 7, 0],
            ['Biology', 'BIO-413', 'Sciences', 5, 7, 0],
            ['Geology', 'GEL-240', 'Sciences', 3, 5, 0],
            ['Computer Science', 'CSE-421', 'Sciences', 3, 5, 0],
            ['Literature in English', 'LIT-404', 'Arts', 5, 6, 0],
            ['History', 'HIS-405', 'Arts', 5, 6, 0],
            ['Geography', 'GEO-406', 'Arts', 5, 6, 0],
            ['Economics', 'ECO-410', 'Arts', 5, 6, 0],
            ['French', 'FRE-412', 'Languages', 5, 6, 0],
            ['Philosophy', 'PHI-430', 'Arts', 3, 4, 0],
        ],
    ],
    'technical' => [
        'name' => 'Technical & vocational · Forms 1–5',
        'description' => 'Workshop, drawing and commercial subjects.',
        'cycle' => 'secondary',
        'subjects' => [
            ['Mathematics', 'MATH-101', 'Sciences', 4, 5, 0],
            ['English Language', 'ENG-102', 'Languages', 4, 5, 0],
            ['French', 'FRE-112', 'Languages', 3, 4, 0],
            ['Engineering Science', 'ESC-508', 'Technical', 3, 3, 0],
            ['Technical Drawing', 'TDR-501', 'Technical', 3, 4, 0],
            ['Woodwork', 'WWK-502', 'Technical', 3, 4, 0],
            ['Metalwork', 'MWK-503', 'Technical', 3, 4, 0],
            ['Electricity', 'ELE-504', 'Technical', 3, 4, 0],
            ['Electronics', 'ELN-507', 'Technical', 3, 4, 2],
            ['Building Construction', 'BCN-505', 'Technical', 3, 4, 0],
            ['Motor Mechanics', 'MME-506', 'Technical', 3, 4, 2],
            ['Accounting', 'ACC-520', 'Commercial', 3, 4, 0],
            ['Commerce', 'COM-211', 'Commercial', 2, 3, 0],
            ['Office Practice', 'OFP-522', 'Commercial', 2, 3, 0],
            ['Typewriting and ICT', 'TIC-523', 'Commercial', 2, 2, 0],
            ['Citizenship', 'CIV-140', 'General', 1, 1, 0],
        ],
    ],
    'core' => [
        'name' => 'Core subjects only',
        'description' => 'A short start: what every class takes.',
        'cycle' => 'secondary',
        'subjects' => [
            ['Mathematics', 'MATH-101', 'Sciences', 4, 5, 0],
            ['English Language', 'ENG-102', 'Languages', 4, 5, 0],
            ['French', 'FRE-112', 'Languages', 3, 4, 0],
            ['Biology', 'BIO-203', 'Sciences', 3, 3, 0],
            ['History', 'HIS-205', 'Arts', 2, 2, 0],
            ['Geography', 'GEO-206', 'Arts', 2, 2, 0],
            ['Citizenship', 'CIV-140', 'General', 1, 1, 0],
            ['Physical Education', 'PED-150', 'General', 1, 2, 0],
        ],
    ],
];
