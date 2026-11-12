import { Link } from '@inertiajs/react';
import { index as schemesIndex } from '@/actions/App/Http/Controllers/SchemeController';
import { dayMonth } from '../../fees/ui';
import { t } from '../../../lib/i18n';
import { type MySchemeModel } from './model';

/** Schemes waiting on the teacher, the last note, and what went wrong. */
export function SchemeNotices({ mine }: { mine: MySchemeModel }) {
    const { scheme, toApprove, errors } = mine;

    return (
        <>
            {toApprove > 0 && (
                <Link
                    href={schemesIndex.url({ query: { state: 'to_approve' } })}
                    className="flex items-center justify-between rounded-lg border border-solid border-science bg-science-tint px-4 py-3 text-[14px] text-text hover:underline"
                >
                    {t(
                        ':count schemes in your department are waiting for your approval.',
                        { count: toApprove },
                    )}
                    <span aria-hidden>→</span>
                </Link>
            )}

            {scheme.last_note && (
                <div
                    className={`rounded-lg px-4 py-3 text-[14px] ${scheme.last_note.action === 'changes_requested' ? 'bg-warning-tint' : 'bg-surface'}`}
                >
                    <p className="text-[12px] text-text-muted">
                        {scheme.last_note.action === 'changes_requested'
                            ? t('Changes asked for')
                            : t('Note')}
                        {scheme.last_note.by && ` · ${scheme.last_note.by}`} ·{' '}
                        {dayMonth(scheme.last_note.on, false)}
                    </p>
                    <p className="text-text">“{scheme.last_note.note}”</p>
                </div>
            )}

            {(errors.scheme || errors.item || errors.week) && (
                <p className="text-[13px] text-danger">
                    {errors.scheme ?? errors.item ?? errors.week}
                </p>
            )}
        </>
    );
}
