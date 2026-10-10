import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import {
    create,
    index,
    storeTemplates,
} from '@/actions/App/Http/Controllers/SubjectController';
import {
    ErrorText,
    StructureHeader,
    capsLabelClass,
    outlineButtonClass,
    solidButtonClass,
} from '../../components/structure/ui';
import {
    ClassTable,
    LevelPicker,
    toRows,
    totalPeriods,
    unstaffedCount,
    type Assignments,
    type ClassOption,
    type LevelOption,
    type StaffOption,
} from '../../components/subjects/class-table';
import { withAppShell } from '../../layouts/app-layout';

interface TemplateSubject {
    name: string;
    code: string;
    department: string;
    coefficient: number;
    weekly_periods: number;
    level_ids: string[];
    levels_label: string;
    registered: boolean;
}

interface TemplateSet {
    key: string;
    name: string;
    description: string;
    subjects: TemplateSubject[];
}

interface TemplatesProps {
    yearLabel: string | null;
    sets: TemplateSet[];
    levels: LevelOption[];
    classes: ClassOption[];
    staff: StaffOption[];
}

interface Plan {
    level_ids: string[];
    assignments: Assignments;
}

const STEPS = ['Choose a set', 'Classes & teachers', 'Review'];

const TITLES = ['Start from a template', 'Classes & teachers', 'Review and create'];

function isReady(plan: Plan): boolean {
    return (
        Object.keys(plan.assignments).length > 0 &&
        unstaffedCount(plan.assignments) === 0
    );
}

function staffing(plan: Plan): string {
    const rows = Object.values(plan.assignments);
    const teachers = new Set(rows.map((row) => row.staff_id).filter(Boolean)).size;
    const classes = `${rows.length} ${rows.length === 1 ? 'class' : 'classes'}`;

    if (rows.length === 0) {
        return 'No classes';
    }

    return teachers === 0
        ? `${classes} · no teacher`
        : `${classes} · ${teachers} ${teachers === 1 ? 'teacher' : 'teachers'}`;
}

function Progress({ step }: { step: number }) {
    return (
        <ol className="flex flex-wrap items-center gap-3">
            {STEPS.map((label, position) => (
                <li key={label} className="flex items-center gap-3">
                    {position > 0 && (
                        <span
                            className={`h-px w-12 shrink-0 ${position <= step ? 'bg-primary' : 'bg-border'}`}
                        />
                    )}
                    <span className="flex items-center gap-2">
                        <span
                            className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] leading-4 font-semibold ${
                                position === step
                                    ? 'bg-primary text-white'
                                    : position < step
                                      ? 'bg-primary-tint'
                                      : 'border border-solid border-border bg-surface text-text-muted'
                            }`}
                        >
                            {position < step ? (
                                <svg width="12" height="12" viewBox="0 0 12 12">
                                    <path d="M2.6 6.2 4.9 8.5 9.4 3.9" fill="none" stroke="#0E4D3A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            ) : (
                                position + 1
                            )}
                        </span>
                        <span
                            className={`text-[13px] leading-4 ${position <= step ? 'font-semibold text-text' : 'text-text-muted'}`}
                        >
                            {label}
                        </span>
                    </span>
                </li>
            ))}
            <li className="ml-auto text-[13px] leading-4 text-text-muted">
                Step {step + 1} of {STEPS.length}
            </li>
        </ol>
    );
}

function Templates({ yearLabel, sets, levels, classes, staff }: TemplatesProps) {
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
    const picked = available.filter((subject) => !unticked.includes(subject.code));
    const alreadyRegistered = set.subjects.length - available.length;
    const active = picked.find((subject) => subject.code === current) ?? picked[0];
    const activePlan = active ? plans[active.code] : undefined;
    const ready = picked.filter((subject) => plans[subject.code] && isReady(plans[subject.code]));
    const periods = picked.reduce(
        (sum, subject) => sum + (plans[subject.code] ? totalPeriods(plans[subject.code].assignments) : 0),
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
            if (levelIds.includes(option.level_id) && plans[code].assignments[option.id]) {
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

    return (
        <div className="flex min-h-[calc(100vh-56px)] flex-col gap-7">
            <Head title={TITLES[step]} />
            <StructureHeader
                path="Subjects / Templates"
                title={TITLES[step]}
                tag={`Subject setup${yearLabel ? ` · ${yearLabel}` : ''}`}
                meta={
                    step === 0
                        ? 'create many subjects in one go'
                        : `${picked.length} subjects from ${set.name}`
                }
            />
            <Progress step={step} />

            {step === 0 && (
                <div className="flex flex-1 flex-col gap-8 lg:flex-row">
                    <div className="flex shrink-0 flex-col gap-3 lg:w-[340px]">
                        <p className={capsLabelClass}>Template sets</p>
                        <div role="radiogroup" aria-label="Template sets" className="flex flex-col gap-[10px]">
                            {sets.map((option) => {
                                const selected = option.key === set.key;

                                return (
                                    <button
                                        key={option.key}
                                        type="button"
                                        role="radio"
                                        aria-checked={selected}
                                        onClick={() => chooseSet(option.key)}
                                        className={`flex gap-3 rounded-lg border border-solid p-[14px] text-left ${
                                            selected
                                                ? 'border-primary bg-primary-tint'
                                                : 'border-border bg-white hover:bg-surface'
                                        }`}
                                    >
                                        <span
                                            className={`mt-px h-[18px] w-[18px] shrink-0 rounded-full border-solid bg-white ${
                                                selected ? 'border-[5px] border-primary' : 'border border-border'
                                            }`}
                                        />
                                        <span className="flex flex-1 flex-col gap-1">
                                            <span className="text-[14px] leading-[18px] font-semibold text-text">
                                                {option.name}
                                            </span>
                                            <span className="text-[13px] leading-[18px] text-text-muted">
                                                {option.description}
                                            </span>
                                            <span
                                                className={`pt-[2px] font-mono text-[12px] leading-4 ${selected ? 'text-primary' : 'text-text-muted'}`}
                                            >
                                                {option.subjects.length} subjects
                                            </span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        <p className="flex items-center gap-[6px] pt-1 text-[13px] leading-[18px] text-text-muted">
                            Need just one subject?
                            <Link href={create.url()} className="font-medium text-primary hover:underline">
                                Register it from scratch
                            </Link>
                        </p>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                        <div className="flex flex-col gap-1">
                            <p className={capsLabelClass}>Subjects in this set</p>
                            <p className="text-[13px] leading-4 text-text-muted">
                                Untick any you do not need. Coefficients and
                                levels come from the template. You can change
                                the levels next.
                            </p>
                        </div>
                        <div className="flex flex-col overflow-clip rounded-md border border-solid border-border">
                            <div className="flex h-8 shrink-0 items-center gap-3 bg-surface px-3 text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase">
                                <span className="w-[18px] shrink-0" />
                                <span className="flex-1">Subject</span>
                                <span className="w-[84px] shrink-0">Code</span>
                                <span className="w-16 shrink-0">Levels</span>
                                <span className="w-11 shrink-0">Coeff</span>
                            </div>
                            {set.subjects.map((subject, position) => {
                                const on = !subject.registered && !unticked.includes(subject.code);
                                const tone = on ? 'text-text' : 'text-text-muted';

                                return (
                                    <label
                                        key={subject.code}
                                        className={`flex h-[38px] shrink-0 items-center gap-3 border-t border-solid border-border px-3 ${
                                            subject.registered ? '' : 'cursor-pointer'
                                        } ${position % 2 === 1 || subject.registered ? 'bg-row-alt' : ''}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={on}
                                            disabled={subject.registered}
                                            onChange={() =>
                                                setUnticked(
                                                    on
                                                        ? [...unticked, subject.code]
                                                        : unticked.filter((code) => code !== subject.code),
                                                )
                                            }
                                            className="h-[18px] w-[18px] shrink-0 accent-primary"
                                        />
                                        <span className="flex min-w-0 flex-1 items-center gap-2">
                                            <span className={`truncate text-[14px] leading-[18px] font-medium ${tone}`}>
                                                {subject.name}
                                            </span>
                                            {subject.registered && (
                                                <span className="flex h-5 shrink-0 items-center rounded-full border border-solid border-border bg-surface px-2 text-[11px] leading-[14px] font-medium text-text-muted">
                                                    Already registered
                                                </span>
                                            )}
                                        </span>
                                        <span className={`w-[84px] shrink-0 font-mono text-[12px] leading-4 ${tone}`}>
                                            {subject.code}
                                        </span>
                                        <span className="w-16 shrink-0 text-[13px] leading-4 text-text-muted">
                                            {subject.levels_label}
                                        </span>
                                        <span className={`w-11 shrink-0 font-mono text-[13px] leading-4 ${tone}`}>
                                            {subject.coefficient}
                                        </span>
                                    </label>
                                );
                            })}
                            <div className="flex h-9 shrink-0 items-center justify-between border-t border-solid border-border bg-surface px-3">
                                <span className="text-[13px] leading-4 text-text-muted">
                                    {set.subjects.length} subjects in the set
                                </span>
                                <span className="flex items-baseline gap-[6px]">
                                    <span className="font-mono text-[13px] leading-4 text-text">
                                        {picked.length} selected
                                    </span>
                                    <span className="text-[13px] leading-4 text-text-muted">
                                        · {alreadyRegistered} already registered
                                    </span>
                                </span>
                            </div>
                        </div>
                        {classes.length === 0 && (
                            <p className="text-[13px] leading-[19px] text-warning">
                                There are no classes yet, so subjects will be
                                created as drafts with no classes. Add levels
                                and classes first to assign teachers here.
                            </p>
                        )}
                    </div>
                </div>
            )}

            {step === 1 && active && activePlan && (
                <div className="flex flex-1 flex-col gap-8 lg:flex-row">
                    <div className="flex shrink-0 flex-col gap-3 lg:w-[300px]">
                        <div className="flex items-center justify-between">
                            <p className={capsLabelClass}>{picked.length} subjects</p>
                            {picked.length - ready.length > 0 && (
                                <span className="flex h-6 items-center gap-[6px] rounded-full bg-warning-tint px-[10px] text-[12px] leading-4 font-medium text-[#8A5A12]">
                                    <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-warning" />
                                    {picked.length - ready.length} need teachers
                                </span>
                            )}
                        </div>
                        <div className="flex flex-col gap-[2px] rounded-lg bg-surface p-[6px]">
                            {picked.map((subject) => {
                                const plan = plans[subject.code];
                                const rows = Object.values(plan.assignments);
                                const selected = subject.code === active.code;

                                return (
                                    <button
                                        key={subject.code}
                                        type="button"
                                        aria-pressed={selected}
                                        onClick={() => {
                                            setCurrent(subject.code);
                                            setSameTeacher('');
                                        }}
                                        className={`flex h-[38px] shrink-0 items-center gap-[10px] rounded-md px-[10px] text-left ${selected ? 'bg-primary-tint' : 'hover:bg-white'}`}
                                    >
                                        <span
                                            className={`size-2 shrink-0 rounded-full ${isReady(plan) ? 'bg-success' : 'bg-warning'}`}
                                        />
                                        <span
                                            className={`flex-1 truncate text-[14px] leading-[18px] ${selected ? 'font-semibold text-primary' : 'font-medium text-text'}`}
                                        >
                                            {subject.name}
                                        </span>
                                        <span className="font-mono text-[12px] leading-4 text-text-muted">
                                            {rows.filter((row) => row.staff_id).length} / {rows.length}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-[13px] leading-[18px] text-text-muted">
                            Classes with a teacher, out of classes taking the
                            subject.
                        </p>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col gap-4">
                        <div className="flex flex-wrap items-end justify-between gap-3">
                            <div className="flex flex-col gap-[2px]">
                                <h2 className="font-display text-[28px] leading-[34px] font-bold tracking-[-0.02em] text-text">
                                    {active.name}
                                </h2>
                                <p className="font-mono text-[13px] leading-4 text-text-muted">
                                    {active.code} · {active.department}
                                </p>
                            </div>
                            <p className="flex h-8 items-center gap-2 rounded-md border border-solid border-border bg-surface px-3">
                                <span className="text-[13px] leading-4 text-text-muted">Coefficient</span>
                                <span className="font-mono text-[14px] leading-[18px] text-text">
                                    {active.coefficient}
                                </span>
                                <span className="text-[12px] leading-4 text-text-muted">from template</span>
                            </p>
                        </div>
                        <LevelPicker
                            levels={levels}
                            value={activePlan.level_ids}
                            onChange={(next) => changeLevels(active.code, next)}
                        />
                        <div className="flex flex-wrap items-center gap-3 rounded-md bg-surface px-3 py-[10px]">
                            <span className="text-[13px] leading-4 text-text-muted">
                                Same teacher for every class?
                            </span>
                            <select
                                aria-label="Teacher for every class"
                                value={sameTeacher}
                                onChange={(e) => setSameTeacher(e.target.value)}
                                className="h-[30px] w-[200px] rounded-md border border-solid border-border bg-white px-[10px] text-[14px] text-text outline-none focus:border-primary"
                            >
                                <option value="">Choose a teacher</option>
                                {staff.map((member) => (
                                    <option key={member.id} value={member.id}>
                                        {member.name}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                disabled={!sameTeacher}
                                onClick={() => applyTeacher(active.code)}
                                className="flex h-[30px] items-center rounded-md border border-solid border-border bg-white px-3 text-[13px] leading-4 font-medium text-text hover:bg-primary-tint disabled:opacity-50"
                            >
                                Apply to all
                            </button>
                        </div>
                        <ClassTable
                            classes={classes.filter((option) => activePlan.level_ids.includes(option.level_id))}
                            staff={staff}
                            value={activePlan.assignments}
                            defaultPeriods={active.weekly_periods}
                            onChange={(assignments) => updatePlan(active.code, { assignments })}
                        />
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="flex flex-1 flex-col gap-8 lg:flex-row">
                    <div className="flex min-w-0 flex-1 flex-col gap-5">
                        <dl className="flex border-y border-solid border-border">
                            {[
                                ['To create', picked.length, 'subjects', 'text-text'],
                                ['Ready', ready.length, 'fully staffed', 'text-success'],
                                ['Drafts', picked.length - ready.length, 'need a teacher', 'text-[#8A5A12]'],
                                ['Periods', periods, 'per week, all classes', 'text-text'],
                            ].map(([label, value, note, tone], position) => (
                                <div
                                    key={label as string}
                                    className={`flex flex-1 flex-col gap-1 py-[14px] ${position === 0 ? 'pr-4' : 'border-l border-solid border-border px-4'}`}
                                >
                                    <dt className={capsLabelClass}>{label}</dt>
                                    <dd className="flex flex-col gap-1">
                                        <span className={`font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] ${tone}`}>
                                            {value}
                                        </span>
                                        <span className="text-[13px] leading-4 text-text-muted">{note}</span>
                                    </dd>
                                </div>
                            ))}
                        </dl>
                        <div className="flex flex-col overflow-clip rounded-md border border-solid border-border">
                            <div className="flex h-8 shrink-0 items-center gap-3 bg-surface px-3 text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase">
                                <span className="flex-1">Subject</span>
                                <span className="w-11 shrink-0">Coeff</span>
                                <span className="w-[170px] shrink-0">Classes &amp; teachers</span>
                                <span className="w-16 shrink-0">Periods</span>
                                <span className="w-[92px] shrink-0">Status</span>
                            </div>
                            {(showAll ? picked : picked.slice(0, 8)).map((subject, position) => {
                                const plan = plans[subject.code];
                                const done = isReady(plan);

                                return (
                                    <div
                                        key={subject.code}
                                        className={`flex h-[38px] shrink-0 items-center gap-3 border-t border-solid border-border px-3 ${position % 2 === 1 ? 'bg-row-alt' : ''}`}
                                    >
                                        <span className="flex-1 truncate text-[14px] leading-[18px] font-medium text-text">
                                            {subject.name}
                                        </span>
                                        <span className="w-11 shrink-0 font-mono text-[13px] leading-4 text-text">
                                            {subject.coefficient}
                                        </span>
                                        <span className="flex w-[170px] shrink-0 items-center gap-[6px] text-[13px] leading-4 text-text">
                                            {!done && (
                                                <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-warning" />
                                            )}
                                            {staffing(plan)}
                                        </span>
                                        <span className="w-16 shrink-0 font-mono text-[13px] leading-4 text-text">
                                            {totalPeriods(plan.assignments)}
                                        </span>
                                        <span
                                            className={`flex h-[22px] w-[92px] shrink-0 items-center gap-[6px] rounded-full px-2 text-[12px] leading-4 font-medium ${
                                                done
                                                    ? 'bg-success-tint text-success'
                                                    : 'bg-warning-tint text-[#8A5A12]'
                                            }`}
                                        >
                                            <span
                                                className={`h-[6px] w-[6px] shrink-0 rounded-full ${done ? 'bg-success' : 'bg-warning'}`}
                                            />
                                            {done ? 'Ready' : 'Draft'}
                                        </span>
                                    </div>
                                );
                            })}
                            <div className="flex h-9 shrink-0 items-center justify-between border-t border-solid border-border bg-surface px-3">
                                <span className="text-[13px] leading-4 text-text-muted">
                                    {showAll ? picked.length : Math.min(8, picked.length)} of {picked.length} shown
                                </span>
                                {picked.length > 8 && (
                                    <button
                                        type="button"
                                        onClick={() => setShowAll(!showAll)}
                                        className="text-[13px] leading-4 font-medium text-primary hover:underline"
                                    >
                                        {showAll ? 'Show fewer' : `Show all ${picked.length}`}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <aside className="flex shrink-0 flex-col gap-5 border-solid border-border lg:w-[328px] lg:border-l lg:pl-8">
                        <div className="flex flex-col gap-2 rounded-lg border border-solid border-border bg-surface p-4">
                            <p className={capsLabelClass}>When you create</p>
                            <p className="font-display text-[16px] leading-[22px] font-bold text-text">
                                Ready subjects go live straight away.
                            </p>
                            <p className="text-[13px] leading-[19px] text-text-muted">
                                They open for marks entry and the timetable.
                                Drafts wait under Needs teacher in the roster
                                until every class has one.
                            </p>
                        </div>
                        {alreadyRegistered + unticked.length > 0 && (
                            <div className="flex flex-col gap-[10px] rounded-lg border border-solid border-border bg-white p-4">
                                <p className="text-[14px] leading-[18px] font-semibold text-text">
                                    Left as they are
                                </p>
                                {alreadyRegistered > 0 && (
                                    <p className="flex items-center gap-2 text-[13px] leading-4 text-text-muted">
                                        <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-success" />
                                        {alreadyRegistered} already registered
                                    </p>
                                )}
                                {unticked.length > 0 && (
                                    <p className="flex items-center gap-2 text-[13px] leading-4 text-text-muted">
                                        <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-success" />
                                        {unticked.length} template subjects you unticked
                                    </p>
                                )}
                            </div>
                        )}
                    </aside>
                </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <p className="text-[13px] leading-4 text-text-muted">
                        {step === 0 &&
                            'Subjects you already have are left alone. Next, choose classes and teachers.'}
                        {step === 1 &&
                            `${ready.length} of ${picked.length} subjects are fully staffed. The rest are saved as drafts.`}
                        {step === 2 && 'You can edit any subject afterwards from the roster.'}
                    </p>
                    <ErrorText message={error} />
                </div>
                <div className="flex gap-2">
                    {step === 0 ? (
                        <Link href={index.url()} className={outlineButtonClass}>
                            Cancel
                        </Link>
                    ) : (
                        <button type="button" onClick={() => setStep(step - 1)} className={outlineButtonClass}>
                            Back
                        </button>
                    )}
                    {step === 0 && (
                        <button
                            type="button"
                            disabled={picked.length === 0}
                            onClick={startPlans}
                            className={solidButtonClass}
                        >
                            Continue with {picked.length} subjects
                        </button>
                    )}
                    {step === 1 && (
                        <button type="button" onClick={() => setStep(2)} className={solidButtonClass}>
                            Continue to review
                        </button>
                    )}
                    {step === 2 && (
                        <button type="button" disabled={creating} onClick={createAll} className={solidButtonClass}>
                            Create {picked.length} subjects
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default withAppShell(Templates);
