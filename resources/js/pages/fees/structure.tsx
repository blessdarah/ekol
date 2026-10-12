import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { bill, structure, updateStructure } from '@/actions/App/Http/Controllers/FeeController';
import { show as schoolSetup } from '@/actions/App/Http/Controllers/SetupController';
import { FeesHeader, amberText, dayMonth, figure } from '../../components/fees/ui';
import { ErrorText, PlusIcon, capsLabelClass, outlineButtonClass, solidButtonClass } from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';

interface ItemRow {
    id: string;
    name: string;
    spread: boolean;
    new_only: boolean;
    amounts: Record<string, number>;
    billed: number;
    collected: number;
}

interface LevelRow {
    id: string;
    name: string;
    has_fee: boolean;
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
    items?: ItemRow[];
    previousItems?: ItemRow[];
    levels?: LevelRow[];
}

interface ItemDraft {
    /** Stable in the browser; the server only knows `id`. */
    key: string;
    id: string | null;
    name: string;
    spread: boolean;
    new_only: boolean;
    amounts: Record<string, string>;
}

interface StructureForm {
    year_id: string;
    items: ItemDraft[];
}

const linkClass = 'text-[13px] leading-4 font-medium text-primary hover:underline';

const selectClass =
    'h-9 min-w-0 rounded-md border border-solid border-border bg-white px-2 text-[13px] leading-4 text-text outline-none focus:border-primary';

const moveClass =
    'flex h-[17px] w-6 items-center justify-center rounded-sm text-[10px] leading-none text-text-muted hover:bg-surface hover:text-text disabled:opacity-30 disabled:hover:bg-transparent';

function draft(item: ItemRow, keepId: boolean): ItemDraft {
    return {
        key: keepId ? item.id : `copy-${item.id}`,
        id: keepId ? item.id : null,
        name: item.name,
        spread: item.spread,
        new_only: item.new_only,
        amounts: Object.fromEntries(Object.entries(item.amounts).map(([level, amount]) => [level, String(amount)])),
    };
}

/** What the server would see for a draft, to tell whether anything changed. */
function fingerprint(items: ItemDraft[]): string {
    return JSON.stringify(
        items.map((item) => [
            item.id,
            item.name.trim(),
            item.spread,
            item.new_only,
            Object.entries(item.amounts)
                .filter(([, amount]) => Number(amount) > 0)
                .map(([level, amount]) => [level, Number(amount)])
                .sort(([a], [b]) => String(a).localeCompare(String(b))),
        ]),
    );
}

function StructureForm({
    currency,
    years = [],
    year,
    previousLabel,
    billingTerm,
    installments = [],
    items = [],
    previousItems = [],
    levels = [],
}: StructureProps) {
    const pageErrors = usePage().props.errors as Record<string, string | undefined>;
    const saved = items.map((item) => draft(item, true));
    const form = useForm<StructureForm>({ year_id: year?.id ?? '', items: saved });
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

    const drafts = form.data.items;
    const dirty = fingerprint(drafts) !== fingerprint(saved);
    const amountOf = (item: ItemDraft, levelId: string): number => {
        const value = Number(item.amounts[levelId] ?? '');

        return Number.isFinite(value) && value > 0 ? value : 0;
    };
    const totalOf = (levelId: string, forNew: boolean): number =>
        drafts.reduce((sum, item) => sum + (item.new_only && !forNew ? 0 : amountOf(item, levelId)), 0);
    /** Which levels pay an item, when it is not all of them. */
    const payers = (item: ItemDraft): string | null => {
        const paying = levels.filter((level) => amountOf(item, level.id) > 0).map((level) => level.name);

        if (levels.length === 0 || paying.length === levels.length) {
            return null;
        }

        return paying.length === 0
            ? 'No level pays this yet. Enter its amounts below.'
            : `Only ${paying.length === 1 ? paying[0] : `${paying.slice(0, -1).join(', ')} and ${paying[paying.length - 1]}`} ${paying.length === 1 ? 'pays' : 'pay'} this.`;
    };
    const unbilled = levels.reduce((sum, level) => sum + (level.has_fee ? level.students - level.billed : 0), 0);
    const expected = levels.reduce((sum, level) => sum + totalOf(level.id, false) * level.students, 0);
    const hasNewOnly = drafts.some((item) => item.new_only);
    const hasUpfront = drafts.some((item) => !item.spread);

    function setItems(next: ItemDraft[]) {
        form.setData('items', next);
    }

    function change(key: string, patch: Partial<ItemDraft>) {
        setItems(drafts.map((item) => (item.key === key ? { ...item, ...patch } : item)));
    }

    function move(position: number, by: number) {
        const next = [...drafts];
        const [item] = next.splice(position, 1);

        next.splice(position + by, 0, item);
        setItems(next);
    }

    function add() {
        setItems([
            ...drafts,
            { key: `new-${Date.now()}`, id: null, name: drafts.length === 0 ? 'School fees' : '', spread: drafts.length === 0, new_only: false, amounts: {} },
        ]);
    }

    function save() {
        form.transform((data) => ({
            year_id: data.year_id,
            items: data.items.map((item) => ({
                id: item.id,
                name: item.name,
                spread: item.spread,
                new_only: item.new_only,
                amounts: Object.fromEntries(
                    Object.entries(item.amounts).map(([level, amount]) => [level, amount.trim() === '' ? null : Number(amount)]),
                ),
            })),
        }));
        form.patch(updateStructure.url(), { preserveScroll: true });
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
            className="flex lg:min-h-[calc(100vh-56px)] flex-col gap-5"
        >
            <Head title="Fee structure" />
            <FeesHeader
                active="structure"
                trail={[{ label: 'Fee structure' }]}
                title="Fee structure"
                tag={year.label}
                meta="what the school charges for the year, level by level, and who is billed"
                action={
                    <div className="flex flex-wrap gap-2">
                        {previousItems.length > 0 && (
                            <button type="button" onClick={() => setItems(previousItems.map((item) => draft(item, false)))} className={outlineButtonClass}>
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
                <div className="flex min-w-0 flex-1 flex-col gap-7">
                    <section className="flex flex-col gap-3">
                        <p className={capsLabelClass}>What the school charges · {year.label}</p>
                        <div className="flex flex-col rounded-lg border border-solid border-border">
                            {drafts.length === 0 && (
                                <p className="p-4 text-[13px] leading-[19px] text-text">
                                    Nothing is charged for {year.label} yet. Add
                                    school fees first, then anything else
                                    parents pay: the PTA contribution,
                                    registration, exam fees.
                                </p>
                            )}
                            {drafts.map((item, position) => {
                                const before = items.find((row) => row.id === item.id);
                                const error = errors[`items.${position}.name`];

                                return (
                                    <div key={item.key} className="flex flex-col gap-1 border-b border-solid border-border px-3 py-[10px]">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="flex shrink-0 flex-col">
                                                <button type="button" aria-label={`Move ${item.name || 'item'} up`} disabled={position === 0} onClick={() => move(position, -1)} className={moveClass}>
                                                    ▲
                                                </button>
                                                <button type="button" aria-label={`Move ${item.name || 'item'} down`} disabled={position === drafts.length - 1} onClick={() => move(position, 1)} className={moveClass}>
                                                    ▼
                                                </button>
                                            </span>
                                            <span className="w-5 shrink-0 text-center font-mono text-[12px] leading-4 text-text-muted">{position + 1}</span>
                                            <input
                                                type="text"
                                                aria-label={`Name of item ${position + 1}`}
                                                value={item.name}
                                                maxLength={40}
                                                onChange={(e) => change(item.key, { name: e.target.value })}
                                                placeholder="e.g. PTA contribution"
                                                className={`h-9 min-w-[160px] flex-1 rounded-md border border-solid bg-white px-[10px] text-[14px] leading-[18px] font-medium text-text outline-none placeholder:font-normal placeholder:text-text-muted focus:border-primary ${error ? 'border-danger' : 'border-border'}`}
                                            />
                                            <select
                                                aria-label={`How ${item.name || 'the item'} is paid`}
                                                value={item.spread ? 'spread' : 'upfront'}
                                                onChange={(e) => change(item.key, { spread: e.target.value === 'spread' })}
                                                className={selectClass}
                                            >
                                                <option value="spread">Spread over the installments</option>
                                                <option value="upfront">In full with the 1st installment</option>
                                            </select>
                                            <select
                                                aria-label={`Who pays ${item.name || 'the item'}`}
                                                value={item.new_only ? 'new' : 'all'}
                                                onChange={(e) => change(item.key, { new_only: e.target.value === 'new' })}
                                                className={selectClass}
                                            >
                                                <option value="all">Every student</option>
                                                <option value="new">New students only</option>
                                            </select>
                                            <button type="button" onClick={() => setItems(drafts.filter((other) => other.key !== item.key))} className={`${linkClass} shrink-0 px-1`}>
                                                Remove
                                            </button>
                                        </div>
                                        <ErrorText message={error} />
                                        {payers(item) && <p className="pl-[58px] text-[12px] leading-4 text-text-muted">{payers(item)}</p>}
                                        {before && before.billed > 0 && (
                                            <p className="pl-[58px] font-mono text-[12px] leading-4 text-text-muted">
                                                {figure(before.collected)} collected of {figure(before.billed)} billed
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                            <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-[10px]">
                                <button type="button" onClick={add} disabled={drafts.length >= 12} className={`flex items-center gap-[6px] ${linkClass} disabled:opacity-40`}>
                                    <PlusIcon />
                                    Add an item
                                </button>
                                {drafts.length > 1 && (
                                    <span className="text-[12px] leading-[17px] text-text-muted">
                                        A parent’s money goes to item 1 first, then item 2, and so on.
                                    </span>
                                )}
                            </div>
                        </div>
                        <ErrorText message={errors.items} />
                    </section>

                    <section className="flex flex-col gap-3">
                        <p className={capsLabelClass}>Amount by level · {currency}</p>
                        {levels.length === 0 ? (
                            <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                                The school has no levels yet. Add them under
                                Classes &amp; Subjects, then set what each pays.
                            </p>
                        ) : drafts.length === 0 ? (
                            <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                                Add an item above to set what each level pays for it.
                            </p>
                        ) : (
                            <div className="overflow-x-auto rounded-lg border border-solid border-border">
                                <div className="flex w-max min-w-full flex-col">
                                    <div className={`flex min-h-9 items-center gap-3 border-b border-solid border-border bg-surface px-4 py-2 ${capsLabelClass}`}>
                                        <span className="w-[84px] shrink-0">Level</span>
                                        {drafts.map((item) => (
                                            <span key={item.key} className="w-24 shrink-0 truncate" title={item.name}>
                                                {item.name.trim() || 'Unnamed'}
                                            </span>
                                        ))}
                                        <span className="min-w-24 flex-1 text-right">Total</span>
                                        <span className="w-24 shrink-0 text-right">Billed</span>
                                    </div>
                                    {levels.map((level, position) => {
                                        const total = totalOf(level.id, false);
                                        const forNew = totalOf(level.id, true);
                                        const waiting = level.has_fee ? level.students - level.billed : 0;

                                        return (
                                            <div
                                                key={level.id}
                                                className={`flex min-h-[52px] shrink-0 items-start gap-3 border-b border-solid border-border px-4 py-2 last:border-b-0 ${position % 2 === 1 ? 'bg-row-alt' : ''}`}
                                            >
                                                <span className="flex h-9 w-[84px] shrink-0 items-center truncate text-[14px] leading-[18px] font-medium text-text">{level.name}</span>
                                                {drafts.map((item, column) => {
                                                    const error = errors[`items.${column}.amounts.${level.id}`];

                                                    return (
                                                        <span key={item.key} className="flex w-24 shrink-0 flex-col gap-1">
                                                            <input
                                                                type="text"
                                                                inputMode="numeric"
                                                                aria-label={`${item.name || 'Item'} for ${level.name}`}
                                                                value={item.amounts[level.id] ?? ''}
                                                                onChange={(e) =>
                                                                    change(item.key, {
                                                                        amounts: { ...item.amounts, [level.id]: e.target.value.replace(/[^\d.]/g, '') },
                                                                    })
                                                                }
                                                                placeholder="—"
                                                                className={`h-9 w-full rounded-md border border-solid bg-white px-[10px] text-right font-mono text-[14px] leading-[18px] text-text outline-none placeholder:text-text-muted focus:border-primary ${error ? 'border-danger' : 'border-border'}`}
                                                            />
                                                            <ErrorText message={error} />
                                                        </span>
                                                    );
                                                })}
                                                <span className="flex min-h-9 min-w-24 flex-1 flex-col items-end justify-center gap-[2px] whitespace-nowrap">
                                                    <span className="font-mono text-[14px] leading-[18px] font-medium text-text">{total > 0 || forNew > 0 ? figure(total) : '—'}</span>
                                                    {forNew > total && (
                                                        <span className="font-mono text-[12px] leading-4 text-text-muted">{figure(forNew)} if new</span>
                                                    )}
                                                </span>
                                                <span className="flex min-h-9 w-24 shrink-0 flex-col items-end justify-center gap-[2px] text-right">
                                                    <span className="font-mono text-[13px] leading-4 text-text">
                                                        {level.billed} of {level.students}
                                                    </span>
                                                    {waiting > 0 && year.current && !dirty && (
                                                        <button type="button" onClick={() => billStudents(level.id)} className={linkClass}>
                                                            Bill {waiting} now
                                                        </button>
                                                    )}
                                                    {!level.has_fee && level.students > 0 && (
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
                            Leave an amount empty when a level does not pay
                            the item, so that mock exam fees, say, are charged
                            to the exam classes alone. With these fees and today’s enrolment,
                            the school would bill {figure(expected)} {currency} for {year.label}
                            {hasNewOnly ? ', before what new students pay on top' : ''}. Changing
                            the fees does not change invoices already issued;
                            it applies to students billed from now on.
                        </p>
                    </section>
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
                            <>
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
                                <p className="text-[12px] leading-[17px] text-text-muted">
                                    The percentages apply to items spread over
                                    the installments.
                                    {hasUpfront ? ' Items paid in full are added to the 1st installment.' : ''}
                                </p>
                            </>
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
                            automatically, on the items of the level they
                            join. A student is new in their first year at the
                            school, and only then pays the items marked for
                            new students.
                        </p>
                    </div>
                </aside>
            </div>
        </form>
    );
}

/** Remount on what the server holds, so a save resets the draft to it. */
function Structure(props: StructureProps) {
    return <StructureForm key={`${props.year?.id ?? ''}|${JSON.stringify(props.items ?? [])}`} {...props} />;
}

export default withAppShell(Structure);
