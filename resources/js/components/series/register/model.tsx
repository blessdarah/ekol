import { router } from '@inertiajs/react';
import { useState } from 'react';
import {
    one,
    register,
} from '@/actions/App/Http/Controllers/SeriesRegistrationController';
import { choiceProblem, coreOf, poolOf, type SeriesOption } from '../ui';
import { useTableQuery } from '../../table/ui';

export interface RegisterProps {
    yearLabel: string | null;
    hasTerm: boolean;
    level: { id: string; name: string };
    counts: { total: number; unassigned: number };
    tab: 'unassigned' | 'registered';
    q: string;
    students: { id: string; name: string; matricule: string }[];
    student: {
        id: string;
        name: string;
        matricule: string;
        class: string | null;
        series_id: string | null;
        electives: string[];
    } | null;
    nextId: string | null;
    series: SeriesOption[];
    teachers: Record<string, string>;
}

/**
 * The student being registered, the series and electives chosen for
 * them, the list search, and saving the choice.
 */
export function useRegisterOne({
    hasTerm,
    level,
    counts,
    tab,
    q,
    students,
    student,
    nextId,
    series,
    teachers,
}: RegisterProps) {
    const [seriesId, setSeriesId] = useState(student?.series_id ?? '');
    const [electives, setElectives] = useState<string[]>(
        student?.electives ?? [],
    );
    const table = useTableQuery((query) => one.url({ query }), {
        level: level.id,
        tab,
        q,
        ...(student ? { student: student.id } : {}),
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const chosen = series.find((option) => option.id === seriesId);
    const core = chosen ? coreOf(chosen) : [];
    const pool = chosen ? poolOf(chosen) : [];
    const total = core.length + electives.length;
    const problem = chosen ? choiceProblem(chosen, electives.length) : null;
    const room =
        chosen?.max !== null && chosen?.max !== undefined
            ? chosen.max - total
            : null;

    function visit(patch: { tab?: string; q?: string; student?: string }) {
        const query: Record<string, string> = {
            level: level.id,
            tab: patch.tab ?? tab,
        };
        const text = patch.q ?? table.search;

        if (text) {
            query.q = text;
        }
        if (patch.student) {
            query.student = patch.student;
        }

        router.get(one.url({ query }), {}, { preserveScroll: true });
    }

    function chooseSeries(id: string) {
        const next = series.find((option) => option.id === id);
        const allowed = next ? poolOf(next).map((subject) => subject.id) : [];

        setSeriesId(id);
        setElectives(electives.filter((subject) => allowed.includes(subject)));
        setErrors({});
    }

    function toggle(id: string) {
        setElectives(
            electives.includes(id)
                ? electives.filter((subject) => subject !== id)
                : [...electives, id],
        );
    }

    function submit() {
        if (!student) {
            return;
        }

        setSaving(true);
        router.post(
            register.url(),
            {
                student_id: student.id,
                series_id: seriesId,
                electives,
                next_id: tab === 'unassigned' ? nextId : null,
            },
            {
                // The next student must start from a clean form.
                preserveState: 'errors',
                onError: (failed) => setErrors(failed),
                onFinish: () => setSaving(false),
            },
        );
    }

    return {
        hasTerm,
        level,
        counts,
        tab,
        students,
        student,
        nextId,
        series,
        teachers,
        seriesId,
        electives,
        table,
        errors,
        saving,
        chosen,
        core,
        pool,
        total,
        problem,
        room,
        visit,
        chooseSeries,
        toggle,
        submit,
    };
}

export type RegisterOne = ReturnType<typeof useRegisterOne>;
