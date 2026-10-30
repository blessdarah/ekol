import { router } from '@inertiajs/react';
import { useState } from 'react';
import {
    activateTerm,
    activateYear,
    show,
    storeYear,
    updateTerms,
    updateYear,
} from '@/actions/App/Http/Controllers/SetupController';
import { t } from '../../lib/i18n';
import {
    type TermProp,
    type YearProp,
    weeksBetween,
    dateInputClass,
    shortDate,
    useAutosave,
    addDays,
    Zone,
    longDate,
    linkClass,
    ZoneError,
} from './shared';

export function TermCard({
    term,
    year,
    active,
    onChange,
    onActivate,
}: {
    term: TermProp;
    year: YearProp;
    active: boolean;
    onChange: (patch: Partial<TermProp>) => void;
    onActivate: () => void;
}) {
    const [editing, setEditing] = useState(false);
    const locked = !!term.has_marks;

    function setDates(patch: { starts_on?: string; ends_on?: string }) {
        const next = { ...term, ...patch };

        if (!next.starts_on || !next.ends_on) {
            return;
        }

        onChange({
            ...patch,
            week_count: weeksBetween(next.starts_on, next.ends_on),
        });
    }

    return (
        <div
            className={`flex flex-col gap-[6px] rounded-md border border-solid p-[14px] ${
                active ? 'border-primary bg-primary' : 'border-border'
            }`}
        >
            <div className="flex items-center justify-between">
                <span
                    className={`text-[14px] leading-[18px] font-semibold ${active ? 'text-white' : 'text-text'}`}
                >
                    {t(term.label)}
                </span>
                {active ? (
                    <span className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-success-on-dark uppercase">
                        {t('Active')}
                    </span>
                ) : (
                    term.id &&
                    year.status === 'current' && (
                        <button
                            type="button"
                            onClick={onActivate}
                            className="text-[12px] leading-4 font-medium text-primary hover:underline"
                        >
                            {t('Set active')}
                        </button>
                    )
                )}
            </div>
            {editing ? (
                <div className="flex flex-wrap items-center gap-1">
                    <input
                        type="text"
                        aria-label={t('Term name')}
                        value={term.label}
                        onChange={(e) => onChange({ label: e.target.value })}
                        className={`${dateInputClass} w-full font-sans`}
                    />
                    <input
                        type="date"
                        aria-label={t(':label starts', { label: term.label })}
                        value={term.starts_on}
                        min={year.starts_on}
                        max={year.ends_on}
                        onChange={(e) =>
                            setDates({ starts_on: e.target.value })
                        }
                        className={dateInputClass}
                    />
                    <input
                        type="date"
                        aria-label={t(':label ends', { label: term.label })}
                        value={term.ends_on}
                        min={term.starts_on}
                        max={year.ends_on}
                        onChange={(e) => setDates({ ends_on: e.target.value })}
                        className={dateInputClass}
                    />
                    <button
                        type="button"
                        onClick={() => setEditing(false)}
                        className={`text-[12px] leading-4 font-medium hover:underline ${active ? 'text-white' : 'text-primary'}`}
                    >
                        {t('Done')}
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    disabled={locked}
                    title={
                        locked
                            ? t(
                                  'This term already has marks, so its dates are locked.',
                              )
                            : t('Edit term')
                    }
                    onClick={() => setEditing(true)}
                    className={`self-start font-mono text-[12px] leading-4 enabled:hover:underline disabled:cursor-not-allowed ${active ? 'text-primary-outline' : 'text-text-muted'}`}
                >
                    {shortDate(term.starts_on)} – {shortDate(term.ends_on)}
                    {locked && t(' · locked')}
                </button>
            )}
        </div>
    );
}

export function YearZone({
    years,
    year,
    terms,
}: {
    years: YearProp[];
    year: YearProp | null;
    terms: TermProp[];
}) {
    const yearQuery = year ? { query: { year: year.id } } : undefined;
    const { data, save, error } = useAutosave(
        updateTerms.url(yearQuery),
        { terms },
        (props) => ({ terms: props.terms }),
    );
    const [mode, setMode] = useState<'create' | 'edit' | null>(null);
    const [draft, setDraft] = useState({
        label: '',
        starts_on: '',
        ends_on: '',
    });
    const [actionError, setActionError] = useState<string | null>(null);

    function setTerm(index: number, patch: Partial<TermProp>) {
        save({
            terms: data.terms.map((term, i) =>
                i === index ? { ...term, ...patch } : term,
            ),
        });
    }

    function addTerm() {
        if (!year) {
            return;
        }

        const last = data.terms[data.terms.length - 1];
        const startsOn =
            last && last.ends_on < year.ends_on
                ? addDays(last.ends_on, 1)
                : year.starts_on;
        const sequence =
            Math.max(0, ...data.terms.map((term) => term.sequence)) + 1;

        save({
            terms: [
                ...data.terms,
                {
                    label: t('Term :sequence', { sequence }),
                    sequence,
                    starts_on: startsOn,
                    ends_on: year.ends_on,
                    week_count: weeksBetween(startsOn, year.ends_on),
                },
            ],
        });
    }

    function activate(term: TermProp) {
        if (!term.id) {
            return;
        }

        router.patch(
            activateTerm.url(term.id),
            {},
            {
                preserveState: true,
                preserveScroll: true,
                onSuccess: () => setActionError(null),
                onError: (failed) =>
                    setActionError(Object.values(failed)[0] ?? null),
            },
        );
    }

    function openForm(next: 'create' | 'edit') {
        setDraft(
            next === 'edit' && year
                ? {
                      label: year.label,
                      starts_on: year.starts_on,
                      ends_on: year.ends_on,
                  }
                : { label: '', starts_on: '', ends_on: '' },
        );
        setActionError(null);
        setMode(next);
    }

    function submitYear() {
        const options = {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                setMode(null);
                setActionError(null);
            },
            onError: (failed: Record<string, string>) =>
                setActionError(Object.values(failed)[0] ?? null),
        };

        if (mode === 'edit' && year) {
            router.patch(updateYear.url(year.id), draft, options);
        } else {
            router.post(storeYear.url(), draft, options);
        }
    }

    function makeYearActive() {
        if (!year) {
            return;
        }

        router.patch(
            activateYear.url(year.id),
            {},
            {
                preserveScroll: true,
                onError: (failed) =>
                    setActionError(Object.values(failed)[0] ?? null),
            },
        );
    }

    return (
        <Zone
            title={t('Academic year & terms')}
            desc={t(
                'The active term decides where marks, attendance and fees are recorded.',
            )}
        >
            <div className="flex flex-wrap items-center gap-[10px]">
                {year && (
                    <span className="relative flex">
                        <select
                            aria-label={t('Academic year')}
                            value={year.id}
                            onChange={(e) =>
                                router.get(
                                    show.url({
                                        query: { year: e.target.value },
                                    }),
                                )
                            }
                            className="h-[34px] appearance-none rounded-md border border-solid border-border bg-white pr-8 pl-3 font-mono text-[14px] leading-[18px] text-text outline-none focus:border-primary"
                        >
                            {years.map((option) => (
                                <option key={option.id} value={option.id}>
                                    {t(option.label)}
                                </option>
                            ))}
                        </select>
                        <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
                        >
                            <path
                                d="M6 9l6 6 6-6"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                className="text-text-muted"
                            />
                        </svg>
                    </span>
                )}
                <span className="text-[13px] leading-4 text-text-muted">
                    {year
                        ? `${longDate(year.starts_on)} – ${longDate(year.ends_on)}`
                        : t('No academic year yet.')}
                </span>
                {year?.status === 'current' && (
                    <span className="flex h-6 items-center gap-[6px] rounded-full bg-primary-tint px-[10px] text-[12px] leading-4 font-medium text-primary">
                        <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-primary" />
                        {t('Active')}
                    </span>
                )}
                <span className="flex-1" />
                {!mode && (
                    <span className="flex items-center gap-4">
                        {year && year.status !== 'current' && (
                            <button
                                type="button"
                                onClick={makeYearActive}
                                className={linkClass}
                            >
                                {t('Set active')}
                            </button>
                        )}
                        {year && (
                            <button
                                type="button"
                                onClick={() => openForm('edit')}
                                className={linkClass}
                            >
                                {t('Edit year')}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => openForm('create')}
                            className={linkClass}
                        >
                            {t('+ New academic year')}
                        </button>
                    </span>
                )}
            </div>
            {mode && (
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        type="text"
                        aria-label={t('Year label')}
                        placeholder="2026/27"
                        value={draft.label}
                        onChange={(e) =>
                            setDraft({ ...draft, label: e.target.value })
                        }
                        className="h-[34px] w-24 rounded-md border border-solid border-border px-3 font-mono text-[14px] text-text outline-none focus:border-primary"
                    />
                    <input
                        type="date"
                        aria-label={t('Year starts')}
                        value={draft.starts_on}
                        onChange={(e) =>
                            setDraft({ ...draft, starts_on: e.target.value })
                        }
                        className={`${dateInputClass} h-[34px] rounded-md px-2`}
                    />
                    <input
                        type="date"
                        aria-label={t('Year ends')}
                        value={draft.ends_on}
                        min={draft.starts_on}
                        onChange={(e) =>
                            setDraft({ ...draft, ends_on: e.target.value })
                        }
                        className={`${dateInputClass} h-[34px] rounded-md px-2`}
                    />
                    <button
                        type="button"
                        onClick={submitYear}
                        disabled={
                            !draft.label || !draft.starts_on || !draft.ends_on
                        }
                        className="h-[34px] rounded-md bg-primary px-3 text-[13px] font-medium text-white hover:bg-primary-hover disabled:opacity-40"
                    >
                        {mode === 'edit' ? t('Save year') : t('Create year')}
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode(null)}
                        className="px-1 text-[13px] font-medium text-text-muted hover:underline"
                    >
                        {t('Cancel')}
                    </button>
                </div>
            )}
            {year && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {data.terms.map((term, index) => (
                        <TermCard
                            key={term.id ?? `new-${index}`}
                            term={term}
                            year={year}
                            active={
                                !!terms.find((saved) => saved.id === term.id)
                                    ?.is_current
                            }
                            onChange={(patch) => setTerm(index, patch)}
                            onActivate={() => activate(term)}
                        />
                    ))}
                    {data.terms.length < 3 && (
                        <button
                            type="button"
                            onClick={addTerm}
                            className="flex min-h-[70px] items-center justify-center rounded-md border border-dashed border-border text-[13px] font-medium text-primary hover:bg-surface"
                        >
                            {t('+ Add term')}
                        </button>
                    )}
                </div>
            )}
            <ZoneError message={actionError ?? error} />
        </Zone>
    );
}
