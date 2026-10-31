import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { index } from '@/actions/App/Http/Controllers/SchemeController';
import { review } from '@/actions/App/Http/Controllers/SchemeReviewController';
import { dayMonth } from '../../components/fees/ui';
import {
    SchemesHeader,
    StatusPill,
    StepBar,
    itemLabel,
    type Item,
    type Steps,
    type Week,
} from '../../components/schemes/ui';
import {
    capsLabelClass,
    outlineButtonClass,
    solidButtonClass,
} from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface ShowProps {
    steps: Steps;
    scheme: {
        id: string;
        subject: string | null;
        class: string | null;
        teacher: string | null;
        status: string;
        topics: number;
        weekly_periods: number;
        submitted_at: string | null;
        approved_at: string | null;
    };
    weeks: Week[];
    items: Item[];
    checks: {
        syllabus: number;
        placed: number;
        missing: string[];
        periods: number;
        available: number;
        weekly: number;
        in_free_weeks: string[];
        added: number;
    };
    history: {
        on: string;
        action: string;
        by: string | null;
        note: string | null;
    }[];
    canReview: boolean;
    nextId: string | null;
}

const ACTIONS: Record<string, string> = {
    opened: 'opened',
    submitted: 'submitted',
    approved: 'approved',
    changes_requested: 'sent back for changes',
    reopened: 'changed after approval',
    note: 'note',
    closed: 'closed with the term',
};

function Check({ ok, children }: { ok: boolean; children: string }) {
    return (
        <li className="flex gap-2 text-[13px] leading-[19px] text-text">
            <span
                className={`mt-[6px] h-[7px] w-[7px] shrink-0 rounded-full ${ok ? 'bg-success' : 'bg-warning'}`}
            />
            {children}
        </li>
    );
}

function ShowScheme({
    steps,
    scheme,
    weeks,
    items,
    checks,
    history,
    canReview,
}: ShowProps) {
    const [noteText, setNoteText] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const unplaced = items.filter((item) => item.week === null);
    const placedWeeks = new Set(items.map((item) => item.week));

    function decide(decision: 'approve' | 'changes') {
        router.post(
            review.url(scheme.id),
            { decision, note: noteText },
            {
                onStart: () => setBusy(true),
                onFinish: () => setBusy(false),
                onError: (failed) => setErrors(failed),
            },
        );
    }

    return (
        <div className="flex flex-col gap-7">
            <Head title={`${scheme.subject} · ${scheme.class}`} />
            <SchemesHeader
                trail={[{ label: `${scheme.subject} · ${scheme.class}` }]}
                title={`${scheme.subject} · ${scheme.class}`}
                badge={<StatusPill status={scheme.status} />}
                tag={t('Schemes:term_label', {
                    term_label: steps.term ? ` · ${t(steps.term.label)}` : '',
                })}
                meta={[
                    scheme.teacher ?? t('No teacher yet'),
                    scheme.submitted_at
                        ? t('submitted :date', {
                              date: dayMonth(scheme.submitted_at, false),
                          })
                        : null,
                    t(':count sub-topics over :weeks weeks', {
                        count: items.length,
                        weeks: weeks.length,
                    }),
                ]
                    .filter(Boolean)
                    .join(' · ')}
                action={
                    <Link href={index.url()} className={outlineButtonClass}>
                        {t('← Back to schemes')}
                    </Link>
                }
            />
            <StepBar steps={steps} active="review" />

            <div className="flex flex-col gap-6 xl:flex-row">
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                    <div className="overflow-x-auto rounded-lg border border-solid border-border">
                        <div className="flex min-w-[600px] flex-col">
                            <div
                                className={`flex h-9 items-center gap-4 border-b border-solid border-border bg-surface px-4 ${capsLabelClass}`}
                            >
                                <span className="w-12 shrink-0">
                                    {t('Week')}
                                </span>
                                <span className="flex-1">{t('Topic')}</span>
                                <span className="w-[150px] shrink-0">
                                    {t('From the syllabus')}
                                </span>
                                <span className="w-[60px] shrink-0 text-right">
                                    {t('Periods')}
                                </span>
                            </div>
                            {weeks.map((week) => {
                                const rows = items.filter(
                                    (item) => item.week === week.week,
                                );

                                if (week.free && rows.length === 0) {
                                    return (
                                        <div
                                            key={week.week}
                                            className="flex h-9 items-center gap-4 border-b border-solid border-border bg-surface px-4 text-[12px] font-semibold tracking-[0.04em] text-text-muted uppercase"
                                        >
                                            <span className="w-12 shrink-0 font-mono normal-case">
                                                W{week.week}
                                            </span>
                                            {t(
                                                ':name · kept free of new topics',
                                                { name: week.free },
                                            )}
                                        </div>
                                    );
                                }

                                if (rows.length === 0) {
                                    return placedWeeks.size > 0 ? (
                                        <div
                                            key={week.week}
                                            className="flex h-9 items-center gap-4 border-b border-solid border-border px-4 text-[13px] text-text-muted"
                                        >
                                            <span className="w-12 shrink-0 font-mono text-[12px]">
                                                W{week.week}
                                            </span>
                                            {t('Nothing planned')}
                                        </div>
                                    ) : null;
                                }

                                return rows.map((item) => (
                                    <div
                                        key={item.id}
                                        className={`flex min-h-[40px] items-center gap-4 border-b border-solid border-border px-4 py-2 ${item.added ? 'bg-science-tint' : week.free ? 'bg-warning-tint' : ''}`}
                                    >
                                        <span className="w-12 shrink-0 font-mono text-[12px] text-text-muted">
                                            W{week.week}
                                        </span>
                                        <span className="flex min-w-0 flex-1 flex-col">
                                            <span className="text-[14px] text-text">
                                                {itemLabel(item)}
                                            </span>
                                            {item.name && (
                                                <span className="text-[12px] text-text-muted">
                                                    {item.topic}
                                                </span>
                                            )}
                                        </span>
                                        <span
                                            className={`w-[150px] shrink-0 text-[13px] ${item.added ? 'text-science' : item.carried ? 'text-warning-text' : 'text-success'}`}
                                        >
                                            {item.added
                                                ? t('Added by the teacher')
                                                : item.carried
                                                  ? t('Carried from last term')
                                                  : t('Yes')}
                                        </span>
                                        <span className="w-[60px] shrink-0 text-right font-mono text-[13px] text-text">
                                            {item.periods}
                                        </span>
                                    </div>
                                ));
                            })}
                            {unplaced.length > 0 && (
                                <div className="flex flex-col gap-1 bg-row-alt px-4 py-3">
                                    <span className={capsLabelClass}>
                                        {t('Not placed in a week · :count', {
                                            count: unplaced.length,
                                        })}
                                    </span>
                                    <p className="text-[13px] text-text">
                                        {unplaced
                                            .map((item) => itemLabel(item))
                                            .join(' · ')}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                    <p className="text-[13px] text-text-muted">
                        {t(
                            'Every change the teacher makes after approval is kept in the scheme’s history.',
                        )}
                    </p>
                </div>

                <aside className="flex shrink-0 flex-col gap-4 xl:w-[310px] xl:border-l xl:border-solid xl:border-border xl:pl-6">
                    <span className={capsLabelClass}>{t('Checks')}</span>
                    <ul className="flex flex-col gap-2">
                        {checks.syllabus > 0 && (
                            <Check ok={checks.placed === checks.syllabus}>
                                {t(
                                    ':placed of :total syllabus topics for the term are in the plan',
                                    {
                                        placed: checks.placed,
                                        total: checks.syllabus,
                                    },
                                )}
                            </Check>
                        )}
                        {checks.missing.length > 0 && (
                            <Check ok={false}>
                                {t(
                                    'Missing: :list. Not taught this term, it carries over to the next.',
                                    { list: checks.missing.join(', ') },
                                )}
                            </Check>
                        )}
                        <Check
                            ok={
                                checks.available === 0 ||
                                checks.periods <= checks.available
                            }
                        >
                            {t(
                                ':periods periods planned. The timetable gives :weekly a week, :available in the weeks without tests.',
                                {
                                    periods: checks.periods,
                                    weekly: checks.weekly,
                                    available: checks.available,
                                },
                            )}
                        </Check>
                        <Check ok={checks.in_free_weeks.length === 0}>
                            {checks.in_free_weeks.length === 0
                                ? t('Nothing new in test or exam weeks')
                                : t('New in a test or exam week: :list', {
                                      list: checks.in_free_weeks.join(', '),
                                  })}
                        </Check>
                        {checks.added > 0 && (
                            <Check ok>
                                {t(
                                    ':count added by the teacher, not in the syllabus',
                                    { count: checks.added },
                                )}
                            </Check>
                        )}
                    </ul>

                    {canReview && (
                        <div className="flex flex-col gap-2 border-t border-solid border-border pt-4">
                            <label className="flex flex-col gap-1 text-[13px] font-medium text-text">
                                {t('Note to :name', {
                                    name: scheme.teacher ?? t('the teacher'),
                                })}
                                <textarea
                                    rows={3}
                                    value={noteText}
                                    onChange={(e) =>
                                        setNoteText(e.target.value)
                                    }
                                    className="rounded-md border border-solid border-border bg-white px-3 py-2 text-[14px] font-normal outline-none focus:border-primary"
                                />
                            </label>
                            <p className="text-[12px] text-text-muted">
                                {t(
                                    'Needed when you ask for changes. Optional when you approve.',
                                )}
                            </p>
                            {(errors.note || errors.decision) && (
                                <p className="text-[13px] text-danger">
                                    {errors.note ?? errors.decision}
                                </p>
                            )}
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => decide('changes')}
                                    className={`${outlineButtonClass} flex-1`}
                                >
                                    {t('Ask for changes')}
                                </button>
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => decide('approve')}
                                    className={`${solidButtonClass} flex-1`}
                                >
                                    {t('Approve')}
                                </button>
                            </div>
                            <p className="text-[12px] text-text-muted">
                                {t(
                                    'After either choice, the next scheme waiting for your approval opens.',
                                )}
                            </p>
                        </div>
                    )}

                    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border px-4 py-3">
                        <span className="text-[13px] font-semibold text-text">
                            {t('History')}
                        </span>
                        {history.length === 0 && (
                            <p className="text-[12px] text-text-muted">
                                {t('Nothing yet.')}
                            </p>
                        )}
                        {history.map((event, position) => (
                            <div
                                key={position}
                                className="flex flex-col text-[12px] leading-[17px] text-text-muted"
                            >
                                <span>
                                    {dayMonth(event.on, false)} ·{' '}
                                    {t(ACTIONS[event.action] ?? event.action)}
                                    {event.by &&
                                        ` ${t('by :name', { name: event.by })}`}
                                </span>
                                {event.note && event.action !== 'opened' && (
                                    <span className="text-text">
                                        “{event.note}”
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </aside>
            </div>
        </div>
    );
}

export default withAppShell(ShowScheme);
