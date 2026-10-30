import { Link } from '@inertiajs/react';
import { t } from '../../../lib/i18n';
import { LockIcon } from '../../structure/ui';
import { day, primaryClass, quietClass } from '../ui';
import type { MarkSheetModel } from './model';

/** The way back, the subject and its status, saving, and the assessments of the same subject. */
export function SheetHeader({ model }: { model: MarkSheetModel }) {
    const {
        sheet,
        plan,
        open,
        siblings,
        next,
        saving,
        dirty,
        invalid,
        empty,
        published,
        save,
        backHref,
        sheetHref,
    } = model;

    return (
        <>
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-[6px]">
                    <Link
                        href={backHref}
                        className="flex items-center gap-[6px] self-start text-[14px] leading-[18px] font-semibold text-primary hover:underline"
                    >
                        <span aria-hidden>←</span>
                        {next.mode === 'class'
                            ? t('Marks progress · :plan · :class', {
                                  plan: plan.name,
                                  class: sheet.class ?? '',
                              })
                            : t('My marks · :plan', { plan: plan.name })}
                    </Link>
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text sm:text-[40px] sm:leading-[44px]">
                            {sheet.subject}
                        </h1>
                        <span
                            className={`flex h-6 items-center gap-[6px] rounded-full px-[10px] text-[12px] leading-4 font-medium ${
                                open
                                    ? 'bg-success-tint text-success'
                                    : 'border border-solid border-border bg-surface text-text-muted'
                            }`}
                        >
                            {open && (
                                <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-success" />
                            )}
                            {open
                                ? t('Open · closes :window_ends_on', {
                                      window_ends_on: day(plan.window_ends_on),
                                  })
                                : plan.state === 'scheduled'
                                  ? t('Opens :window_starts_on', {
                                        window_starts_on: day(
                                            plan.window_starts_on,
                                        ),
                                    })
                                  : published
                                    ? t('Published :published_on · locked', {
                                          published_on: day(plan.published_on),
                                      })
                                    : t('Marks entry is closed')}
                        </span>
                    </div>
                    <p className="text-[13px] leading-4 text-text-muted">
                        {sheet.class} · {plan.name}
                        {sheet.teacher ? ` · ${sheet.teacher}` : ''}
                        {sheet.submitted_on
                            ? t(' · submitted :submitted_on', {
                                  submitted_on: day(sheet.submitted_on),
                              })
                            : ''}
                    </p>
                </div>
                {open && (
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="mr-1 text-[13px] leading-4 text-text-muted">
                            {saving
                                ? t('Saving…')
                                : dirty
                                  ? t('Unsaved changes')
                                  : t('All changes saved')}
                        </span>
                        <button
                            type="button"
                            disabled={saving || !dirty || invalid > 0}
                            onClick={() => save(false)}
                            className={quietClass}
                        >
                            {t('Save draft')}
                        </button>
                        <button
                            type="button"
                            disabled={saving || invalid > 0 || empty > 0}
                            onClick={() => save(true)}
                            className={primaryClass}
                        >
                            {sheet.submitted_on
                                ? t('Submit again')
                                : t('Submit marks')}
                        </button>
                    </div>
                )}
            </div>

            <nav
                aria-label={t('Assessments')}
                className="flex flex-wrap gap-x-7 border-b border-solid border-border"
            >
                {siblings.map((option) => {
                    const active = option.id === sheet.id;
                    const locked =
                        option.state === 'published' ||
                        option.state === 'marks_closed';

                    return (
                        <Link
                            key={option.id}
                            href={sheetHref(option.id)}
                            aria-current={active ? 'page' : undefined}
                            className={`-mb-px flex items-center gap-[6px] border-b-2 border-solid pb-[10px] text-[14px] leading-[18px] ${
                                active
                                    ? 'border-primary font-semibold text-text'
                                    : 'border-transparent font-medium text-text-muted hover:text-text'
                            }`}
                        >
                            {locked && <LockIcon />}
                            {option.name}
                            {option.state === 'scheduled' && (
                                <span className="font-normal">
                                    {t('· opens :opens_on', {
                                        opens_on: day(option.opens_on),
                                    })}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </nav>
        </>
    );
}
