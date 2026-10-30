import { router, usePage } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { progress } from '@/actions/App/Http/Controllers/AssessmentController';
import {
    index as sheetsIndex,
    show,
    update,
} from '@/actions/App/Http/Controllers/MarkSheetController';
import type { PlanSummary } from '../ui';

export interface Row {
    student_id: string;
    name: string;
    mark_id: string | null;
    score: number | null;
    absent: boolean;
    remark: string | null;
    previous: number | null;
    correction: number | null;
}

export interface SheetProps {
    passMark: number;
    sheet: {
        id: string;
        subject: string | null;
        class: string | null;
        max: number;
        submitted_on: string | null;
        teacher: string | null;
    };
    plan: PlanSummary;
    open: boolean;
    siblings: {
        id: string;
        name: string | null;
        state: string | null;
        opens_on: string | null;
    }[];
    previous: string | null;
    next: NextStep;
    rows: Row[];
}

/**
 * Where to go once the sheet is in: the class's other sheets for the
 * assessment (from Marks progress), or the teacher's own.
 */
export interface NextStep {
    mode: 'class' | 'mine';
    plan_id: string;
    total: number;
    submitted: number;
    missing: string[];
    sheet: { id: string; subject: string | null; class: string | null } | null;
}

export interface Entry {
    score: string;
    absent: boolean;
    remark: string;
}

/**
 * The marks as typed so far, what they add up to, and saving them as a
 * draft or submitted.
 */
export function useMarkSheet({
    passMark,
    sheet,
    plan,
    open,
    siblings,
    previous,
    next,
    rows,
}: SheetProps) {
    const errors = usePage().props.errors as Record<string, string | undefined>;
    const [entries, setEntries] = useState<Record<string, Entry>>(() =>
        Object.fromEntries(
            rows.map((row) => [
                row.student_id,
                {
                    score: row.score === null ? '' : String(row.score),
                    absent: row.absent,
                    remark: row.remark ?? '',
                },
            ]),
        ),
    );
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [correcting, setCorrecting] = useState<string | null>(null);
    const inputs = useRef<Record<string, HTMLInputElement | null>>({});
    const published = plan.state === 'published';

    const valueOf = (id: string): number | null => {
        const raw = entries[id]?.score ?? '';

        return raw.trim() === '' || Number.isNaN(Number(raw))
            ? null
            : Number(raw);
    };
    const invalid = rows.filter(
        (row) =>
            !entries[row.student_id].absent &&
            (valueOf(row.student_id) ?? 0) > sheet.max,
    ).length;
    const empty = rows.filter(
        (row) =>
            !entries[row.student_id].absent && valueOf(row.student_id) === null,
    ).length;
    const scores = rows
        .map((row) =>
            entries[row.student_id].absent ? null : valueOf(row.student_id),
        )
        .filter(
            (value): value is number => value !== null && value <= sheet.max,
        );
    const average =
        scores.length > 0
            ? scores.reduce((sum, value) => sum + value, 0) / scores.length
            : null;
    const passed = scores.filter((value) => value >= passMark).length;

    function patch(id: string, change: Partial<Entry>) {
        setEntries({ ...entries, [id]: { ...entries[id], ...change } });
        setDirty(true);
    }

    function save(submit: boolean) {
        router.patch(
            update.url(sheet.id),
            {
                submit,
                marks: rows.map((row) => ({
                    student_id: row.student_id,
                    score: entries[row.student_id].absent
                        ? null
                        : valueOf(row.student_id),
                    absent: entries[row.student_id].absent,
                    remark: entries[row.student_id].remark.trim() || null,
                })),
            },
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
                onSuccess: () => setDirty(false),
            },
        );
    }

    const fromProgress = next.mode === 'class';
    const backHref = fromProgress
        ? progress.url({ query: { plan: next.plan_id } })
        : sheetsIndex.url();
    const sheetHref = (id: string) =>
        show.url(id, fromProgress ? { query: { from: 'progress' } } : {});

    const firstError = Object.entries(errors).find(([key]) =>
        key.startsWith('marks'),
    )?.[1];

    return {
        passMark,
        sheet,
        plan,
        open,
        siblings,
        previous,
        next,
        rows,
        errors,
        entries,
        saving,
        dirty,
        correcting,
        setCorrecting,
        inputs,
        published,
        valueOf,
        invalid,
        empty,
        scores,
        average,
        passed,
        patch,
        save,
        fromProgress,
        backHref,
        sheetHref,
        firstError,
    };
}

export type MarkSheetModel = ReturnType<typeof useMarkSheet>;
