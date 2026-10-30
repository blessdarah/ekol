import { Head, Link } from '@inertiajs/react';
import { reports } from '@/actions/App/Http/Controllers/TermResultController';
import {
    ReportCard,
    type ReportCardData,
    type ReportIssuer,
} from '../../components/assessments/report-card';
import { primaryClass, quietClass } from '../../components/assessments/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface PrintProps {
    issuer: ReportIssuer;
    yearLabel: string | null;
    scope: { kind: string; id: string; label: string };
    class: { id: string; name: string };
    cards: ReportCardData[];
}

function ReportPrint({
    issuer,
    yearLabel,
    scope,
    class: current,
    cards,
}: PrintProps) {
    return (
        <div className="flex flex-col gap-5 print:block">
            <Head title={`${current.name} · ${scope.label}`} />
            {/* One A5 card fills each sheet, edge to edge. */}
            <style>{'@page { size: A5 portrait; margin: 0; }'}</style>
            <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
                <div className="flex flex-col gap-1">
                    <h1 className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text">
                        {current.name} · {t(scope.label)}
                    </h1>
                    <p className="text-[13px] leading-4 text-text-muted">
                        {cards.length}{' '}
                        {cards.length === 1 ? t('card') : t('cards')}
                        {t(
                            '. Each card prints on its own A5 sheet. Print to paper, or choose “Save as PDF” in the print dialog.',
                        )}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link
                        href={reports.url({
                            query: {
                                [scope.kind]: scope.id,
                                class: current.id,
                            },
                        })}
                        className={quietClass}
                    >
                        {t('← Back')}
                    </Link>
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className={primaryClass}
                    >
                        {t('Print cards')}
                    </button>
                </div>
            </div>
            <div className="flex flex-wrap justify-center gap-6 overflow-x-auto rounded-lg bg-surface p-6 print:block print:bg-transparent print:p-0">
                {cards.map((card) => (
                    <div
                        key={card.id}
                        className="shadow-[0_8px_24px_color-mix(in_srgb,var(--color-text)_12%,transparent)] print:shadow-none"
                    >
                        <ReportCard
                            card={card}
                            issuer={issuer}
                            yearLabel={yearLabel}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}

export default withAppShell(ReportPrint);
