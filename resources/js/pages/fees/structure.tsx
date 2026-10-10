import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { bill, structure, updateStructure } from '@/actions/App/Http/Controllers/FeeController';
import { show as schoolSetup } from '@/actions/App/Http/Controllers/SetupController';
import { FeesHeader, amberText, dayMonth, figure } from '../../components/fees/ui';
import { ErrorText, capsLabelClass, outlineButtonClass, solidButtonClass } from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';

interface LevelRow {
    id: string;
    name: string;
    amount: number | null;
    previous: number | null;
    students: number;
    billed: number;
}

interface StructureProps {
    currency: string;
    years?: { id: string; label: string; current: boolean }[];
    year: { id: string; label: string; current: boolean } | null;
    previousLabel?: string | null;
    billingTerm?: string | null;
    installments?: { seq: number; label: string; percent: number; due_on: string | null }[];
    levels?: LevelRow[];
}

const linkClass = 'text-[13px] leading-4 font-medium text-primary hover:underline';

function Structure({ currency, years = [], year, previousLabel, billingTerm, installments = [], levels = [] }: StructureProps) {
    const pageErrors = usePage().props.errors as Record<string, string | undefined>;
    const form = useForm({
        year_id: year?.id ?? '',
        amounts: Object.fromEntries(levels.map((level) => [level.id, level.amount === null ? '' : String(level.amount)])) as Record<string, string>,
    });
    const errors = form.errors as Record<string, string | undefined>;

    if (!year) {
        return (
            <div className="flex flex-col gap-5">
                <Head title="Fee structure" />
                <FeesHeader active="structure" trail={[{ label: 'Fee structure' }]} title="Fee structure" />
                <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                    Fees are set for an academic year, and the school has none
                    open. Add a year in School Setup first.
                </p>
            </div>
        );
    }

    const amountOf = (level: LevelRow): number | null => {
        const raw = form.data.amounts[level.id] ?? '';

        return raw.trim() === '' || Number.isNaN(Number(raw)) ? null : Number(raw);
    };
    const dirty = levels.some((level) => (form.data.amounts[level.id] ?? '') !== (level.amount === null ? '' : String(level.amount)));
    const canCopy = levels.some((level) => level.previous !== null);
    const unbilled = levels.reduce((sum, level) => sum + (level.amount !== null ? level.students - level.billed : 0), 0);
    const expected = levels.reduce((sum, level) => sum + (amountOf(level) ?? 0) * level.students, 0);
    const shares = installments.length > 0 ? installments : [{ seq: 1, label: 'In full', percent: 100, due_on: null }];

    function save() {
        form.transform((data) => ({
            ...data,
            amounts: Object.fromEntries(Object.entries(data.amounts).map(([id, value]) => [id, value.trim() === '' ? null : Number(value)])),
        }));
        form.patch(updateStructure.url(), { preserveScroll: true });
    }

    function copyLastYear() {
        form.setData(
            'amounts',
            Object.fromEntries(
                levels.map((level) => [level.id, level.previous !== null ? String(level.previous) : (form.data.amounts[level.id] ?? '')]),
            ),
        );
    }

    function billStudents(levelId?: string) {
        router.post(bill.url(), { year_id: year?.id, level_id: levelId ?? null }, { preserveScroll: true });
    }

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                save();
            }}
            className="flex min-h-[calc(100vh-56px)] flex-col gap-5"
        >
            <Head title="Fee structure" />
            <FeesHeader
                active="structure"
                trail={[{ label: 'Fee structure' }]}
                title="Fee structure"
                tag={year.label}
                meta="what each level costs for the year, and who is billed"
                action={
                    <div className="flex flex-wrap gap-2">
                        {canCopy && (
                            <button type="button" onClick={copyLastYear} className={outlineButtonClass}>
                                Copy {previousLabel} fees
                            </button>
                        )}
                        <button type="submit" disabled={!dirty || form.processing} className={solidButtonClass}>
                            Save fees
                        </button>
                    </div>
                }
            />

            {years.length > 1 && (
                <div className="flex flex-wrap gap-2">
                    {years.map((option) => (
                        <Link
                            key={option.id}
                            href={structure.url({ query: { year: option.id } })}
                            aria-current={option.id === year.id ? 'page' : undefined}
                            className={`flex h-8 items-center gap-[6px] rounded-full border border-solid px-[14px] text-[13px] leading-4 ${
                                option.id === year.id
                                    ? 'border-primary bg-primary-tint font-semibold text-primary'
                                    : 'border-border font-medium text-text hover:bg-surface'
                            }`}
                        >
                            {option.label}
                            <span className="text-[12px] font-normal text-text-muted">{option.current ? 'this year' : 'planned'}</span>
                        </Link>
                    ))}
                </div>
            )}

            <div className="flex flex-1 flex-col gap-7 lg:flex-row">
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                    <p className={capsLabelClass}>Annual fees by level · {year.label}</p>
                    {levels.length === 0 ? (
                        <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                            The school has no levels yet. Add them under
                            Classes &amp; Subjects, then set a fee for each.
                        </p>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-solid border-border">
                            <div className="flex min-w-[640px] flex-col">
                                <div className={`flex h-9 items-center gap-4 border-b border-solid border-border bg-surface px-4 ${capsLabelClass}`}>
                                    <span className="w-[120px] shrink-0">Level</span>
                                    <span className="w-[150px] shrink-0">Annual fee</span>
                                    {shares.map((share) => (
                                        <span key={share.seq} className="min-w-[70px] flex-1 text-right">
                                            {share.label}
                                        </span>
                                    ))}
                                    <span className="w-[150px] shrink-0 text-right">Billed</span>
                                </div>
                                {levels.map((level, position) => {
                                    const amount = amountOf(level);
                                    const waiting = level.amount !== null ? level.students - level.billed : 0;
                                    const error = errors[`amounts.${level.id}`];

                                    return (
                                        <div
                                            key={level.id}
                                            className={`flex min-h-[52px] shrink-0 items-center gap-4 border-b border-solid border-border px-4 py-2 last:border-b-0 ${position % 2 === 1 ? 'bg-row-alt' : ''}`}
                                        >
                                            <span className="w-[120px] shrink-0 truncate text-[14px] leading-[18px] font-medium text-text">{level.name}</span>
                                            <span className="flex w-[150px] shrink-0 flex-col gap-1">
                                                <span className={`flex h-9 items-center gap-2 rounded-md border border-solid bg-white px-[10px] focus-within:border-primary ${error ? 'border-danger' : 'border-border'}`}>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        aria-label={`Annual fee for ${level.name}`}
                                                        value={form.data.amounts[level.id] ?? ''}
                                                        onChange={(e) =>
                                                            form.setData('amounts', {
                                                                ...form.data.amounts,
                                                                [level.id]: e.target.value.replace(/[^\d.]/g, ''),
                                                            })
                                                        }
                                                        placeholder="Not set"
                                                        className="w-full min-w-0 bg-transparent font-mono text-[14px] leading-[18px] text-text outline-none placeholder:font-sans placeholder:text-[13px] placeholder:text-text-muted"
                                                    />
                                                    <span className="shrink-0 text-[12px] leading-4 text-text-muted">{currency}</span>
                                                </span>
                                                <ErrorText message={error} />
                                            </span>
                                            {shares.map((share) => (
                                                <span key={share.seq} className="min-w-[70px] flex-1 text-right font-mono text-[13px] leading-4 text-text-muted">
                                                    {amount !== null ? figure(Math.round((amount * share.percent) / 100)) : '—'}
                                                </span>
                                            ))}
                                            <span className="flex w-[150px] shrink-0 flex-col items-end gap-[2px]">
                                                <span className="font-mono text-[13px] leading-4 text-text">
                                                    {level.billed} of {level.students}
                                                </span>
                                                {waiting > 0 && year.current && (
                                                    <button type="button" onClick={() => billStudents(level.id)} className={linkClass}>
                                                        Bill {waiting} now
                                                    </button>
                                                )}
                                                {level.amount === null && level.students > 0 && (
                                                    <span className={`text-[12px] leading-4 ${amberText}`}>No fee, not billed</span>
                                                )}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    <ErrorText message={errors.year_id ?? pageErrors.bill} />
                    <p className="text-[13px] leading-[19px] text-text-muted">
                        With these fees and today’s enrolment, the school would
                        bill {figure(expected)} {currency} for {year.label}. Changing
                        a fee does not change invoices already issued; it
                        applies to students billed from now on.
                    </p>
                </div>

                <aside className="flex shrink-0 flex-col gap-4 border-solid border-border lg:w-[320px] lg:border-l lg:pl-7">
                    <div className="flex flex-col gap-3 rounded-lg border border-solid border-border bg-surface p-4">
                        <div className="flex items-baseline justify-between">
                            <p className={capsLabelClass}>Installments</p>
                            <Link href={schoolSetup.url()} className={linkClass}>
                                Edit in School Setup
                            </Link>
                        </div>
                        {installments.length === 0 ? (
                            <p className="text-[13px] leading-[19px] text-text">
                                {year.label} has no installments, so each
                                invoice is one amount due the day it is issued.
                            </p>
                        ) : (
                            <ul className="flex flex-col">
                                {installments.map((installment) => (
                                    <li key={installment.seq} className="flex items-center justify-between border-t border-solid border-border py-2 first:border-t-0 first:pt-0">
                                        <span className="text-[13px] leading-4 text-text">
                                            {installment.label} · {installment.percent}%
                                        </span>
                                        <span className="font-mono text-[12px] leading-4 text-text-muted">
                                            due {dayMonth(installment.due_on)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="flex flex-col gap-[10px] rounded-lg border border-solid border-border bg-white p-4">
                        <p className="text-[14px] leading-[18px] font-semibold text-text">Billing students</p>
                        {year.current ? (
                            <>
                                <p className="text-[13px] leading-[19px] text-text-muted">
                                    {unbilled > 0
                                        ? `${unbilled} enrolled ${unbilled === 1 ? 'student has' : 'students have'} a fee set and no invoice yet.`
                                        : 'Every enrolled student in a level with a fee has an invoice.'}{' '}
                                    {billingTerm ? `Invoices are issued against ${billingTerm}.` : 'The year has no term to bill against yet.'}
                                </p>
                                {unbilled > 0 && (
                                    <button type="button" disabled={dirty} onClick={() => billStudents()} className={solidButtonClass}>
                                        Bill {unbilled} {unbilled === 1 ? 'student' : 'students'}
                                    </button>
                                )}
                                {dirty && unbilled > 0 && (
                                    <p className={`text-[12px] leading-[17px] ${amberText}`}>Save the fees first, so students are billed the new amounts.</p>
                                )}
                            </>
                        ) : (
                            <p className="text-[13px] leading-[19px] text-text-muted">
                                {year.label} is not active yet. Its students are
                                billed when enrolment is confirmed, on the fees
                                set here.
                            </p>
                        )}
                    </div>

                    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-4">
                        <p className="text-[13px] leading-4 font-semibold text-text">New students</p>
                        <p className="text-[13px] leading-[19px] text-text-muted">
                            A student registered after this is billed
                            automatically, on the fee of the level they join.
                        </p>
                    </div>
                </aside>
            </div>
        </form>
    );
}

export default withAppShell(Structure);
