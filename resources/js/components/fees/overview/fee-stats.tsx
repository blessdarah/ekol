import { t } from '../../../lib/i18n';
import { capsLabelClass } from '../../structure/ui';
import { figure } from '../ui';
import { type FeesOverview } from './model';

/** Billed, collected, outstanding and overdue for the year. */
export function FeeStats({ fees }: { fees: FeesOverview }) {
    const { stats, currency } = fees;

    return (
        <div className="flex flex-wrap border-y border-solid border-border">
            {stats.map((stat, position) => (
                <div
                    key={stat.label}
                    className={`flex min-w-[160px] flex-1 flex-col gap-[2px] py-3 ${position === 0 ? 'pr-4' : 'border-l border-solid border-border px-4'}`}
                >
                    <span className={capsLabelClass}>{t(stat.label)}</span>
                    <span
                        className={`font-mono text-[20px] leading-7 ${stat.tone}`}
                    >
                        {figure(stat.value)}
                    </span>
                    <span className="text-[12px] leading-4 text-text-muted">
                        {currency} · {stat.note}
                    </span>
                </div>
            ))}
        </div>
    );
}
