import { Head } from '@inertiajs/react';
import { primaryClass, quietClass } from '../../components/assessments/ui';
import { withAppShell } from '../../layouts/app-layout';
import { numberLocale, t } from '../../lib/i18n';

interface PrintProps {
    school: string;
    title: string;
    applied: string[];
    made: string;
    by: string | null;
    columns: { key: string; label: string }[];
    rows: Record<string, string | number | null>[];
}

/** An exported list laid out to print, or to save as PDF. */
function TablePrint({
    school,
    title,
    applied,
    made,
    by,
    columns,
    rows,
}: PrintProps) {
    const madeOn = new Intl.DateTimeFormat(numberLocale(), {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(made));

    return (
        <div className="flex flex-col gap-5 print:block">
            <Head title={`${school} · ${title}`} />
            <style>{'@page { size: A4 landscape; margin: 12mm; }'}</style>
            <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
                <p className="text-[13px] leading-4 text-text-muted">
                    {t(
                        'Print to paper, or choose “Save as PDF” in the print dialog.',
                    )}
                </p>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => window.history.back()}
                        className={quietClass}
                    >
                        {t('← Back')}
                    </button>
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className={primaryClass}
                    >
                        {t('Print list')}
                    </button>
                </div>
            </div>
            <div className="flex flex-col gap-4 rounded-lg border border-solid border-border bg-white p-6 print:border-0 print:p-0">
                <div className="flex flex-col gap-1 border-b border-solid border-text pb-3">
                    <p className="text-[12px] font-semibold tracking-[0.06em] text-text-muted uppercase">
                        {school}
                    </p>
                    <h1 className="font-display text-[24px] leading-7 font-bold text-text">
                        {title}
                    </h1>
                    <p className="text-[12px] text-text-muted">
                        {applied.length > 0
                            ? applied.join(' · ')
                            : t('No filters')}
                    </p>
                    <p className="text-[12px] text-text-muted">
                        {t('Made :date by :by', {
                            date: madeOn,
                            by: by ?? '—',
                        })}
                        {' · '}
                        {t(':count rows', { count: rows.length })}
                    </p>
                </div>
                <table className="w-full border-collapse text-[12px]">
                    <thead>
                        <tr>
                            <th className="w-8 border-b border-solid border-border py-2 pr-2 text-left font-mono font-semibold text-text-muted">
                                #
                            </th>
                            {columns.map((column) => (
                                <th
                                    key={column.key}
                                    className="border-b border-solid border-border py-2 pr-3 text-left font-semibold tracking-[0.04em] text-text-muted uppercase"
                                >
                                    {column.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, position) => (
                            <tr key={position} className="break-inside-avoid">
                                <td className="border-b border-solid border-border py-[6px] pr-2 font-mono text-text-muted">
                                    {position + 1}
                                </td>
                                {columns.map((column) => (
                                    <td
                                        key={column.key}
                                        className="border-b border-solid border-border py-[6px] pr-3 text-text"
                                    >
                                        {row[column.key] ?? ''}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default withAppShell(TablePrint);
