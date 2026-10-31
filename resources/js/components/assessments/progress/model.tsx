import { Link, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { show as sheetPage } from '@/actions/App/Http/Controllers/MarkSheetController';
import { edit as editSubject } from '@/actions/App/Http/Controllers/SubjectRegistrationController';
import { type AssessmentTabs, type PlanSummary, day } from '../ui';
import { t } from '../../../lib/i18n';

export interface ProgressProps {
    tabs: AssessmentTabs;
    plans: PlanSummary[];
    plan: PlanSummary | null;
    acceptsMarks: boolean;
    termEnds: string | null;
    stats: {
        submitted: number;
        total: number;
        teachers: number;
        unstaffed: number;
    };
    classes: {
        id: string | null;
        name: string;
        form_master: string | null;
        submitted: number;
        total: number;
        missing: MissingSheet[];
    }[];
    teachers: {
        id: string | null;
        name: string | null;
        initials: string | null;
        phone: string | null;
        missing: MissingSheet[];
    }[];
}

export interface MissingSheet {
    sheet_id: string;
    subject_id: string;
    subject: string | null;
    class: string | null;
    teacher: string | null;
    initials: string | null;
    entered: number;
    students: number;
}

export const STEPS = [
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'held', label: 'Tests held' },
    { key: 'marks_open', label: 'Marks open' },
    { key: 'marks_closed', label: 'Marks closed' },
    { key: 'published', label: 'Published' },
];

export const headClass =
    'text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase';

export function Tick() {
    return (
        <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-success)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
    );
}

/**
 * A sheet still to hand in: it opens the sheet, shows how many marks
 * are in once some are, and the teacher's initials when asked. A sheet
 * nobody teaches links to the subject to assign someone.
 */
export function SheetChip({
    sheet,
    label,
    withTeacher = false,
}: {
    sheet: MissingSheet;
    label: string;
    withTeacher?: boolean;
}) {
    if (!sheet.teacher) {
        return (
            <Link
                href={editSubject.url(sheet.subject_id)}
                className="flex h-7 items-center rounded-full border border-dashed border-warning-line bg-warning-tint px-[10px] text-[13px] font-medium text-warning-text hover:underline"
            >
                {t(':subject · no teacher, assign →', { subject: label })}
            </Link>
        );
    }

    return (
        <Link
            href={sheetPage.url(sheet.sheet_id, {
                query: { from: 'progress' },
            })}
            title={sheet.teacher}
            className={`flex h-7 items-center gap-[6px] rounded-full border border-solid border-border bg-white text-[13px] text-text hover:border-primary ${withTeacher ? 'pr-1 pl-[10px]' : 'px-[10px]'}`}
        >
            {label}
            {sheet.entered > 0 && (
                <span className="font-mono text-[11px] text-text-muted">
                    {sheet.entered}/{sheet.students}
                </span>
            )}
            {withTeacher && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-tint text-[10px] font-semibold text-primary">
                    {sheet.initials}
                </span>
            )}
        </Link>
    );
}
export function useMarksProgress({
    tabs,
    plans,
    plan,
    acceptsMarks,
    termEnds,
    stats,
    classes,
    teachers,
}: ProgressProps & { plan: NonNullable<ProgressProps['plan']> }) {
    const errors = usePage().props.errors as Record<string, string | undefined>;

    const [view, setView] = useState<'class' | 'teacher'>('class');

    const [onlyMissing, setOnlyMissing] = useState(true);

    const [closing, setClosing] = useState(false);

    const [extending, setExtending] = useState(false);

    const [until, setUntil] = useState(plan?.window_ends_on ?? '');

    const reached = {
        scheduled: 0,
        marks_open: 2,
        marks_closed: 3,
        published: 4,
        draft: -1,
    }[plan.state];

    const left = stats.total - stats.submitted;

    const canExtend = plan.state !== 'published';

    const waiting = left - stats.unstaffed;

    const complete = classes.filter(
        (row) => row.total > 0 && row.submitted >= row.total,
    ).length;

    const shownClasses = onlyMissing
        ? classes.filter((row) => row.missing.length > 0)
        : classes;

    const bar = [
        { count: stats.submitted, tone: 'bg-success' },
        { count: waiting, tone: 'bg-warning' },
        { count: stats.unstaffed, tone: 'bg-text-disabled' },
    ].filter((part) => part.count > 0);

    const deadline = {
        scheduled: t('Marks open :date', { date: day(plan.window_starts_on) }),
        marks_open: t('Marks close :date', {
            date: day(plan.window_ends_on),
        }),
        marks_closed: t('Marks closed :date', { date: day(plan.closed_on) }),
        published: t('Published :date', { date: day(plan.published_on) }),
        draft: '',
    }[plan.state];
    return {
        tabs,
        plans,
        plan,
        acceptsMarks,
        termEnds,
        stats,
        classes,
        teachers,
        errors,
        view,
        setView,
        onlyMissing,
        setOnlyMissing,
        closing,
        setClosing,
        extending,
        setExtending,
        until,
        setUntil,
        reached,
        left,
        canExtend,
        waiting,
        complete,
        shownClasses,
        bar,
        deadline,
    };
}
export type MarksProgressModel = ReturnType<typeof useMarksProgress>;
