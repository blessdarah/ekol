import { Head, Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { student as ledger } from '@/actions/App/Http/Controllers/FeeController';
import { dayMonth, figure } from '../../components/fees/ui';
import { outlineButtonClass, solidButtonClass } from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';

interface ReceiptProps {
    issuer: { name: string; town: string | null };
    currency: string;
    receipt: {
        number: string | null;
        on: string;
        amount: number;
        method: string;
        reference: string | null;
        by: string | null;
        year: string | null;
        balance: number;
        due: number;
        covers: { name: string; amount: number }[];
    };
    student: { id: string | null; name: string | null; matricule: string | null; class: string | null };
}

function Line({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex items-baseline justify-between gap-4 border-t border-solid border-border py-[10px]">
            <span className="text-[13px] leading-[18px] text-text-muted">{label}</span>
            <span className="text-right text-[14px] leading-[18px] text-text">{children}</span>
        </div>
    );
}

function Receipt({ issuer, currency, receipt, student }: ReceiptProps) {
    return (
        <div className="flex flex-col items-center gap-5">
            <Head title={`Receipt ${receipt.number ?? ''}`} />
            <div className="flex w-full max-w-[520px] flex-wrap items-center justify-between gap-3 print:hidden">
                {student.id ? (
                    <Link href={ledger.url(student.id)} className={outlineButtonClass}>
                        ← Back to the ledger
                    </Link>
                ) : (
                    <span />
                )}
                <button type="button" onClick={() => window.print()} className={solidButtonClass}>
                    Print receipt
                </button>
            </div>

            <article className="flex w-full max-w-[520px] flex-col gap-5 rounded-lg border border-solid border-border bg-white p-8 print:border-0 print:p-0">
                <header className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1">
                        <p className="font-display text-[20px] leading-6 font-bold text-text">{issuer.name}</p>
                        {issuer.town && <p className="text-[13px] leading-4 text-text-muted">{issuer.town}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <p className="text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase">Fee receipt</p>
                        <p className="font-mono text-[14px] leading-[18px] text-text">{receipt.number ?? '—'}</p>
                    </div>
                </header>

                <div className="flex flex-col gap-1 rounded-md bg-surface p-4">
                    <p className="text-[13px] leading-4 text-text-muted">Received</p>
                    <p className="flex items-baseline gap-[6px]">
                        <span className="font-display text-[40px] leading-[44px] font-extrabold tracking-[-0.02em] text-text">
                            {figure(receipt.amount)}
                        </span>
                        <span className="text-[16px] leading-5 font-medium text-text-muted">{currency}</span>
                    </p>
                </div>

                <div className="flex flex-col border-b border-solid border-border">
                    <Line label="From">
                        {student.name}
                        <span className="block font-mono text-[12px] leading-4 text-text-muted">
                            {[student.matricule, student.class].filter(Boolean).join(' · ')}
                        </span>
                    </Line>
                    <Line label="For">
                        Fees{receipt.year ? ` · ${receipt.year}` : ''}
                        {receipt.covers.length > 1 &&
                            receipt.covers.map((cover) => (
                                <span key={cover.name} className="block font-mono text-[12px] leading-[18px] text-text-muted">
                                    {cover.name} · {figure(cover.amount)}
                                </span>
                            ))}
                        {receipt.covers.length === 1 && receipt.covers[0].name !== 'School fees' && (
                            <span className="block text-[12px] leading-[18px] text-text-muted">{receipt.covers[0].name}</span>
                        )}
                    </Line>
                    <Line label="Date">{dayMonth(receipt.on)}</Line>
                    <Line label="Method">
                        {receipt.method}
                        {receipt.reference ? ` · ref ${receipt.reference}` : ''}
                    </Line>
                    <Line label="Received by">{receipt.by ?? '—'}</Line>
                    <Line label="Still owed after this">
                        <span className="font-mono">
                            {figure(receipt.balance)} {currency}
                        </span>
                        <span className="block text-[12px] leading-4 text-text-muted">of {figure(receipt.due)} for the year, as of today</span>
                    </Line>
                </div>

                <footer className="flex justify-between gap-8 pt-8 text-[12px] leading-4 text-text-muted">
                    <span className="flex-1 border-t border-solid border-border pt-2">Bursar’s signature</span>
                    <span className="flex-1 border-t border-solid border-border pt-2">School stamp</span>
                </footer>
            </article>
        </div>
    );
}

export default withAppShell(Receipt);
