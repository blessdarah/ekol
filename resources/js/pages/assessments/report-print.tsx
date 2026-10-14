import { Head, Link } from '@inertiajs/react';
import { reports } from '@/actions/App/Http/Controllers/TermResultController';
import {
    ReportCard,
    type ReportCardData,
    primaryClass,
    quietClass,
} from '../../components/assessments/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface PrintProps {
    issuer: { name: string; code: string };
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
        <div className="flex flex-col gap-5">
            <Head title={`${current.name} · ${scope.label}`} />
            <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
                <div className="flex flex-col gap-1">
                    <h1 className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text">
                        {current.name} · {t(scope.label)}
                    </h1>
                    <p className="text-[13px] leading-4 text-text-muted">
                        {cards.length}{' '}
                        {cards.length === 1 ? t('card') : t('cards')}
                        {t(
                            '. Print to paper, or choose “Save as PDF” in the print dialog.',
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
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 print:grid-cols-2 print:gap-4">
                {cards.map((card) => (
                    <ReportCard
                        key={card.id}
                        card={card}
                        issuer={issuer}
                        yearLabel={yearLabel}
                    />
                ))}
            </div>
        </div>
    );
}

export default withAppShell(ReportPrint);
