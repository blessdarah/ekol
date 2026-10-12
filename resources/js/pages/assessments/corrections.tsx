import { Head, Link, useForm } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { decide, index } from '@/actions/App/Http/Controllers/CorrectionController';
import {
    AssessmentHeader,
    type AssessmentTabs,
    Empty,
    amberText,
    day,
    ordinal,
    primaryClass,
    quietClass,
    score,
} from '../../components/assessments/ui';
import { ErrorText, capsLabelClass } from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface Detail {
    id: string;
    reference: string;
    status: string;
    student: string | null;
    subject: string | null;
    class: string | null;
    plan: string | null;
    coefficient: number;
    old: number | null;
    new: number;
    reason: string;
    asked_by: string | null;
    asked_on: string;
    decided_by: string | null;
    decided_on: string | null;
    note: string | null;
    published_on: string | null;
    impact: { average_from: number | null; average_to: number | null; position_from: number | null; position_to: number | null } | null;
}

interface CorrectionsProps {
    tabs: AssessmentTabs;
    show: 'pending' | 'decided';
    counts: { pending: number; decided: number };
    canDecide: boolean;
    list: { id: string; reference: string; student: string | null; subject: string | null; plan: string | null; old: number | null; new: number; status: string }[];
    current: Detail | null;
}

function Line({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex items-baseline gap-4 border-b border-solid border-border py-3">
            <span className="w-[150px] shrink-0 text-[13px] leading-[18px] text-text-muted">{label}</span>
            <span className="min-w-0 flex-1 text-[14px] leading-[19px] text-text">{children}</span>
        </div>
    );
}

function Decision({ correction }: { correction: Detail }) {
    const form = useForm<{ decision: 'approve' | 'decline'; note: string }>({ decision: 'approve', note: '' });
    const errors = form.errors as Record<string, string | undefined>;

    function send(decision: 'approve' | 'decline') {
        form.transform((data) => ({ ...data, decision, note: data.note.trim() || null }));
        form.post(decide.url(correction.id), { preserveScroll: true });
    }

    return (
        <>
            <label className="flex flex-col gap-[6px] text-[13px] leading-4 font-medium text-text">
                {t('Note to the teacher')}
                <input
                    type="text"
                    value={form.data.note}
                    onChange={(e) => form.setData('note', e.target.value)}
                    placeholder={t('Optional')}
                    className="h-10 w-full rounded-md border border-solid border-border px-3 text-[14px] leading-[18px] font-normal text-text outline-none focus:border-primary"
                />
            </label>
            <ErrorText message={errors.decision ?? errors.note} />
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px] leading-4 text-text-muted">{t('Only the principal or an administrator can approve. Every change is kept in the log.')}</p>
                <div className="flex gap-2">
                    <button type="button" disabled={form.processing} onClick={() => send('decline')} className={quietClass}>
                        {t('Decline')}
                    </button>
                    <button type="button" disabled={form.processing} onClick={() => send('approve')} className={primaryClass}>
                        {t('Approve and reissue results')}
                    </button>
                </div>
            </div>
        </>
    );
}

function Corrections({ tabs, show, counts, canDecide, list, current }: CorrectionsProps) {
    const impact = current?.impact;

    return (
        <div className="flex lg:min-h-[calc(100vh-56px)] flex-col gap-5">
            <Head title={t('Corrections')} />
            <AssessmentHeader
                active="corrections"
                tabs={tabs}
                trail={[{ label: t('Corrections') }]}
                title={t('Corrections')}
                meta={t('A published mark is locked. A teacher asks for a change, and the principal decides.')}
            />

            <div className="flex flex-1 flex-col gap-6 lg:flex-row">
                <div className="flex shrink-0 flex-col gap-3 lg:w-[300px]">
                    <div className="flex gap-2">
                        {(['pending', 'decided'] as const).map((option) => (
                            <Link
                                key={option}
                                href={index.url({ query: { show: option } })}
                                aria-current={option === show ? 'true' : undefined}
                                className={`flex h-7 items-center rounded-full border border-solid px-3 text-[12px] leading-4 ${
                                    option === show ? 'border-primary bg-primary-tint font-semibold text-primary' : 'border-border font-medium text-text hover:bg-surface'
                                }`}
                            >
                                {option === 'pending' ? t('Pending') : t('Decided')} · {counts[option]}
                            </Link>
                        ))}
                    </div>
                    {list.map((item) => (
                        <Link
                            key={item.id}
                            href={index.url({ query: { show, id: item.id } })}
                            preserveScroll
                            aria-current={item.id === current?.id ? 'true' : undefined}
                            className={`flex flex-col gap-1 rounded-lg border border-solid p-3 ${
                                item.id === current?.id ? 'border-primary bg-primary-tint' : 'border-border hover:bg-surface'
                            }`}
                        >
                            <span className="flex items-center justify-between gap-3">
                                <span className="truncate text-[14px] leading-[18px] font-semibold text-text">{item.student}</span>
                                <span className="shrink-0 font-mono text-[11px] leading-[14px] text-text-muted">{item.reference}</span>
                            </span>
                            <span className="text-[13px] leading-4 text-text-muted">
                                {item.subject} · {item.plan} · {score(item.old)} → {score(item.new)}
                                {item.status !== 'pending' && ` · ${item.status}`}
                            </span>
                        </Link>
                    ))}
                    <p className={`px-[2px] pt-1 ${capsLabelClass}`}>{t('How a correction works')}</p>
                    <ol className="flex flex-col gap-2 rounded-lg bg-surface p-3 text-[13px] leading-[18px] text-text">
                        <li>{t('1 · The teacher asks, on the locked mark sheet, with a reason')}</li>
                        <li>{t('2 · The principal approves or declines')}</li>
                        <li>{t('3 · Results and report cards show the new mark, and the change is logged')}</li>
                    </ol>
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-4">
                    {!current ? (
                        <Empty title={show === 'pending' ? t('Nothing is waiting') : t('No corrections decided yet')}>
                            {show === 'pending'
                                ? t('When a teacher asks for a published mark to change, the request waits here for the principal.')
                                : t('Approved and declined corrections are kept here.')}
                        </Empty>
                    ) : (
                        <>
                            <div className="flex flex-wrap items-center gap-3">
                                <h2 className="font-display text-[22px] leading-7 font-bold tracking-[-0.01em] text-text">
                                    {current.student} · {current.subject}
                                </h2>
                                <span
                                    className={`flex h-[22px] items-center rounded-full px-[10px] text-[12px] leading-4 font-medium ${
                                        current.status === 'pending'
                                            ? `bg-warning-tint ${amberText}`
                                            : current.status === 'approved'
                                              ? 'bg-success-tint text-success'
                                              : 'border border-solid border-border bg-surface text-text'
                                    }`}
                                >
                                    {current.status === 'pending' ? t('Waiting for the principal') : current.status === 'approved' ? t('Approved') : t('Declined')}
                                </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-7 gap-y-3 rounded-lg bg-surface p-5">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[12px] leading-4 text-text-muted">{t('Published mark')}</span>
                                    <span className="font-mono text-[28px] leading-8 text-text-muted">{score(current.old)}</span>
                                </div>
                                <span className="text-[20px] text-text-muted">→</span>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[12px] leading-4 text-text-muted">{t('Corrected mark')}</span>
                                    <span className="font-mono text-[28px] leading-8 text-text">{score(current.new)}</span>
                                </div>
                                <div className="ml-auto flex flex-col items-end gap-1">
                                    <span className="text-[14px] leading-[18px] font-medium text-text">
                                        {current.class} · {current.plan}
                                    </span>
                                    <span className="text-[12px] leading-4 text-text-muted">
                                        {t(':subject · coef :coefficient', { subject: current.subject, coefficient: current.coefficient })}
                                    </span>
                                </div>
                            </div>

                            <div className="flex flex-col border-t border-solid border-border">
                                <Line label={t('Asked by')}>
                                    {current.asked_by ?? t('Unknown')}, {day(current.asked_on)}
                                </Line>
                                <Line label={t('Reason')}>{current.reason}</Line>
                                {impact && (
                                    <Line label={t('What changes')}>
                                        {t('Average')} {score(impact.average_from)} → {score(impact.average_to)}
                                        {impact.position_from !== null && impact.position_to !== null
                                            ? t(' · position :position_from → :position_to', { position_from: ordinal(impact.position_from), position_to: ordinal(impact.position_to) })
                                            : t(' · not ranked while a mark is missing')}
                                        {t('. Results, term averages and report cards use the new mark at once.')}
                                    </Line>
                                )}
                                {current.status !== 'pending' && (
                                    <Line label={current.status === 'approved' ? t('Approved by') : t('Declined by')}>
                                        {current.decided_by ?? t('Unknown')}, {day(current.decided_on)}
                                        {current.note ? ` · “${current.note}”` : ''}
                                    </Line>
                                )}
                            </div>

                            {current.status === 'pending' &&
                                (canDecide ? (
                                    <Decision key={current.id} correction={current} />
                                ) : (
                                    <p className="text-[13px] leading-[19px] text-text-muted">{t('Only the principal or an administrator can approve or decline.')}</p>
                                ))}

                            <div className="flex flex-col gap-1 rounded-lg border border-dashed border-border p-4">
                                <p className="text-[13px] leading-4 font-semibold text-text">{t('Log for this mark')}</p>
                                <p className="text-[13px] leading-[19px] text-text-muted">
                                    {current.published_on ? t(':published_on · Published at :old · ', { published_on: day(current.published_on), old: score(current.old) }) : ''}
                                    {day(current.asked_on)} {t('· Correction asked by')} {current.asked_by ?? t('a teacher')} ·{' '}
                                    {current.status === 'pending'
                                        ? t('Now waiting')
                                        : `${day(current.decided_on)} · ${current.status === 'approved' ? t('Approved, now :new', { new: score(current.new) }) : t('Declined, mark unchanged')}`}
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default withAppShell(Corrections);
