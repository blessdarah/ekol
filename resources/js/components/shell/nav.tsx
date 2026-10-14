function Icon({ d }: { d: string }) {
    return (
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0"
        >
            <path d={d} />
        </svg>
    );
}

export const Icons = {
    dashboard: <Icon d="M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 14h7v6H4z" />,
    students: (
        <Icon d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 19v-1a4 4 0 0 0-3-3.87M15 3.13a4 4 0 0 1 0 7.75" />
    ),
    enrolment: <Icon d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />,
    classes: (
        <Icon d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5z" />
    ),
    series: (
        <Icon d="M12 2 2 7l10 5 10-5-10-5zM2 12l10 5 10-5M2 17l10 5 10-5" />
    ),
    assessments: (
        <Icon d="M9 11l3 3 8-8M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />
    ),
    timetable: (
        <Icon d="M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
    ),
    fees: (
        <Icon d="M20 7H5a2 2 0 0 1 0-4h14v4M20 7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5M18 14h.01" />
    ),
    staff: (
        <Icon d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M15.5 3.13a4 4 0 0 1 0 7.75" />
    ),
    settings: (
        <Icon d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    ),
    today: <Icon d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2" />,
    attendance: (
        <Icon d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM16 11l2 2 4-4" />
    ),
    log: <Icon d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />,
    marks: (
        <Icon d="M9 11l3 3 8-8M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />
    ),
    notes: <Icon d="M6 3h9l5 5v13H6zM14 3v6h6M9 13h7M9 17h5" />,
    bank: <Icon d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3" />,
    chevron: <Icon d="M6 9l6 6 6-6" />,
};

export interface NavLink {
    href: string;
    label: string;
    icon: keyof typeof Icons;
    badge?: number | null;
}

export interface NavSection {
    label: string;
    links: NavLink[];
}

export const NAV_SECTIONS: NavSection[] = [
    {
        label: 'Academics',
        links: [
            { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
            { href: '/students', label: 'Students', icon: 'students' },
            { href: '/enrolment', label: 'Enrolment', icon: 'enrolment' },
            {
                href: '/classes',
                label: 'Classes & Subjects',
                icon: 'classes',
            },
            {
                href: '/series',
                label: 'Series Registration',
                icon: 'series',
            },
            {
                href: '/assessments',
                label: 'Sequences & Exams',
                icon: 'assessments',
            },
            { href: '/timetable', label: 'Timetable', icon: 'timetable' },
        ],
    },
    {
        label: 'Administration',
        links: [
            { href: '/fees', label: 'Fees', icon: 'fees' },
            { href: '/staff', label: 'Teachers & Staff', icon: 'staff' },
            { href: '/setup', label: 'School Setup', icon: 'settings' },
        ],
    },
];

export const TEACHER_NAV_SECTIONS: NavSection[] = [
    {
        label: '',
        links: [
            { href: '/dashboard', label: 'Today', icon: 'today' },
            { href: '/my-timetable', label: 'My Timetable', icon: 'timetable' },
        ],
    },
    {
        label: 'In class',
        links: [
            { href: '/attendance', label: 'Attendance', icon: 'attendance' },
            { href: '/teaching-log', label: 'Teaching Log', icon: 'log' },
            { href: '/assessments/sheets', label: 'Marks', icon: 'marks' },
        ],
    },
    {
        label: 'Preparation',
        links: [
            { href: '/lesson-notes', label: 'Lesson Notes', icon: 'notes' },
            { href: '/question-bank', label: 'Question Bank', icon: 'bank' },
        ],
    },
];
