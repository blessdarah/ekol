import { router } from '@inertiajs/react';
import {
    clearMapping,
    problems,
    run,
} from '@/actions/App/Http/Controllers/StudentImportController';
import {
    capsLabelClass,
    outlineButtonClass,
    solidButtonClass,
} from '../../structure/ui';
import { money } from '../ui';
import { t } from '../../../lib/i18n';
import { type CheckStepModel } from './model';

/** What the import will do, running it, and the columns it reads. */
export function CheckAside({ check }: { check: CheckStepModel }) {
    const { mapping, report, nextMatricule, hasYear, importing, setImporting } =
        check;

    return (
        <aside className="flex shrink-0 flex-col gap-5 border-solid border-border lg:w-[328px] lg:border-l lg:pl-8">
            <div className="flex flex-col gap-[10px] rounded-lg border border-solid border-border bg-surface p-4">
                <p className={capsLabelClass}>{t('When you import')}</p>
                <p className="font-display text-[16px] leading-[22px] font-bold text-text">
                    {t(':ready students are created now.', {
                        ready: money(report.ready),
                    })}
                </p>
                <p className="text-[13px] leading-[19px] text-text-muted">
                    {t(
                        'Matricules run from :next_matricule. A guardian and the fee plan are created with each student. Rows with problems are skipped.',
                        { next_matricule: nextMatricule },
                    )}
                </p>
                <button
                    type="button"
                    disabled={report.ready === 0 || importing || !hasYear}
                    onClick={() => {
                        setImporting(true);
                        router.post(
                            run.url(),
                            {},
                            { onFinish: () => setImporting(false) },
                        );
                    }}
                    className={`${solidButtonClass} w-full`}
                >
                    {t('Import :ready students', {
                        ready: money(report.ready),
                    })}
                </button>
                {report.problems.length > 0 && (
                    <a
                        href={problems.url()}
                        className={`${outlineButtonClass} w-full`}
                    >
                        {t('Download the :problems problem rows', {
                            problems: report.problems.length,
                        })}
                    </a>
                )}
            </div>
            <div className="flex flex-col gap-[10px] rounded-lg border border-solid border-border bg-white p-4">
                <p className="text-[14px] leading-[18px] font-semibold text-text">
                    {t('Columns matched')}
                </p>
                <dl className="flex flex-col gap-2">
                    {mapping.map((pair) => (
                        <div
                            key={pair.field}
                            className="flex items-baseline justify-between gap-3"
                        >
                            <dt className="truncate text-[13px] leading-[18px] text-text-muted">
                                {pair.column}
                            </dt>
                            <dd className="shrink-0 text-[13px] leading-[18px] text-text">
                                {pair.field}
                            </dd>
                        </div>
                    ))}
                </dl>
                <button
                    type="button"
                    onClick={() => router.delete(clearMapping.url())}
                    className="self-start text-[13px] leading-4 font-medium text-primary hover:underline"
                >
                    {t('Change matching')}
                </button>
            </div>
        </aside>
    );
}
