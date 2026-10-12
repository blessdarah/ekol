import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import {
    bulkStore,
    index,
} from '@/actions/App/Http/Controllers/SeriesRegistrationController';
import {
    SeriesChips,
    SeriesHeader,
    choiceProblem,
    coreOf,
    limits,
    poolOf,
    type SeriesOption,
} from '../../components/series/ui';
import {
    ErrorText,
    LockIcon,
    capsLabelClass,
    outlineButtonClass,
} from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface BulkStudent {
    id: string;
    name: string;
    matricule: string;
    class_id: string;
    class: string;
}

interface BulkProps {
    yearLabel: string | null;
    hasTerm: boolean;
    level: { id: string; name: string };
    students: BulkStudent[];
    series: SeriesOption[];
    staffed: string[];
}

function RegisterMany({ yearLabel, hasTerm, level, students, series, staffed }: BulkProps) {
    const [classId, setClassId] = useState('');
    const [selected, setSelected] = useState<string[]>([]);
    const [seriesId, setSeriesId] = useState('');
    const [electives, setElectives] = useState<string[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const classes = [...new Map(students.map((student) => [student.class_id, student.class])).entries()]
        .map(([id, name]) => ({
            id,
            name,
            count: students.filter((student) => student.class_id === id).length,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    const shown = classId ? students.filter((student) => student.class_id === classId) : students;
    const shownIds = shown.map((student) => student.id);
    const allShown = shownIds.length > 0 && shownIds.every((id) => selected.includes(id));
    const someShown = shownIds.some((id) => selected.includes(id));
    const chosen = series.find((option) => option.id === seriesId);
    const problem = chosen ? choiceProblem(chosen, electives.length) : null;
    const total = chosen ? coreOf(chosen).length + electives.length : 0;
    const left = students.length - selected.length;

    function toggleStudent(id: string) {
        setSelected(
            selected.includes(id) ? selected.filter((other) => other !== id) : [...selected, id],
        );
    }

    function toggleAll() {
        setSelected(
            allShown
                ? selected.filter((id) => !shownIds.includes(id))
                : [...new Set([...selected, ...shownIds])],
        );
    }

    function chooseSeries(id: string) {
        const next = series.find((option) => option.id === id);
        const allowed = next ? poolOf(next).map((subject) => subject.id) : [];

        setSeriesId(id);
        setElectives(electives.filter((subject) => allowed.includes(subject)));
    }

    function submit() {
        setSaving(true);
        router.post(
            bulkStore.url(),
            { student_ids: selected, series_id: seriesId, electives },
            {
                onError: (failed) => setErrors(failed),
                onFinish: () => setSaving(false),
            },
        );
    }

    const pillClass = (on: boolean) =>
        `flex h-[30px] items-center rounded-full border border-solid px-3 text-[13px] leading-4 ${
            on
                ? 'border-primary bg-primary-tint font-semibold text-primary'
                : 'border-border font-medium text-text hover:bg-surface'
        }`;

    return (
        <div className="flex lg:min-h-[calc(100vh-56px)] flex-col gap-6">
            <Head title={t('Register many at once')} />
            <SeriesHeader
                trail={[{ label: t('Register many at once') }]}
                title={t('Register many at once')}
                meta={t('Give the same series and electives to a group of students. :level:year_label', { level: level.name, year_label: yearLabel ? ` · ${yearLabel}` : '' })}
                action={
                    <Link href={index.url({ query: { level: level.id } })} className={outlineButtonClass}>
                        {t('← Back to overview')}
                    </Link>
                }
            />

            {students.length === 0 ? (
                <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                    {t('Every :level student already has a series.', { level: level.name })}
                </p>
            ) : (
                <div className="flex flex-1 flex-col gap-7 lg:flex-row">
                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    aria-pressed={classId === ''}
                                    onClick={() => setClassId('')}
                                    className={pillClass(classId === '')}
                                >
                                    {t('All without a series · :students', { students: students.length })}
                                </button>
                                {classes.map((option) => (
                                    <button
                                        key={option.id}
                                        type="button"
                                        aria-pressed={classId === option.id}
                                        onClick={() => setClassId(option.id)}
                                        className={pillClass(classId === option.id)}
                                    >
                                        {option.name} · {option.count}
                                    </button>
                                ))}
                            </div>
                            <span aria-live="polite" className="text-[13px] leading-4 text-text-muted">
                                {t(':selected selected', { selected: selected.length })}
                            </span>
                        </div>
                        <div className="flex flex-col overflow-clip rounded-lg border border-solid border-border">
                            <label className="flex h-[34px] shrink-0 cursor-pointer items-center gap-3 border-b border-solid border-border bg-surface px-[14px] text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase">
                                <input
                                    type="checkbox"
                                    aria-label={t('Select every student shown')}
                                    checked={allShown}
                                    ref={(input) => {
                                        if (input) {
                                            input.indeterminate = someShown && !allShown;
                                        }
                                    }}
                                    onChange={toggleAll}
                                    className="h-[18px] w-[18px] shrink-0 accent-primary"
                                />
                                <span className="flex-1">{t('Student')}</span>
                                <span className="w-[90px] shrink-0">{t('Class')}</span>
                                <span className="w-[110px] shrink-0">{t('Matricule')}</span>
                            </label>
                            {shown.map((student, position) => {
                                const on = selected.includes(student.id);

                                return (
                                    <label
                                        key={student.id}
                                        className={`flex h-10 shrink-0 cursor-pointer items-center gap-3 border-b border-solid border-border px-[14px] last:border-b-0 ${
                                            on ? 'bg-primary-tint' : position % 2 === 1 ? 'bg-row-alt' : ''
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={on}
                                            onChange={() => toggleStudent(student.id)}
                                            className="h-[18px] w-[18px] shrink-0 accent-primary"
                                        />
                                        <span className="min-w-0 flex-1 truncate text-[14px] leading-[18px] font-medium text-text">
                                            {student.name}
                                        </span>
                                        <span className="w-[90px] shrink-0 truncate text-[13px] leading-4 text-text">
                                            {student.class}
                                        </span>
                                        <span className="w-[110px] shrink-0 font-mono text-[12px] leading-4 text-text-muted">
                                            {student.matricule}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                        <p className="text-[13px] leading-[19px] text-text-muted">
                            {t('Tick the students who take the same series and electives. Anyone who needs something different is registered one by one.')}
                        </p>
                    </div>

                    <aside className="flex shrink-0 flex-col gap-[14px] self-start rounded-lg border border-solid border-border bg-surface p-[18px] lg:w-[380px]">
                        <p className={capsLabelClass}>
                            {t('Register the')} {selected.length} {t('selected')}{' '}
                            {selected.length === 1 ? t('student') : t('students')}
                        </p>
                        <div className="flex flex-col gap-2">
                            <span className="text-[13px] leading-4 font-medium text-text">{t('Series')}</span>
                            {series.length === 0 ? (
                                <span className="text-[13px] leading-[19px] text-warning">
                                    {t(':level has no series yet.', { level: level.name })}
                                </span>
                            ) : (
                                <SeriesChips series={series} value={seriesId} size="small" onChange={chooseSeries} />
                            )}
                            <ErrorText message={errors.series_id} />
                        </div>
                        {chosen && (
                            <div className="flex flex-col gap-[6px]">
                                <div className="flex items-baseline justify-between">
                                    <span className="text-[13px] leading-4 font-medium text-text">
                                        {t('Subjects in :code', { code: chosen.code })}
                                    </span>
                                    <span className="font-mono text-[12px] leading-4 text-text-muted">
                                        {limits(chosen, true)} · {total}
                                        {chosen.max !== null ? ` / ${chosen.max}` : ''}
                                    </span>
                                </div>
                                <ul className="flex flex-col overflow-clip rounded-md border border-solid border-border bg-white">
                                    {coreOf(chosen).map((subject) => (
                                        <li
                                            key={subject.id}
                                            className="flex h-[34px] shrink-0 items-center gap-[10px] border-b border-solid border-border px-3 last:border-b-0"
                                        >
                                            <LockIcon />
                                            <span className="min-w-0 flex-1 truncate text-[13px] leading-4 text-text">
                                                {subject.name}
                                            </span>
                                            <span className="text-[11px] leading-[14px] font-semibold text-text-muted">
                                                {t('CORE')}
                                            </span>
                                        </li>
                                    ))}
                                    {poolOf(chosen).map((subject) => (
                                        <li key={subject.id} className="border-b border-solid border-border last:border-b-0">
                                            <label className="flex h-[34px] cursor-pointer items-center gap-[10px] px-3">
                                                <input
                                                    type="checkbox"
                                                    checked={electives.includes(subject.id)}
                                                    onChange={() =>
                                                        setElectives(
                                                            electives.includes(subject.id)
                                                                ? electives.filter((id) => id !== subject.id)
                                                                : [...electives, subject.id],
                                                        )
                                                    }
                                                    className="size-4 shrink-0 accent-primary"
                                                />
                                                <span className="min-w-0 flex-1 truncate text-[13px] leading-4 text-text">
                                                    {subject.name}
                                                </span>
                                                {!staffed.includes(subject.id) && (
                                                    <span className="text-[12px] leading-4 text-[#8A5A12]">
                                                        {t('no teacher')}
                                                    </span>
                                                )}
                                            </label>
                                        </li>
                                    ))}
                                </ul>
                                {problem && (
                                    <span className="text-[12px] leading-4 text-[#8A5A12]">{problem}</span>
                                )}
                                <ErrorText message={errors.electives} />
                            </div>
                        )}
                        <div className="flex flex-col gap-2">
                            <button
                                type="button"
                                disabled={!chosen || !!problem || selected.length === 0 || saving || !hasTerm}
                                onClick={submit}
                                className="flex h-10 shrink-0 items-center justify-center rounded-md bg-primary text-[14px] leading-[18px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
                            >
                                {t('Register')} {selected.length}{' '}
                                {selected.length === 1 ? t('student') : t('students')}
                                {chosen ? t(' in :code', { code: chosen.code }) : ''}
                            </button>
                            <ErrorText message={errors.student_ids} />
                            <p className="text-[12px] leading-[17px] text-text-muted">
                                {hasTerm
                                    ? t('They leave the unregistered list. If you go back, the overview shows :left still without a series.', { left })
                                    : t('No term is active, so nothing can be saved. Make a term active in School Setup.')}
                            </p>
                        </div>
                    </aside>
                </div>
            )}
        </div>
    );
}

export default withAppShell(RegisterMany);
