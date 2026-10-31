import { Link, router } from '@inertiajs/react';
import {
    progress,
    window as moveWindow,
} from '@/actions/App/Http/Controllers/AssessmentProgressController';
import { show as schedule } from '@/actions/App/Http/Controllers/ExamScheduleController';
import { amberText, primaryClass, quietClass } from '../ui';
import { ErrorText, Toggle } from '../../structure/ui';
import { t } from '../../../lib/i18n';
import { type MarksProgressModel, Tick, STEPS } from './model';
export function MarksWindow({
    plans,
    plan,
    termEnds,
    stats,
    classes,
    errors,
    view,
    setView,
    onlyMissing,
    setOnlyMissing,
    extending,
    setExtending,
    until,
    setUntil,
    reached,
    left,
    waiting,
    shownClasses,
    bar,
    deadline,
}: Pick<
    MarksProgressModel,
    | 'plans'
    | 'plan'
    | 'termEnds'
    | 'stats'
    | 'classes'
    | 'errors'
    | 'view'
    | 'setView'
    | 'onlyMissing'
    | 'setOnlyMissing'
    | 'extending'
    | 'setExtending'
    | 'until'
    | 'setUntil'
    | 'reached'
    | 'left'
    | 'waiting'
    | 'shownClasses'
    | 'bar'
    | 'deadline'
>) {
    return (
        <div className="-mt-2 flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-b border-solid border-border pb-5">
                <nav
                    aria-label={t('Assessment')}
                    className="flex flex-wrap gap-1 rounded-[10px] bg-surface p-[3px] text-[13px] leading-4"
                >
                    {plans.map((option) => {
                        const current = option.id === plan.id;

                        return (
                            <Link
                                key={option.id}
                                href={progress.url({
                                    query: { plan: option.id },
                                })}
                                aria-current={current ? 'page' : undefined}
                                preserveScroll
                                className={`flex h-[30px] items-center gap-[6px] rounded-[7px] px-3 ${
                                    current
                                        ? 'bg-white font-semibold text-text shadow-[0_1px_2px_color-mix(in_srgb,var(--color-text)_12%,transparent)]'
                                        : 'text-text-muted hover:text-text'
                                }`}
                            >
                                {option.state === 'marks_open' && (
                                    <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-success" />
                                )}
                                {option.name}
                                {option.state === 'published' && (
                                    <span
                                        className="text-success"
                                        aria-label={t('Published')}
                                    >
                                        ✓
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </nav>
                <ol className="flex flex-wrap items-center gap-x-[18px] gap-y-2 text-[13px] leading-4">
                    {plan.kind === 'exam' && (
                        <li>
                            <Link
                                href={schedule.url({
                                    query: { plan: plan.id },
                                })}
                                className={`flex items-center gap-[6px] hover:underline ${plan.has_schedule ? 'text-text-muted' : `font-semibold ${amberText}`}`}
                            >
                                {plan.has_schedule && <Tick />}
                                {plan.has_schedule
                                    ? t('Exam schedule')
                                    : t('Set the exam schedule →')}
                            </Link>
                        </li>
                    )}
                    {STEPS.map((step, position) => {
                        const done =
                            position < reached || plan.state === 'published';
                        const now =
                            position === reached && plan.state !== 'published';

                        return (
                            <li
                                key={step.key}
                                aria-current={now ? 'step' : undefined}
                                className={`flex items-center gap-[6px] ${now ? 'font-semibold text-text' : 'text-text-muted'}`}
                            >
                                {now ? (
                                    <span className="h-[7px] w-[7px] rounded-full bg-primary" />
                                ) : (
                                    done && <Tick />
                                )}
                                {t(step.label)}
                            </li>
                        );
                    })}
                </ol>
            </div>

            {extending && (
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        router.post(
                            moveWindow.url(plan.id),
                            { window_ends_on: until },
                            {
                                preserveScroll: true,
                                onSuccess: () => setExtending(false),
                            },
                        );
                    }}
                    className="mt-5 flex flex-wrap items-end gap-3 rounded-lg border border-solid border-border bg-surface p-4"
                >
                    <label className="flex flex-col gap-[6px] text-[13px] leading-4 font-medium text-text">
                        {t('Marks close on')}
                        <input
                            type="date"
                            value={until}
                            max={termEnds ?? undefined}
                            onChange={(e) => setUntil(e.target.value)}
                            className="h-9 rounded-md border border-solid border-border bg-white px-3 font-mono text-[13px] font-normal text-text outline-none focus:border-primary"
                        />
                    </label>
                    <button
                        type="submit"
                        disabled={!until}
                        className={primaryClass}
                    >
                        {t('Save the new date')}
                    </button>
                    <button
                        type="button"
                        onClick={() => setExtending(false)}
                        className={quietClass}
                    >
                        {t('Cancel')}
                    </button>
                    <p className="basis-full text-[13px] leading-[18px] text-text-muted">
                        {plan.state === 'marks_closed'
                            ? t(
                                  'Saving reopens marks entry for teachers until this day.',
                              )
                            : t(
                                  'Teachers can enter marks until the end of this day.',
                              )}
                    </p>
                    <ErrorText message={errors.window_ends_on} />
                </form>
            )}

            <div className="flex flex-wrap items-end gap-x-14 gap-y-5 pt-8 pb-7">
                <div className="flex w-[260px] shrink-0 flex-col gap-1">
                    <p className="font-display text-[56px] leading-[56px] font-extrabold tracking-[-0.03em] text-text">
                        {stats.submitted}
                        <span className="font-light text-text-muted">
                            {' '}
                            / {stats.total}
                        </span>
                    </p>
                    <p className="text-[14px] leading-5 text-text-muted">
                        {t('mark sheets handed in')}
                    </p>
                </div>
                <div className="flex min-w-[280px] flex-1 flex-col gap-[14px]">
                    <div className="flex h-3 gap-[3px]" aria-hidden>
                        {bar.length === 0 ? (
                            <span className="h-3 flex-1 rounded-full bg-border" />
                        ) : (
                            bar.map((part, position) => (
                                <span
                                    key={part.tone}
                                    className={`h-3 ${part.tone} ${position === 0 ? 'rounded-l-full' : 'rounded-l-[2px]'} ${position === bar.length - 1 ? 'rounded-r-full' : 'rounded-r-[2px]'}`}
                                    style={{ flexGrow: part.count }}
                                />
                            ))
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] leading-4 text-text">
                        <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-success" />
                            {t('Handed in')}
                            <span className="font-mono text-text-muted">
                                {stats.submitted}
                            </span>
                        </span>
                        {waiting > 0 && (
                            <span className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-warning" />
                                {t('Missing, from :count :teachers', {
                                    count: stats.teachers,
                                    teachers:
                                        stats.teachers === 1
                                            ? t('teacher')
                                            : t('teachers'),
                                })}
                                <span className="font-mono text-text-muted">
                                    {waiting}
                                </span>
                            </span>
                        )}
                        {stats.unstaffed > 0 && (
                            <span className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-text-disabled" />
                                {t('No teacher')}
                                <span className="font-mono text-text-muted">
                                    {stats.unstaffed}
                                </span>
                            </span>
                        )}
                        <span className="flex-1" />
                        <span className="flex items-center gap-[6px] text-text-muted">
                            {deadline}
                            {plan.state === 'marks_open' &&
                                plan.days_left !== null && (
                                    <span
                                        className={`font-semibold ${plan.days_left < 0 ? 'text-danger' : plan.days_left <= 3 ? amberText : 'text-text-muted'}`}
                                    >
                                        ·{' '}
                                        {plan.days_left < 0
                                            ? t('ended')
                                            : plan.days_left === 0
                                              ? t('today')
                                              : t('in :days_left :days', {
                                                    days_left: plan.days_left,
                                                    days:
                                                        plan.days_left === 1
                                                            ? t('day')
                                                            : t('days'),
                                                })}
                                    </span>
                                )}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <div className="flex rounded-[9px] bg-surface p-[3px] text-[13px] leading-4">
                    {(
                        [
                            { key: 'class', label: t('By class') },
                            { key: 'teacher', label: t('By teacher') },
                        ] as const
                    ).map((option) => (
                        <button
                            key={option.key}
                            type="button"
                            aria-pressed={view === option.key}
                            onClick={() => setView(option.key)}
                            className={`flex h-[30px] items-center rounded-[7px] px-[14px] ${
                                view === option.key
                                    ? 'bg-white font-semibold text-text shadow-[0_1px_2px_color-mix(in_srgb,var(--color-text)_12%,transparent)]'
                                    : 'text-text-muted hover:text-text'
                            }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                {view === 'class' ? (
                    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-text">
                        <Toggle
                            label={t('Only classes with sheets missing')}
                            checked={onlyMissing}
                            onChange={setOnlyMissing}
                        />
                        {t('Only classes with sheets missing')}
                    </label>
                ) : (
                    <span className="text-[13px] text-text-muted">
                        {t('Who still owes sheets, most first')}
                    </span>
                )}
                <span className="flex-1" />
                <span className="text-[13px] text-text-muted">
                    {view === 'class'
                        ? t(':shown of :all classes', {
                              shown: shownClasses.length,
                              all: classes.length,
                          })
                        : t(':teachers · :sheets', {
                              teachers: t(':count teachers', {
                                  count: stats.teachers,
                              }),
                              sheets: t(':count sheets', { count: left }),
                          })}
                </span>
            </div>
        </div>
    );
}
