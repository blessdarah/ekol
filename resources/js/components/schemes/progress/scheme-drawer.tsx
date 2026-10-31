import { Form, Link } from '@inertiajs/react';
import {
    note,
    show,
} from '@/actions/App/Http/Controllers/SchemeReviewController';
import { dayMonth } from '../../fees/ui';
import { StateLabel } from '../ui';
import { outlineButtonClass, solidButtonClass } from '../../structure/ui';
import { t } from '../../../lib/i18n';
import { type SchemesProgressModel } from './model';
export function SchemeDrawer({
    week,
    picked,
    writing,
    setWriting,
    pick,
    weeks,
    shownWeeks,
    laterItems,
}: Pick<
    SchemesProgressModel,
    | 'week'
    | 'writing'
    | 'setWriting'
    | 'pick'
    | 'weeks'
    | 'shownWeeks'
    | 'laterItems'
> & { picked: NonNullable<SchemesProgressModel['picked']> }) {
    return (
        <div
            className="fixed inset-0 z-50 flex justify-end bg-text/30"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    pick(null);
                }
            }}
        >
            <aside
                role="dialog"
                aria-modal="true"
                aria-label={`${picked.subject} · ${picked.class}`}
                className="flex h-full w-[460px] max-w-full flex-col bg-white shadow-[-24px_0_60px_color-mix(in_srgb,var(--color-text)_18%,transparent)]"
            >
                <div className="flex flex-col gap-[10px] border-b border-solid border-border px-7 pt-7 pb-[22px]">
                    <div className="flex items-center justify-between gap-4">
                        {picked.state === 'behind' ? (
                            <span className="flex items-center gap-[6px] text-[13px] leading-4 text-warning-text">
                                <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-warning" />
                                {t('Behind · :count sub-topics', {
                                    count: picked.late,
                                })}
                            </span>
                        ) : (
                            <StateLabel state={picked.state} />
                        )}
                        <button
                            type="button"
                            aria-label={t('Close')}
                            onClick={() => pick(null)}
                            className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-solid border-border hover:bg-surface"
                        >
                            <svg
                                width="12"
                                height="12"
                                viewBox="0 0 10 10"
                                aria-hidden
                            >
                                <path
                                    d="M2.5 2.5l5 5M7.5 2.5l-5 5"
                                    stroke="var(--color-text-muted)"
                                    strokeWidth="1.3"
                                    strokeLinecap="round"
                                />
                            </svg>
                        </button>
                    </div>
                    <h2 className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text">
                        {picked.subject} · {picked.class}
                    </h2>
                    <p className="text-[13px] leading-[18px] text-text-muted">
                        {[
                            picked.teacher ?? t('No teacher yet'),
                            picked.approved_on
                                ? `${t('approved :date', { date: dayMonth(picked.approved_on, false) })}${picked.approved_by ? ` ${t('by :name', { name: picked.approved_by })}` : ''}`
                                : null,
                            t(':count sub-topics', {
                                count: picked.topics,
                            }),
                        ]
                            .filter(Boolean)
                            .join(' · ')}
                    </p>
                </div>

                <div className="flex flex-1 flex-col gap-[22px] overflow-y-auto px-7 py-[22px]">
                    {picked.late > 0 && (
                        <div className="flex flex-col gap-2 rounded-lg bg-warning-tint px-4 py-[14px]">
                            <p className="text-[14px] leading-5 font-semibold text-text">
                                {t(
                                    ':count planned for weeks :weeks are not taught yet.',
                                    {
                                        count: picked.late,
                                        weeks: picked.late_weeks.join(', '),
                                    },
                                )}
                            </p>
                            <p className="text-[13px] leading-[18px] text-text">
                                {picked.items
                                    .filter((item) => item.state === 'late')
                                    .map((item) => item.label)
                                    .join(' · ')}
                            </p>
                        </div>
                    )}
                    {picked.items.length === 0 && (
                        <p className="text-[13px] text-text-muted">
                            {t('Nothing is placed in a week yet.')}
                        </p>
                    )}
                    {shownWeeks.map((each) => (
                        <div key={each} className="flex flex-col gap-[6px]">
                            <p
                                className={`text-[11px] leading-[14px] font-semibold tracking-[0.06em] uppercase ${each === week ? 'text-primary' : 'text-text-muted'}`}
                            >
                                {each === week
                                    ? t('Week :week · this week', {
                                          week: each,
                                      })
                                    : t('Week :week', { week: each })}
                            </p>
                            {picked.items
                                .filter((item) => item.week === each)
                                .map((item) => (
                                    <div
                                        key={item.id}
                                        className="flex items-center gap-3 text-[14px] leading-5"
                                    >
                                        <span
                                            className={`w-4 shrink-0 ${
                                                item.state === 'taught'
                                                    ? 'text-success'
                                                    : item.state === 'late'
                                                      ? 'text-warning'
                                                      : 'text-text-disabled'
                                            }`}
                                            aria-hidden
                                        >
                                            {item.state === 'taught'
                                                ? '✓'
                                                : '○'}
                                        </span>
                                        <span
                                            className={`min-w-0 flex-1 ${item.state === 'taught' || item.state === 'late' ? 'text-text' : 'text-text-muted'}`}
                                        >
                                            {item.label}
                                        </span>
                                        <span
                                            className={`shrink-0 text-[12px] ${item.state === 'late' ? 'text-warning-text' : 'text-text-muted'}`}
                                        >
                                            {item.taught_on
                                                ? dayMonth(
                                                      item.taught_on,
                                                      false,
                                                  )
                                                : item.state === 'late'
                                                  ? t('not yet')
                                                  : t('planned')}
                                        </span>
                                    </div>
                                ))}
                        </div>
                    ))}
                    {laterItems.length > 0 && week !== null && (
                        <Link
                            href={show.url(picked.id)}
                            className="text-[13px] font-medium text-primary hover:underline"
                        >
                            {t('Weeks :from–:to · :count more sub-topics', {
                                from: week + 1,
                                to: weeks[weeks.length - 1] ?? week + 1,
                                count: laterItems.length,
                            })}
                        </Link>
                    )}
                </div>

                <div className="flex flex-col gap-[10px] border-t border-solid border-border bg-surface px-7 pt-[18px] pb-6">
                    {writing ? (
                        <Form
                            action={note.url(picked.id)}
                            method="post"
                            resetOnSuccess
                            onSuccess={() => setWriting(false)}
                            className="flex flex-col gap-2"
                        >
                            {({ errors, processing }) => (
                                <>
                                    <label className="flex flex-col gap-1 text-[13px] font-medium text-text">
                                        {t('Note to :name', {
                                            name:
                                                picked.teacher ??
                                                t('the teacher'),
                                        })}
                                        <textarea
                                            name="note"
                                            rows={3}
                                            autoFocus
                                            className="rounded-md border border-solid border-border bg-white px-3 py-2 text-[14px] font-normal outline-none focus:border-primary"
                                        />
                                    </label>
                                    {errors.note && (
                                        <p className="text-[13px] text-danger">
                                            {errors.note}
                                        </p>
                                    )}
                                    <div className="flex gap-2">
                                        <button
                                            type="submit"
                                            disabled={processing}
                                            className={`${solidButtonClass} flex-1`}
                                        >
                                            {t('Send')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setWriting(false)}
                                            className={`${outlineButtonClass} flex-1`}
                                        >
                                            {t('Cancel')}
                                        </button>
                                    </div>
                                </>
                            )}
                        </Form>
                    ) : (
                        <div className="flex gap-2">
                            {picked.teacher && (
                                <button
                                    type="button"
                                    onClick={() => setWriting(true)}
                                    className={`${solidButtonClass} flex-1`}
                                >
                                    {t('Send :name a note', {
                                        name: picked.teacher.split(' ')[0],
                                    })}
                                </button>
                            )}
                            <Link
                                href={show.url(picked.id)}
                                className={`${outlineButtonClass} flex-1 bg-white`}
                            >
                                {t('Open full scheme →')}
                            </Link>
                        </div>
                    )}
                    <p className="text-[12px] leading-[17px] text-text-muted">
                        {t(
                            'The teacher sees the note on their scheme. ↑ ↓ moves to the next scheme without closing.',
                        )}
                    </p>
                </div>
            </aside>
        </div>
    );
}
