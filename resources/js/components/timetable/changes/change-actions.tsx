import { Link } from '@inertiajs/react';
import { index } from '@/actions/App/Http/Controllers/TimetableChangeController';
import { t } from '../../../lib/i18n';
import { ErrorText } from '../../structure/ui';
import { primaryActionClass, quietActionClass } from '../ui';
import { type TimetableChanges } from './model';

/** The error, the hint and the buttons that make the change. */
export function ChangeActions({ changes }: { changes: TimetableChanges }) {
    const { mode, error, submit, ready } = changes;

    return (
        <>
            <ErrorText message={error} />

            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px] leading-4 text-text-muted">
                    {mode === 'cover'
                        ? t(
                              'Suggestions are teachers free in that period, those who teach the subject first.',
                          )
                        : t(
                              'The change is logged here. Whether the room or the teachers are free is for you to check.',
                          )}
                </p>
                <div className="flex gap-2">
                    <Link
                        href={index.url({ query: { mode } })}
                        className={quietActionClass}
                    >
                        {t('Cancel')}
                    </Link>
                    <button
                        type="button"
                        disabled={!ready}
                        onClick={submit}
                        className={primaryActionClass}
                    >
                        {mode === 'cover'
                            ? t('Assign cover')
                            : mode === 'swap'
                              ? t('Swap the lessons')
                              : t('Change the room')}
                    </button>
                </div>
            </div>
        </>
    );
}
