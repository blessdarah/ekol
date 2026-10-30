import { useState } from 'react';
import { storeTemplates } from '@/actions/App/Http/Controllers/SubjectController';
import { router } from '@inertiajs/react';
import { t } from '../../../lib/i18n';
import {
    type Assignments,
    type ClassOption,
    type LevelOption,
    type StaffOption,
    toRows,
    totalPeriods,
    unstaffedCount,
} from '../class-table';

export interface TemplateSubject {
    name: string;
    code: string;
    department: string;
    coefficient: number;
    weekly_periods: number;
    level_ids: string[];
    levels_label: string;
    registered: boolean;
}

export interface TemplateSet {
    key: string;
    name: string;
    description: string;
    subjects: TemplateSubject[];
}

export interface TemplatesProps {
    yearLabel: string | null;
    sets: TemplateSet[];
    levels: LevelOption[];
    classes: ClassOption[];
    staff: StaffOption[];
}

export interface Plan {
    level_ids: string[];
    assignments: Assignments;
}

export const STEPS = ['Choose a set', 'Classes & teachers', 'Review'];

export const TITLES = [
    'Start from a template',
    'Classes & teachers',
    'Review and create',
];

export function isReady(plan: Plan): boolean {
    return (
        Object.keys(plan.assignments).length > 0 &&
        unstaffedCount(plan.assignments) === 0
    );
}

export function staffing(plan: Plan): string {
    const rows = Object.values(plan.assignments);
    const teachers = new Set(rows.map((row) => row.staff_id).filter(Boolean))
        .size;
    const classes = `${rows.length} ${rows.length === 1 ? 'class' : 'classes'}`;

    if (rows.length === 0) {
        return t('No classes');
    }

    return teachers === 0
        ? t(':classes · no teacher', { classes })
        : `${classes} · ${teachers} ${teachers === 1 ? 'teacher' : 'teachers'}`;
}
/** The wizard's choices so far: the set, the subjects ticked, and each one's classes and teachers. */
export function useTemplateWizard({
    yearLabel,
    sets,
    levels,
    classes,
    staff,
}: TemplatesProps) {
    const [step, setStep] = useState(0);
    const [setKey, setSetKey] = useState(sets[0]?.key ?? '');
    const set = sets.find((option) => option.key === setKey) ?? sets[0];
    const [unticked, setUnticked] = useState<string[]>([]);
    const [plans, setPlans] = useState<Record<string, Plan>>({});
    const [current, setCurrent] = useState<string | null>(null);
    const [sameTeacher, setSameTeacher] = useState('');
    const [showAll, setShowAll] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    const available = set.subjects.filter((subject) => !subject.registered);
    const picked = available.filter(
        (subject) => !unticked.includes(subject.code),
    );
    const alreadyRegistered = set.subjects.length - available.length;
    const active =
        picked.find((subject) => subject.code === current) ?? picked[0];
    const activePlan = active ? plans[active.code] : undefined;
    const ready = picked.filter(
        (subject) => plans[subject.code] && isReady(plans[subject.code]),
    );
    const periods = picked.reduce(
        (sum, subject) =>
            sum +
            (plans[subject.code]
                ? totalPeriods(plans[subject.code].assignments)
                : 0),
        0,
    );

    function chooseSet(key: string) {
        setSetKey(key);
        setUnticked([]);
        setPlans({});
        setCurrent(null);
    }

    /** Every class of the template's levels starts ticked, with no teacher. */
    function startPlans() {
        const next: Record<string, Plan> = {};

        for (const subject of picked) {
            if (plans[subject.code]) {
                next[subject.code] = plans[subject.code];
                continue;
            }

            const assignments: Assignments = {};

            for (const option of classes) {
                if (subject.level_ids.includes(option.level_id)) {
                    assignments[option.id] = {
                        staff_id: '',
                        weekly_periods: String(subject.weekly_periods),
                    };
                }
            }

            next[subject.code] = { level_ids: subject.level_ids, assignments };
        }

        setPlans(next);
        setCurrent(picked[0]?.code ?? null);
        setStep(1);
    }

    function updatePlan(code: string, patch: Partial<Plan>) {
        setPlans({ ...plans, [code]: { ...plans[code], ...patch } });
    }

    function changeLevels(code: string, levelIds: string[]) {
        const kept: Assignments = {};

        for (const option of classes) {
            if (
                levelIds.includes(option.level_id) &&
                plans[code].assignments[option.id]
            ) {
                kept[option.id] = plans[code].assignments[option.id];
            }
        }

        updatePlan(code, { level_ids: levelIds, assignments: kept });
    }

    function applyTeacher(code: string) {
        const assignments: Assignments = {};

        for (const [classId, row] of Object.entries(plans[code].assignments)) {
            assignments[classId] = { ...row, staff_id: sameTeacher };
        }

        updatePlan(code, { assignments });
    }

    function createAll() {
        setCreating(true);
        router.post(
            storeTemplates.url(),
            {
                set: set.key,
                subjects: picked.map((subject) => ({
                    code: subject.code,
                    classes: toRows(plans[subject.code].assignments),
                })),
            },
            {
                onError: (failed) => setError(Object.values(failed)[0] ?? null),
                onFinish: () => setCreating(false),
            },
        );
    }

    return {
        yearLabel,
        sets,
        levels,
        classes,
        staff,
        step,
        setStep,
        set,
        unticked,
        setUnticked,
        plans,
        current,
        setCurrent,
        sameTeacher,
        setSameTeacher,
        showAll,
        setShowAll,
        error,
        setError,
        creating,
        available,
        picked,
        alreadyRegistered,
        active,
        activePlan,
        ready,
        periods,
        chooseSet,
        startPlans,
        updatePlan,
        changeLevels,
        applyTeacher,
        createAll,
    };
}

export type TemplateWizard = ReturnType<typeof useTemplateWizard>;
