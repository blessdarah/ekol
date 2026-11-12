import { StatePill, dayMonth, figure } from '../ui';
import { t } from '../../../lib/i18n';
import { Marker } from './marker';
import { type Invoice, type StudentFeesModel } from './model';

/** Each installment, when it is due and how much of it is paid. */
export function Installments({
    fees,
    invoice,
}: {
    fees: StudentFeesModel;
    invoice: Invoice;
}) {
    const { currentSeq } = fees;

    return (
        <section className="flex flex-col gap-3">
            <h2 className="font-display text-[20px] leading-6 font-bold tracking-[-0.01em] text-text">
                {t('Installments')}
            </h2>
            <ul className="flex flex-col">
                {invoice.installments.map((row) => (
                    <li
                        key={row.seq}
                        className="flex min-h-14 shrink-0 items-center gap-4 border-b border-solid border-border py-2 last:border-b-0"
                    >
                        <Marker
                            state={row.state}
                            current={row.seq === currentSeq}
                        />
                        <span className="flex min-w-0 flex-1 flex-col">
                            <span className="text-[14px] leading-[18px] font-medium text-text">
                                {t(row.label)}
                            </span>
                            <span
                                className={`text-[12px] leading-4 ${row.state === 'overdue' ? 'text-danger' : 'text-text-muted'}`}
                            >
                                {t('Due')} {dayMonth(row.due_on)}
                                {row.state === 'overdue' &&
                                    t(' · :days_late :days late', {
                                        days_late: row.days_late,
                                        days:
                                            row.days_late === 1
                                                ? 'day'
                                                : 'days',
                                    })}
                            </span>
                        </span>
                        <span
                            className={`shrink-0 text-right font-mono text-[14px] leading-[18px] ${row.state === 'overdue' || row.state === 'partial' ? 'text-text' : 'text-text-muted'}`}
                        >
                            {figure(row.paid)} / {figure(row.amount)}
                        </span>
                        <span className="flex w-[110px] shrink-0 justify-end">
                            <StatePill state={row.state} />
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}
