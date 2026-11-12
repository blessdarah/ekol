import { Link } from '@inertiajs/react';
import { index } from '@/actions/App/Http/Controllers/StudentRosterController';
import {
    ErrorText,
    outlineButtonClass,
    solidButtonClass,
} from '../../structure/ui';
import { t, tChoice } from '../../../lib/i18n';
import { FileBar } from './file-bar';
import { MatchTable } from './match-table';
import { type MatchStepProps, useMatchStep } from './model';

/** The second step: matching the file's columns to the fields we need. */
export function MatchStep(props: MatchStepProps) {
    const match = useMatchStep(props);
    const { fields, file, errors, saving, matched, submit } = match;

    return (
        <form onSubmit={submit} className="flex flex-col gap-5">
            <FileBar
                file={file}
                note={tChoice(
                    '{1} :count column found|[2,*] :count columns found',
                    file.headers.length,
                )}
            />
            <MatchTable match={match} />
            <ErrorText message={errors.mapping} />
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px] leading-4 text-text-muted">
                    {t(
                        ':matched of :fields matched. Nothing is imported until you have seen the check.',
                        { matched, fields: fields.length },
                    )}
                </p>
                <div className="flex gap-2">
                    <Link href={index.url()} className={outlineButtonClass}>
                        {t('Cancel')}
                    </Link>
                    <button
                        type="submit"
                        disabled={saving}
                        className={solidButtonClass}
                    >
                        {t('Check the rows')}
                    </button>
                </div>
            </div>
        </form>
    );
}
