import { moneyNumber, moneySum } from '@/lib/money';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { dayMonth } from './ui';
import { numberLocale, t } from '../../lib/i18n';
import '../../../css/receipt.css';

export interface FeeReceiptProps {
    issuer: {
        name: string;
        code: string;
        town: string | null;
        motto: string | null;
        logo_url: string | null;
    };
    currency: string;
    receipt: {
        kind: 'digital' | 'counter';
        number: string | null;
        on: string;
        time: string;
        amount: number;
        words: string;
        method: string;
        reference: string | null;
        paid_from: string | null;
        by: string | null;
        year: string | null;
        balance: number;
        due: number;
        paid: number;
        can_pay: boolean;
        state: 'paid' | 'partial';
        next: { amount: number; due_on: string } | null;
        covers: { name: string; amount: number }[];
        history: {
            number: string | null;
            on: string;
            amount: number;
            method: string;
            current: boolean;
        }[];
        verification_url: string;
        qr: string;
    };
    student: {
        id: string | null;
        name: string | null;
        matricule: string | null;
        class: string | null;
    };
}

function figure(amount: number): string {
    return new Intl.NumberFormat(numberLocale(), {
        maximumFractionDigits: 2,
    }).format(amount);
}

function Label({ children }: { children: ReactNode }) {
    return <p className="receipt-label">{children}</p>;
}

function SchoolMark({ issuer }: Pick<FeeReceiptProps, 'issuer'>) {
    return issuer.logo_url ? (
        <img
            src={issuer.logo_url}
            alt={issuer.name}
            className="receipt-school-mark object-contain"
        />
    ) : (
        <span className="receipt-school-mark">
            {issuer.code.slice(0, 2).toUpperCase()}
        </span>
    );
}

function ReceiptBackground() {
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 1188 840"
            preserveAspectRatio="none"
            className="receipt-background"
        >
            <rect
                x="18"
                y="18"
                width="1152"
                height="804"
                fill="none"
                stroke="var(--color-document-border)"
                strokeWidth="1"
            />
        </svg>
    );
}

export function ReceiptStamp({
    issuer,
    receipt,
}: Pick<FeeReceiptProps, 'issuer' | 'receipt'>) {
    const id = useId();
    const paid = receipt.state === 'paid';
    return (
        <svg
            role="img"
            aria-label={t(paid ? 'Paid in full' : 'Part payment')}
            viewBox="0 0 180 180"
            className="receipt-stamp text-document-text"
        >
            <defs>
                <path id={id} d="M90,26 a64,64 0 1,1 -0.01,0" />
            </defs>
            <g transform="rotate(-10 90 90)" fill="currentColor" opacity=".88">
                <g fill="none" stroke="currentColor">
                    <circle cx="90" cy="90" r="84" strokeWidth="3" />
                    <circle cx="90" cy="90" r="78" />
                    <circle cx="90" cy="90" r="56" strokeWidth="1.5" />
                </g>
                <text fontSize="9" fontWeight="700" letterSpacing="1.2">
                    <textPath
                        href={`#${id}`}
                        textLength="396"
                        lengthAdjust="spacingAndGlyphs"
                    >
                        {issuer.name.toUpperCase()} · {t('BURSARY')} ·{' '}
                        {t('OFFICIAL RECEIPT')} ·{' '}
                    </textPath>
                </text>
                <text
                    x="90"
                    y="62"
                    textAnchor="middle"
                    fontFamily="var(--font-mono)"
                    fontSize="8"
                >
                    {dayMonth(receipt.on).toUpperCase()}
                </text>
                <text
                    x="90"
                    y="98"
                    textAnchor="middle"
                    fontFamily="var(--font-display)"
                    fontSize="28"
                    fontWeight="800"
                >
                    {t(paid ? 'PAID' : 'PART')}
                </text>
                <text
                    x="90"
                    y="116"
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="700"
                    letterSpacing="2"
                >
                    {t(paid ? 'IN FULL' : 'PAYMENT')}
                </text>
            </g>
        </svg>
    );
}

function YearBalance({
    receipt,
    currency,
}: Pick<FeeReceiptProps, 'receipt' | 'currency'>) {
    const percent =
        receipt.due > 0
            ? Math.min(100, Math.max(0, (receipt.paid / receipt.due) * 100))
            : 100;
    return (
        <section
            className={`receipt-year ${receipt.state === 'paid' ? 'receipt-settled' : ''}`}
        >
            <Label>
                {t("The year's fees")} · {receipt.year}
            </Label>
            <div className="receipt-summary-line">
                <span>{t('Fees for the year')}</span>
                <span>{figure(receipt.due)}</span>
            </div>
            <div className="receipt-summary-line">
                <span>{t('Paid so far, with this')}</span>
                <span>{figure(receipt.paid)}</span>
            </div>
            <div
                className="receipt-progress"
                role="progressbar"
                aria-label={t('Fees paid')}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(percent)}
            >
                <span style={{ width: `${percent}%` }} />
            </div>
            <div className="receipt-summary-line receipt-balance">
                <strong>{t('Balance')}</strong>
                <strong>
                    {figure(receipt.balance)} {currency}
                </strong>
            </div>
            {receipt.next && (
                <p className="text-[10px] leading-[14px]">
                    {t('Next installment :amount due :date', {
                        amount: `${figure(receipt.next.amount)} ${currency}`,
                        date: dayMonth(receipt.next.due_on),
                    })}
                </p>
            )}
            <p className="text-[9px] leading-3 text-text-muted">
                {t('Account after this payment')}
            </p>
        </section>
    );
}

function Verification({ receipt }: Pick<FeeReceiptProps, 'receipt'>) {
    return (
        <a
            href={receipt.verification_url}
            className="receipt-verification"
            target="_blank"
            rel="noopener noreferrer"
        >
            <img
                src={receipt.qr}
                alt={t('Scan to verify this receipt')}
                width="64"
                height="64"
            />
            <span>
                <strong>{t('Check this receipt is genuine')}</strong>
                <span className="mt-1 block">
                    {t(
                        'Scan the code or open the verification link to check the receipt number, payment reference, amount and date.',
                    )}
                </span>
                <span className="mt-1 block font-mono">{receipt.number}</span>
            </span>
        </a>
    );
}

export function PrintedFeeReceipt(props: FeeReceiptProps) {
    return props.receipt.kind === 'digital' ? (
        <PaymentConfirmation {...props} />
    ) : (
        <CounterfoilReceipt {...props} />
    );
}

function CounterfoilReceipt(props: FeeReceiptProps) {
    const { issuer, currency, receipt, student } = props;
    const money = (value: number) => `${figure(value)} ${currency}`;
    const history = receipt.history.slice(-3);
    const earlier = receipt.history.slice(0, -3);
    return (
        <article className="receipt-sheet" aria-label={t('School fee receipt')}>
            <ReceiptBackground />
            <aside className="receipt-counterfoil">
                <Label>{t('Counterfoil · school copy')}</Label>
                <h2>{issuer.name}</h2>
                <p className="font-mono text-[11px]">Nº {receipt.number}</p>
                <hr />
                <div>
                    <Label>{t('Date')}</Label>
                    <p>
                        {dayMonth(receipt.on)} · {receipt.time}
                    </p>
                </div>
                <div>
                    <Label>{t('Student')}</Label>
                    <strong>{student.name}</strong>
                    <p className="text-[10px]">
                        {student.matricule} · {student.class}
                    </p>
                </div>
                {receipt.paid_from && (
                    <div>
                        <Label>{t('Paid from')}</Label>
                        <p>{receipt.paid_from}</p>
                    </div>
                )}
                <div>
                    <Label>{t('Amount')}</Label>
                    <p className="font-serif text-[22px] text-document-text">
                        {money(receipt.amount)}
                    </p>
                </div>
                <div>
                    <Label>{t('Method')}</Label>
                    <p>{t(receipt.method)}</p>
                    <p className="font-mono text-[10px] break-all">
                        {receipt.reference}
                    </p>
                </div>
                <div>
                    <Label>{t('Balance after')}</Label>
                    <strong className="text-document-text">
                        {money(receipt.balance)}
                    </strong>
                </div>
                <footer>
                    <Label>
                        {t('Received by')} · {t('Signature')}
                    </Label>
                    <p>{receipt.by ?? t('Mobile money confirmation')}</p>
                </footer>
            </aside>
            <div className="receipt-perforation" aria-hidden="true">
                <span>✂</span>
            </div>
            <div className="receipt-original">
                <header className="receipt-letterhead">
                    <SchoolMark issuer={issuer} />
                    <div className="min-w-0 flex-1">
                        <Label>{t('School bursary')}</Label>
                        <h1>{issuer.name}</h1>
                        {issuer.motto && (
                            <p className="font-serif text-[12px] text-document-muted italic">
                                {issuer.motto}
                            </p>
                        )}
                        {issuer.town && (
                            <p className="text-[10px] text-text-muted">
                                {issuer.town}
                            </p>
                        )}
                    </div>
                    <div className="receipt-serial">
                        <Label>{t('Official receipt')}</Label>
                        <p className="font-serif text-[19px] italic">
                            {t('School fees')}
                        </p>
                        <p className="font-mono text-[12px]">
                            Nº {receipt.number}
                        </p>
                        <p className="text-[10px] text-text-muted">
                            {dayMonth(receipt.on)} · {receipt.time}
                        </p>
                    </div>
                </header>
                <div className="receipt-student">
                    <div>
                        <Label>{t('For the student')}</Label>
                        <h2>{student.name}</h2>
                        <p className="font-mono text-[10px]">
                            {student.matricule}
                        </p>
                    </div>
                    <div>
                        <Label>{t('Class · year')}</Label>
                        <h2>{student.class ?? '—'}</h2>
                        <p>{receipt.year}</p>
                    </div>
                </div>
                <div className="receipt-columns">
                    <section className="receipt-amount">
                        <Label>{t('Amount received')}</Label>
                        <p>
                            <strong>{figure(receipt.amount)}</strong>{' '}
                            <span>{currency}</span>
                        </p>
                        <p className="font-serif text-[12px] italic">
                            {receipt.words}
                        </p>
                    </section>
                    <section className="receipt-method">
                        <Label>{t('Paid by')}</Label>
                        <strong>{t(receipt.method)}</strong>
                        {receipt.paid_from && <p>{receipt.paid_from}</p>}
                        <p className="font-mono text-[10px] break-all">
                            {receipt.reference
                                ? `${t('Ref.')} ${receipt.reference}`
                                : t('Recorded by the school')}
                        </p>
                    </section>
                </div>
                <div className="receipt-columns">
                    <table className="receipt-items">
                        <thead>
                            <tr>
                                <th scope="col">{t('This payment covers')}</th>
                                <th scope="col">{currency}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {receipt.covers.map((cover) => (
                                <tr key={cover.name}>
                                    <th scope="row">{t(cover.name)}</th>
                                    <td>{figure(cover.amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <th scope="row">{t('Total')}</th>
                                <td>{figure(receipt.amount)}</td>
                            </tr>
                        </tfoot>
                    </table>
                    <YearBalance receipt={receipt} currency={currency} />
                </div>
                <div className="receipt-lower">
                    <section className="min-w-0 flex-1">
                        <Label>{t('Payments this year')}</Label>
                        <div className="receipt-timeline">
                            {earlier.length > 0 && (
                                <div>
                                    <strong>
                                        {money(
                                            moneyNumber(
                                                moneySum(
                                                    earlier.map(
                                                        (entry) => entry.amount,
                                                    ),
                                                ),
                                            ),
                                        )}
                                    </strong>
                                    <span>
                                        {t(':count earlier payments', {
                                            count: earlier.length,
                                        })}
                                    </span>
                                </div>
                            )}
                            {history.map((entry) => (
                                <div
                                    key={entry.number}
                                    className={
                                        entry.current ? 'receipt-current' : ''
                                    }
                                >
                                    <strong>{figure(entry.amount)}</strong>
                                    <span>
                                        {dayMonth(entry.on, false)} ·{' '}
                                        {entry.current
                                            ? t('This receipt')
                                            : t(entry.method)}
                                    </span>
                                    <span className="font-mono">
                                        {entry.number}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>
                    <ReceiptStamp issuer={issuer} receipt={receipt} />
                </div>
                <footer className="receipt-footer">
                    <div className="receipt-signature">
                        <Label>{t('Received by')}</Label>
                        <p>
                            {receipt.by ?? t('Mobile money confirmation')}
                            <span>{t('Signature')}</span>
                        </p>
                    </div>
                    <Verification receipt={receipt} />
                </footer>
                <div className="receipt-microprint" aria-hidden="true">
                    {Array.from(
                        { length: 4 },
                        () =>
                            `${issuer.name} · ${t('Official receipt')} · ${receipt.number} · ${money(receipt.amount)} · `,
                    ).join('')}
                </div>
            </div>
        </article>
    );
}

export function PhoneFeeReceipt(props: FeeReceiptProps) {
    return props.receipt.kind === 'digital' ? (
        <PaymentConfirmation {...props} />
    ) : (
        <PhoneCounterReceipt {...props} />
    );
}

function PhoneCounterReceipt({
    issuer,
    currency,
    receipt,
    student,
}: FeeReceiptProps) {
    return (
        <article className="receipt-phone">
            <header>
                <SchoolMark issuer={issuer} />
                <h1>{issuer.name}</h1>
                <Label>{t('Official receipt · school fees')}</Label>
                <p className="receipt-phone-amount">
                    {figure(receipt.amount)} <span>{currency}</span>
                </p>
                <p className="font-serif text-[12px] text-document-muted italic">
                    {receipt.words}
                </p>
                <p className="receipt-received">
                    ✓ {t('Received')} {dayMonth(receipt.on)} · {receipt.time}
                </p>
            </header>
            <div className="receipt-phone-details">
                <div>
                    <span>{t('Student')}</span>
                    <strong>
                        {student.name}
                        <small>
                            {[student.matricule, student.class]
                                .filter(Boolean)
                                .join(' · ')}
                        </small>
                    </strong>
                </div>
                <div>
                    <span>{t('Paid by')}</span>
                    <span>
                        {t(receipt.method)}
                        {receipt.paid_from && (
                            <small>{receipt.paid_from}</small>
                        )}
                    </span>
                </div>
                {receipt.reference && (
                    <div>
                        <span>{t('Reference')}</span>
                        <span className="font-mono text-[11px] break-all">
                            {receipt.reference}
                        </span>
                    </div>
                )}
                <div>
                    <span>{t('For')}</span>
                    <span>
                        {receipt.covers.map((cover) => (
                            <small key={cover.name}>
                                {t(cover.name)} · {figure(cover.amount)}
                            </small>
                        ))}
                    </span>
                </div>
                <div>
                    <span>{t('Receipt')}</span>
                    <span className="font-mono text-[12px]">
                        {receipt.number}
                    </span>
                </div>
            </div>
            <YearBalance receipt={receipt} currency={currency} />
            <div className="receipt-phone-status">
                <span className="text-document-text">
                    ✓{' '}
                    {t(
                        receipt.state === 'paid'
                            ? 'Paid in full'
                            : 'Part payment',
                    )}
                </span>
                <p>
                    {t('Issued by :school on Campus.', { school: issuer.name })}{' '}
                    {t('Received by')}{' '}
                    {receipt.by ?? t('Mobile money confirmation')}.
                </p>
            </div>
            <Verification receipt={receipt} />
        </article>
    );
}

function ConfirmationLine({
    label,
    children,
}: {
    label: string;
    children: ReactNode;
}) {
    return (
        <div>
            <dt>{label}</dt>
            <dd>{children}</dd>
        </div>
    );
}

function PaymentConfirmation({
    issuer,
    currency,
    receipt,
    student,
}: FeeReceiptProps) {
    return (
        <article
            className="receipt-confirmation"
            aria-label={t('Payment confirmation')}
        >
            <header>
                <div>
                    <h1>{issuer.name}</h1>
                    {issuer.town && <p>{issuer.town}</p>}
                </div>
                <p className="receipt-confirmed">✓ {t('Payment received')}</p>
            </header>
            <div className="receipt-confirmation-title">
                <h2>{t('Payment confirmation')}</h2>
                <p>
                    {t('Receipt')}{' '}
                    <span className="font-mono">{receipt.number}</span>
                </p>
            </div>
            <div className="receipt-confirmation-amount">
                <span>{t('Amount received')}</span>
                <strong>
                    {figure(receipt.amount)} <small>{currency}</small>
                </strong>
            </div>
            <dl className="receipt-confirmation-details">
                <ConfirmationLine label={t('Payment reference')}>
                    <span className="font-mono">
                        {receipt.reference ?? t('Not available')}
                    </span>
                </ConfirmationLine>
                <ConfirmationLine label={t('Date and time')}>
                    {dayMonth(receipt.on)} · {receipt.time}
                </ConfirmationLine>
                <ConfirmationLine label={t('Student')}>
                    {student.name}
                    <small>{student.matricule}</small>
                </ConfirmationLine>
                <ConfirmationLine label={t('Class · year')}>
                    {[student.class, receipt.year].filter(Boolean).join(' · ')}
                </ConfirmationLine>
                <ConfirmationLine label={t('Payment method')}>
                    {t(receipt.method)}
                </ConfirmationLine>
                {receipt.paid_from && (
                    <ConfirmationLine label={t('Paid from')}>
                        <span className="font-mono">{receipt.paid_from}</span>
                    </ConfirmationLine>
                )}
            </dl>
            <section className="receipt-confirmation-covers">
                <h3>{t('This payment covers')}</h3>
                {receipt.covers.map((cover) => (
                    <div key={cover.name}>
                        <span>{t(cover.name)}</span>
                        <span>
                            {figure(cover.amount)} {currency}
                        </span>
                    </div>
                ))}
            </section>
            <footer>
                <p>
                    {t(
                        'Automatically issued after payment confirmation. No signature or school stamp is required.',
                    )}
                </p>
                <Verification receipt={receipt} />
            </footer>
        </article>
    );
}
