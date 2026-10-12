import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { index } from '@/actions/App/Http/Controllers/AssessmentController';
import {
    destroy,
    publish,
    save,
    show,
} from '@/actions/App/Http/Controllers/ExamScheduleController';
import {
    AssessmentHeader,
    type AssessmentTabs,
    Empty,
    PlanPicker,
    type PlanSummary,
    amberText,
    day,
    linkClass,
    primaryClass,
    quietClass,
    range,
} from '../../components/assessments/ui';
import { ErrorText, capsLabelClass, fieldLabelClass } from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface Paper {
    id: string;
    held_on: string;
    starts_at: string;
    hours: number;
    room_id: string | null;
    room: string | null;
    invigilator_ids: string[];
    invigilators: string[];
    clash: boolean;
}

interface Row {
    subject_id: string;
    subject: string;
    paper: Paper | null;
}

interface ScheduleProps {
    tabs: AssessmentTabs;
    plans: PlanSummary[];
    plan: PlanSummary | null;
    levels?: { id: string; name: string; missing: number; clash: boolean }[];
    level?: { id: string; name: string } | null;
    rows?: Row[];
    rooms?: { id: string; code: string; capacity: number }[];
    staff?: { id: string; name: string }[];
    clashes?: string[];
    unset?: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const inputClass = 'h-9 w-full rounded-md border border-solid border-border bg-white px-[10px] text-[13px] leading-4 text-text outline-none focus:border-primary';

function weekday(iso: string): string {
    return `${t(WEEKDAYS[new Date(`${iso}T12:00:00`).getDay()])} ${day(iso)}`;
}

function PaperForm({
    plan,
    levelId,
    row,
    rooms,
    staff,
    onClose,
}: {
    plan: PlanSummary;
    levelId: string;
    row: Row;
    rooms: NonNullable<ScheduleProps['rooms']>;
    staff: NonNullable<ScheduleProps['staff']>;
    onClose: () => void;
}) {
    const form = useForm({
        level_id: levelId,
        subject_id: row.subject_id,
        held_on: row.paper?.held_on ?? plan.held_from ?? '',
        starts_at: row.paper?.starts_at ?? '08:00',
        hours: String(row.paper?.hours ?? 2),
        room_id: row.paper?.room_id ?? '',
        invigilator_ids: row.paper?.invigilator_ids ?? ([] as string[]),
    });
    const { data, setData } = form;
    const errors = form.errors as Record<string, string | undefined>;
    const left = staff.filter((member) => !data.invigilator_ids.includes(member.id));

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                form.transform((values) => ({ ...values, hours: Number(values.hours), room_id: values.room_id || null }));
                form.post(save.url(plan.id), { preserveScroll: true, onSuccess: onClose });
            }}
            className="flex flex-col gap-3 rounded-lg border border-solid border-primary bg-white p-4"
        >
            <p className="text-[14px] leading-[18px] font-semibold text-text">{row.subject}</p>
            <div className="flex gap-2">
                <label className={`flex min-w-0 flex-[1.5] flex-col gap-[6px] ${fieldLabelClass}`}>
                    {t('Day')}
                    <input
                        type="date"
                        value={data.held_on}
                        min={plan.held_from ?? undefined}
                        max={plan.held_until ?? undefined}
                        onChange={(e) => setData('held_on', e.target.value)}
                        className={`${inputClass} font-mono`}
                    />
                </label>
                <label className={`flex min-w-0 flex-1 flex-col gap-[6px] ${fieldLabelClass}`}>
                    {t('Time')}
                    <input type="time" value={data.starts_at} onChange={(e) => setData('starts_at', e.target.value)} className={`${inputClass} font-mono`} />
                </label>
            </div>
            <div className="flex gap-2">
                <label className={`flex w-[84px] shrink-0 flex-col gap-[6px] ${fieldLabelClass}`}>
                    {t('Hours')}
                    <input
                        type="number"
                        min={0.5}
                        max={6}
                        step={0.5}
                        value={data.hours}
                        onChange={(e) => setData('hours', e.target.value)}
                        className={`${inputClass} font-mono`}
                    />
                </label>
                <label className={`flex min-w-0 flex-1 flex-col gap-[6px] ${fieldLabelClass}`}>
                    {t('Room')}
                    <select value={data.room_id} onChange={(e) => setData('room_id', e.target.value)} className={inputClass}>
                        <option value="">{t('Not set')}</option>
                        {rooms.map((room) => (
                            <option key={room.id} value={room.id}>
                                {t(':code · :capacity seats', { code: room.code, capacity: room.capacity })}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            <div className="flex flex-col gap-[6px]">
                <span className={fieldLabelClass}>{t('Invigilators')}</span>
                <div className="flex flex-wrap gap-[6px]">
                    {data.invigilator_ids.map((id) => (
                        <button
                            key={id}
                            type="button"
                            title={t('Remove')}
                            onClick={() => setData('invigilator_ids', data.invigilator_ids.filter((item) => item !== id))}
                            className="flex h-6 items-center gap-1 rounded-sm bg-primary-tint px-2 text-[12px] leading-4 font-medium text-primary hover:bg-surface"
                        >
                            {staff.find((member) => member.id === id)?.name} ×
                        </button>
                    ))}
                    {data.invigilator_ids.length === 0 && <span className="text-[13px] leading-6 text-text-muted">{t('None yet')}</span>}
                </div>
                {left.length > 0 && (
                    <select
                        aria-label={t('Add an invigilator')}
                        value=""
                        onChange={(e) => e.target.value && setData('invigilator_ids', [...data.invigilator_ids, e.target.value])}
                        className={inputClass}
                    >
                        <option value="">{t('Add an invigilator…')}</option>
                        {left.map((member) => (
                            <option key={member.id} value={member.id}>
                                {member.name}
                            </option>
                        ))}
                    </select>
                )}
            </div>
            <ErrorText message={Object.values(errors).find(Boolean)} />
            <div className="flex flex-wrap items-center gap-3">
                <button type="submit" disabled={form.processing || !data.held_on} className={primaryClass}>
                    {t('Save paper')}
                </button>
                <button type="button" onClick={onClose} className="text-[13px] leading-4 font-medium text-text-muted hover:underline">
                    {t('Cancel')}
                </button>
                {row.paper && (
                    <button
                        type="button"
                        onClick={() => router.delete(destroy.url({ plan: plan.id, paper: row.paper?.id ?? '' }), { preserveScroll: true, onSuccess: onClose })}
                        className="ml-auto text-[13px] leading-4 font-medium text-danger hover:underline"
                    >
                        {t('Remove paper')}
                    </button>
                )}
            </div>
        </form>
    );
}

function Schedule({ tabs, plans, plan, levels = [], level, rows = [], rooms = [], staff = [], clashes = [], unset = 0 }: ScheduleProps) {
    const errors = usePage().props.errors as Record<string, string | undefined>;
    const [editing, setEditing] = useState<string | null>(null);

    if (!plan || !level) {
        return (
            <div className="flex flex-col gap-5">
                <Head title={t('Exam schedule')} />
                <AssessmentHeader active="schedule" tabs={tabs} trail={[{ label: t('Exam schedule') }]} title={t('Exam schedule')} />
                <Empty title={t('No exam is scheduled yet')}>
                    {t('An exam gets its timetable here once it is scheduled on the calendar.')}{' '}
                    <Link href={index.url()} className="font-medium text-primary hover:underline">
                        {t('Open the calendar →')}
                    </Link>
                </Empty>
            </div>
        );
    }

    const current = rows.find((row) => row.subject_id === editing);
    const ready = unset === 0 && clashes.length === 0 && rows.length > 0;
    const locked = plan.state === 'published';

    return (
        <div className="flex lg:min-h-[calc(100vh-56px)] flex-col gap-5">
            <Head title={t('Exam schedule')} />
            <AssessmentHeader
                active="schedule"
                tabs={tabs}
                trail={[{ label: t('Exam schedule') }]}
                title={t('Exam schedule')}
                meta={
                    <>
                        <span className="font-mono uppercase">
                            {plan.name} · {range(plan.held_from, plan.held_until)}
                        </span>
                        <span>{t('· one paper per subject and level')}</span>
                    </>
                }
            />

            {plans.length > 1 && <PlanPicker plans={plans} current={plan.id} href={(id) => show.url({ query: { plan: id } })} label={t('Exam')} />}

            <p className="rounded-lg bg-surface p-4 text-[13px] leading-[19px] text-text-muted">
                {plan.has_schedule
                    ? t('This schedule is published. Marks open on :window_starts_on and you follow them in Marks progress.', { window_starts_on: day(plan.window_starts_on) })
                    : t('Give every subject its paper, then publish. Marks then open on :window_starts_on and you follow them in Marks progress.', { window_starts_on: day(plan.window_starts_on) })}
            </p>

            <div className="flex flex-1 flex-col gap-7 lg:flex-row">
                <div className="flex min-w-0 flex-1 flex-col gap-4">
                    <div className="flex flex-wrap gap-2">
                        {levels.map((option) => (
                            <Link
                                key={option.id}
                                href={show.url({ query: { plan: plan.id, level: option.id } })}
                                preserveScroll
                                aria-current={option.id === level.id ? 'true' : undefined}
                                className={`flex h-[30px] items-center gap-[6px] rounded-full border border-solid px-3 text-[13px] leading-4 ${
                                    option.id === level.id
                                        ? 'border-primary bg-primary-tint font-semibold text-primary'
                                        : 'border-border font-medium text-text hover:bg-surface'
                                }`}
                            >
                                {(option.clash || option.missing > 0) && <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-warning" />}
                                {option.name}
                            </Link>
                        ))}
                    </div>

                    {rows.length === 0 ? (
                        <Empty title={t(':level takes no subjects yet', { level: level.name })}>{t('A paper is set for each subject the level’s classes take.')}</Empty>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-solid border-border">
                            <div className="flex min-w-[680px] flex-col">
                                <div className={`flex h-8 items-center gap-4 border-b border-solid border-border bg-surface px-[14px] ${capsLabelClass}`}>
                                    <span className="w-[96px] shrink-0">{t('Day')}</span>
                                    <span className="w-[50px] shrink-0">{t('Time')}</span>
                                    <span className="flex-1">{t('Subject')}</span>
                                    <span className="w-9 shrink-0">{t('Hrs')}</span>
                                    <span className="w-[90px] shrink-0">{t('Room')}</span>
                                    <span className="w-[190px] shrink-0">{t('Invigilators')}</span>
                                </div>
                                {rows.map((row, position) => (
                                    <button
                                        key={row.subject_id}
                                        type="button"
                                        disabled={locked}
                                        onClick={() => setEditing(row.subject_id)}
                                        className={`flex min-h-10 items-center gap-4 border-b border-solid border-border px-[14px] py-[6px] text-left last:border-b-0 enabled:hover:bg-surface ${
                                            row.paper?.clash ? 'bg-warning-tint' : editing === row.subject_id ? 'bg-primary-tint' : position % 2 === 1 ? 'bg-row-alt' : ''
                                        }`}
                                    >
                                        <span className="w-[96px] shrink-0 font-mono text-[13px] leading-4 text-text">{row.paper ? weekday(row.paper.held_on) : '—'}</span>
                                        <span className="w-[50px] shrink-0 font-mono text-[13px] leading-4 text-text">{row.paper?.starts_at ?? '—'}</span>
                                        <span className={`min-w-0 flex-1 truncate text-[14px] leading-[18px] font-medium ${row.paper ? 'text-text' : 'text-text-muted'}`}>
                                            {row.subject}
                                        </span>
                                        <span className="w-9 shrink-0 font-mono text-[13px] leading-4 text-text">{row.paper?.hours ?? ''}</span>
                                        <span className={`w-[90px] shrink-0 truncate text-[13px] leading-4 ${row.paper?.clash ? `font-semibold ${amberText}` : 'text-text'}`}>
                                            {row.paper ? (row.paper.room ?? t('Not set')) : ''}
                                        </span>
                                        <span className={`w-[190px] shrink-0 truncate text-[13px] leading-4 ${row.paper ? 'text-text' : `font-medium ${amberText}`}`}>
                                            {row.paper ? row.paper.invigilators.join(' · ') || t('None yet') : t('No paper yet · set it')}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <p className="text-[13px] leading-[19px] text-text-muted">
                        {t('A paper is for every student of the level who takes the subject.')}{locked ? '' : t(' Pick a row to set or change its paper.')}
                    </p>
                </div>

                <aside className="flex shrink-0 flex-col gap-4 border-solid border-border lg:w-[320px] lg:border-l lg:pl-7">
                    {current && !locked && (
                        <PaperForm key={`${level.id}-${current.subject_id}`} plan={plan} levelId={level.id} row={current} rooms={rooms} staff={staff} onClose={() => setEditing(null)} />
                    )}
                    <div className="flex flex-col gap-3 rounded-lg border border-solid border-border bg-surface p-4">
                        <p className={capsLabelClass}>{plan.has_schedule ? t('Published') : t('Before you publish')}</p>
                        <ul className="flex flex-col gap-[10px]">
                            <li className="flex items-start gap-2 text-[13px] leading-[18px] text-text">
                                <span className={`mt-[6px] h-[6px] w-[6px] shrink-0 rounded-full ${unset === 0 ? 'bg-success' : 'bg-warning'}`} />
                                {unset === 0 ? t('Every subject has a paper') : t(':unset :have no paper yet', { unset, have: unset === 1 ? 'subject has' : 'subjects have' })}
                            </li>
                            {clashes.length === 0 ? (
                                <li className="flex items-start gap-2 text-[13px] leading-[18px] text-text">
                                    <span className="mt-[6px] h-[6px] w-[6px] shrink-0 rounded-full bg-success" />
                                    {t('No room or invigilator is in two places at once')}
                                </li>
                            ) : (
                                clashes.map((clash) => (
                                    <li key={clash} className="flex items-start gap-2 text-[13px] leading-[18px] text-text">
                                        <span className="mt-[6px] h-[6px] w-[6px] shrink-0 rounded-full bg-warning" />
                                        {clash}
                                    </li>
                                ))
                            )}
                        </ul>
                        {!locked && (
                            <button
                                type="button"
                                disabled={!ready}
                                onClick={() => router.post(publish.url(plan.id))}
                                className="flex h-10 items-center justify-center rounded-md bg-primary text-[14px] leading-[18px] font-semibold text-white hover:bg-primary-hover disabled:opacity-40"
                            >
                                {plan.has_schedule ? t('Publish again') : t('Publish exam schedule')}
                            </button>
                        )}
                        <ErrorText message={errors.publish} />
                        <Link href={index.url()} className={quietClass}>
                            {t('← Back to the calendar')}
                        </Link>
                    </div>
                    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-4">
                        <p className="text-[13px] leading-4 font-semibold text-text">{t('After publishing')}</p>
                        <p className="text-[13px] leading-[19px] text-text-muted">
                            {t('The Calendar shows :plan as scheduled with a timetable. Nobody is told automatically; share the papers with students and invigilators yourself.', { plan: plan.name })}
                        </p>
                        <button type="button" onClick={() => window.print()} className={`self-start ${linkClass}`}>
                            {t('Print this level’s papers')}
                        </button>
                    </div>
                </aside>
            </div>
        </div>
    );
}

export default withAppShell(Schedule);
