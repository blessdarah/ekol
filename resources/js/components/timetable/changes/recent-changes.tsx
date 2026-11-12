import { Link } from '@inertiajs/react';
import { checks } from '@/actions/App/Http/Controllers/TimetableController';
import { t } from '../../../lib/i18n';
import { capsLabelClass } from '../../structure/ui';
import { shortDate } from '../../students/ui';
import { linkClass } from '../ui';
import { type TimetableChanges } from './model';

/** The changes made this term, and when a new version is the answer. */
export function RecentChanges({ changes }: { changes: TimetableChanges }) {
    const { phase, recent } = changes;

    return (
        <aside className="flex shrink-0 flex-col gap-3 border-solid border-border lg:w-[320px] lg:border-l lg:pl-7">
            <p className={capsLabelClass}>{t('Recent changes')}</p>
            {recent.length === 0 ? (
                <p className="text-[13px] leading-[19px] text-text-muted">
                    {t('No changes yet this term.')}
                </p>
            ) : (
                <ul className="flex flex-col border-t border-solid border-border">
                    {recent.map((change) => (
                        <li
                            key={change.id}
                            className="flex flex-col gap-1 border-b border-solid border-border py-[10px]"
                        >
                            <span className="text-[13px] leading-[18px] text-text">
                                {t(change.summary)}
                            </span>
                            <span className="font-mono text-[11px] leading-[14px] text-text-muted">
                                {shortDate(change.on)}
                                {change.by
                                    ? t(' · by :by', {
                                          by: change.by,
                                      })
                                    : ''}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
            <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-4">
                <p className="text-[13px] leading-4 font-semibold text-text">
                    {t('When to make a new version')}
                </p>
                <p className="text-[13px] leading-[19px] text-text-muted">
                    {t(
                        'If a teacher or class changes for good, go to Check inputs and start version :draft.',
                        { draft: phase.draft },
                    )}
                </p>
                <Link href={checks.url()} className={linkClass}>
                    {t('Open Check inputs →')}
                </Link>
            </div>
        </aside>
    );
}
