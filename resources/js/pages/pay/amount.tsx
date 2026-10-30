import { Form, Head } from '@inertiajs/react';
import { useState } from 'react';
import { home } from '@/actions/App/Http/Controllers/ParentController';
import { chooseAmount } from '@/actions/App/Http/Controllers/PayController';
import {
    ChildSummary,
    PayHeading,
    PayShell,
    francs,
    payButtonClass,
    payInputClass,
    type ChildCard,
    type Issuer,
} from '../../components/pay/ui';
import { useT } from '../../lib/i18n';

interface AmountOption {
    key: string;
    amount: number;
    label: string;
    detail: string | null;
    late: boolean;
}

interface AmountProps {
    issuer: Issuer;
    student: ChildCard;
    balance: number;
    overdue: number;
    options: AmountOption[];
    chosen: number | null;
}

export default function ChooseAmount({
    issuer,
    student,
    balance,
    overdue,
    options,
    chosen,
}: AmountProps) {
    const t = useT();
    const preset =
        options.find((option) => option.amount === chosen) ??
        (chosen ? null : options[0]);
    const [picked, setPicked] = useState<string>(preset ? preset.key : 'other');
    const [other, setOther] = useState(chosen && !preset ? String(chosen) : '');
    const amount =
        picked === 'other'
            ? Number(other.replace(/\D/g, '')) || 0
            : (options.find((option) => option.key === picked)?.amount ?? 0);

    return (
        <PayShell issuer={issuer} step={1} back={home.url()}>
            <Head title={`${t('How much to pay')} — ${issuer.name}`} />
            <ChildSummary student={student} />
            {balance <= 0 ? (
                <div className="flex flex-col gap-2 rounded-xl border border-solid border-success bg-success-tint px-4 py-4">
                    <p className="text-[16px] font-semibold text-success">
                        {t('Nothing is owed')}
                    </p>
                    <p className="text-[14px] text-text">
                        {t(
                            ':name’s fees are fully paid for now. There is nothing to pay.',
                            { name: student.name },
                        )}
                    </p>
                </div>
            ) : (
                <>
                    <PayHeading
                        title={t('How much to pay')}
                        sub={
                            overdue > 0
                                ? t(
                                      ':amount is overdue, out of :balance still owed this year.',
                                      {
                                          amount: francs(overdue),
                                          balance: francs(balance),
                                      },
                                  )
                                : t(':balance is still owed this year.', {
                                      balance: francs(balance),
                                  })
                        }
                    />
                    {balance % 1 !== 0 && (
                        <p className="text-[14px] text-text-muted">
                            {t(
                                'Mobile payments use whole francs. Please settle any fractional balance at school.',
                            )}
                        </p>
                    )}
                    <Form
                        action={chooseAmount.url()}
                        method="post"
                        className="flex flex-col gap-3"
                    >
                        {({ errors, processing }) => (
                            <>
                                <input
                                    type="hidden"
                                    name="amount"
                                    value={amount || ''}
                                />
                                {options.map((option) => (
                                    <label
                                        key={option.key}
                                        className={`flex cursor-pointer items-center gap-3 rounded-xl border border-solid bg-white px-4 py-3 ${
                                            picked === option.key
                                                ? 'border-primary ring-1 ring-primary'
                                                : 'border-border'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="choice"
                                            checked={picked === option.key}
                                            onChange={() =>
                                                setPicked(option.key)
                                            }
                                            className="h-4 w-4 accent-primary"
                                        />
                                        <span className="flex min-w-0 flex-1 flex-col">
                                            <span className="text-[15px] leading-5 font-semibold">
                                                {option.label}
                                            </span>
                                            {option.detail && (
                                                <span
                                                    className={`text-[13px] leading-[18px] ${option.late ? 'text-danger' : 'text-text-muted'}`}
                                                >
                                                    {option.detail}
                                                </span>
                                            )}
                                        </span>
                                        <span className="shrink-0 font-mono text-[15px] font-semibold">
                                            {francs(option.amount)}
                                        </span>
                                    </label>
                                ))}
                                <label
                                    className={`flex cursor-pointer flex-col gap-3 rounded-xl border border-solid bg-white px-4 py-3 ${
                                        picked === 'other'
                                            ? 'border-primary ring-1 ring-primary'
                                            : 'border-border'
                                    }`}
                                >
                                    <span className="flex items-center gap-3">
                                        <input
                                            type="radio"
                                            name="choice"
                                            checked={picked === 'other'}
                                            onChange={() => setPicked('other')}
                                            className="h-4 w-4 accent-primary"
                                        />
                                        <span className="text-[15px] leading-5 font-semibold">
                                            {t('Another amount')}
                                        </span>
                                    </span>
                                    {picked === 'other' && (
                                        <span className="flex items-center gap-2">
                                            <input
                                                inputMode="numeric"
                                                value={other}
                                                onChange={(event) =>
                                                    setOther(event.target.value)
                                                }
                                                placeholder="10000"
                                                aria-label={t('Amount in FCFA')}
                                                className={`${payInputClass} font-mono`}
                                            />
                                            <span className="shrink-0 text-[14px] text-text-muted">
                                                FCFA
                                            </span>
                                        </span>
                                    )}
                                </label>
                                {errors.amount && (
                                    <p className="text-[13px] text-danger">
                                        {errors.amount}
                                    </p>
                                )}
                                <button
                                    type="submit"
                                    disabled={
                                        processing ||
                                        amount < 1 ||
                                        amount > balance
                                    }
                                    className={`${payButtonClass} mt-2`}
                                >
                                    {amount > 0
                                        ? t('Continue with :amount', {
                                              amount: francs(amount),
                                          })
                                        : t('Continue')}
                                </button>
                            </>
                        )}
                    </Form>
                </>
            )}
        </PayShell>
    );
}
