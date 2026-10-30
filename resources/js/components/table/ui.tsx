import { router } from '@inertiajs/react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { numberLocale, t } from '../../lib/i18n';

/** A filter value: one choice, several, or nothing. */
export type FilterValue = string | string[];

export type FilterValues = Record<string, FilterValue>;

export interface FilterOption {
    value: string;
    label: string;
    /** Text colour for coded options such as series. */
    tone?: string;
}

/**
 * A field in the filter panel. There are only three kinds: a choice
 * of one, any of several, and a date range (two keys, from and to).
 */
export type FilterField =
    | {
          kind: 'select';
          key: string;
          label: string;
          options: FilterOption[];
          anyLabel: string;
      }
    | { kind: 'chips'; key: string; label: string; options: FilterOption[] }
    | {
          kind: 'segments';
          key: string;
          label: string;
          options: FilterOption[];
          anyLabel: string;
      }
    | { kind: 'dates'; from: string; to: string; label: string };

/** A common list, one click away: it only fills in fields. */
export interface QuickPick {
    label: string;
    count: number;
    dot?: string;
    values: FilterValues;
}

export interface SortOption {
    value: string;
    label: string;
}

export interface Paged {
    page: number;
    lastPage: number;
    total: number;
    perPage: number;
    from: number | null;
    to: number | null;
}

const fieldLabelClass =
    'text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-text-muted uppercase';

export function count(value: number): string {
    return new Intl.NumberFormat(numberLocale()).format(value);
}

function asList(value: FilterValue | undefined): string[] {
    if (Array.isArray(value)) {
        return value;
    }

    return value ? [value] : [];
}

/** The query string for a list: several values travel as "a,b". */
export function toQuery(
    values: FilterValues,
    extra: Record<string, string | number | undefined> = {},
): Record<string, string | number> {
    const query: Record<string, string | number> = {};

    Object.entries(values).forEach(([key, value]) => {
        const text = Array.isArray(value) ? value.join(',') : value;

        if (text) {
            query[key] = text;
        }
    });
    Object.entries(extra).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
            query[key] = value;
        }
    });

    return query;
}

function sameAs(values: FilterValues, wanted: FilterValues): boolean {
    return Object.entries(wanted).every(([key, value]) => {
        const have = asList(values[key]).slice().sort().join(',');

        return have === asList(value).slice().sort().join(',');
    });
}

/**
 * Keeps a list's filters, search, sort and page in the page address,
 * so a filtered list can be bookmarked or shared.
 */
export function useTableQuery(
    url: (query: Record<string, string | number>) => string,
    values: FilterValues,
    extra: { sort?: string; per_page?: number } = {},
) {
    const [search, setSearch] = useState(String(values.q ?? ''));
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(
        () => () => {
            if (timer.current) {
                clearTimeout(timer.current);
            }
        },
        [],
    );

    function visit(patch: FilterValues, page?: number) {
        router.get(
            url(
                toQuery(
                    { ...values, ...patch },
                    {
                        sort: extra.sort,
                        per_page:
                            extra.per_page && extra.per_page !== 25
                                ? extra.per_page
                                : undefined,
                        page: page && page > 1 ? page : undefined,
                    },
                ),
            ),
            {},
            { preserveState: true, preserveScroll: true, replace: true },
        );
    }

    return {
        search,
        onSearch: (value: string) => {
            setSearch(value);
            if (timer.current) {
                clearTimeout(timer.current);
            }
            timer.current = setTimeout(() => visit({ q: value.trim() }), 300);
        },
        set: (patch: FilterValues) => visit(patch),
        page: (page: number) => visit({}, page),
        sort: (sort: string) =>
            router.get(
                url(
                    toQuery(values, {
                        sort,
                        per_page:
                            extra.per_page && extra.per_page !== 25
                                ? extra.per_page
                                : undefined,
                    }),
                ),
                {},
                { preserveState: true, preserveScroll: true, replace: true },
            ),
        perPage: (perPage: number) =>
            router.get(
                url(
                    toQuery(values, {
                        sort: extra.sort,
                        per_page: perPage !== 25 ? perPage : undefined,
                    }),
                ),
                {},
                { preserveState: true, preserveScroll: true, replace: true },
            ),
    };
}

/** Closes a popover on a click outside it or on Escape. */
function useDismiss(open: boolean, close: () => void) {
    const box = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!open) {
            return;
        }

        const away = (event: MouseEvent) => {
            if (box.current && !box.current.contains(event.target as Node)) {
                close();
            }
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                close();
            }
        };
        document.addEventListener('mousedown', away);
        document.addEventListener('keydown', escape);

        return () => {
            document.removeEventListener('mousedown', away);
            document.removeEventListener('keydown', escape);
        };
    }, [open, close]);

    return box;
}

function Chip({
    on,
    onClick,
    children,
    tone,
}: {
    on: boolean;
    onClick: () => void;
    children: ReactNode;
    tone?: string;
}) {
    return (
        <button
            type="button"
            aria-pressed={on}
            onClick={onClick}
            className={`flex h-7 items-center gap-[6px] rounded-full border border-solid px-[10px] text-[12px] leading-4 ${
                on
                    ? 'border-primary bg-primary-tint font-semibold text-primary'
                    : 'border-border bg-white text-text hover:bg-surface'
            }`}
            style={!on && tone ? { color: tone } : undefined}
        >
            {on && (
                <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden>
                    <path
                        d="M2.5 6.2l2.3 2.3 4.7-4.9"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            )}
            {children}
        </button>
    );
}

/** How many fields hold a value, for the Filter button's badge. */
export function activeCount(
    fields: FilterField[],
    values: FilterValues,
): number {
    return fields.filter((field) =>
        field.kind === 'dates'
            ? Boolean(values[field.from] || values[field.to])
            : asList(values[field.key]).length > 0,
    ).length;
}

function FilterPanel({
    title,
    fields,
    quickPicks,
    values,
    onChange,
    onClear,
    onClose,
    total,
}: {
    title: string;
    fields: FilterField[];
    quickPicks: QuickPick[];
    values: FilterValues;
    onChange: (patch: FilterValues) => void;
    onClear: () => void;
    onClose: () => void;
    total: number;
}) {
    return (
        <div
            role="dialog"
            aria-label={title}
            className="absolute top-[calc(100%+8px)] left-0 z-40 flex w-[380px] max-w-[calc(100vw-32px)] flex-col rounded-xl border border-solid border-border bg-white shadow-[0_16px_40px_color-mix(in_srgb,var(--color-text)_16%,transparent)]"
        >
            <div className="flex items-center justify-between border-b border-solid border-border px-4 py-[14px]">
                <p className="text-[14px] leading-[18px] font-semibold text-text">
                    {title}
                </p>
                <button
                    type="button"
                    onClick={onClear}
                    className="text-[12px] font-semibold text-primary hover:underline"
                >
                    {t('Clear')}
                </button>
            </div>
            <div className="flex max-h-[min(70vh,560px)] flex-col gap-4 overflow-y-auto p-4">
                {quickPicks.length > 0 && (
                    <div className="flex flex-col gap-[6px] border-b border-solid border-border pb-[14px]">
                        <p className={fieldLabelClass}>{t('Quick picks')}</p>
                        <div className="flex flex-wrap gap-[6px]">
                            {quickPicks.map((pick) => {
                                const on = sameAs(values, pick.values);

                                return (
                                    <button
                                        key={pick.label}
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() =>
                                            onChange(
                                                on
                                                    ? Object.fromEntries(
                                                          Object.keys(
                                                              pick.values,
                                                          ).map((key) => [
                                                              key,
                                                              '',
                                                          ]),
                                                      )
                                                    : pick.values,
                                            )
                                        }
                                        className={`flex h-7 items-center gap-[6px] rounded-full border border-solid px-[10px] text-[12px] leading-4 ${
                                            on
                                                ? 'border-primary bg-primary-tint font-semibold text-primary'
                                                : 'border-border text-text hover:bg-surface'
                                        }`}
                                    >
                                        {pick.dot && (
                                            <span
                                                className={`h-[6px] w-[6px] shrink-0 rounded-full ${pick.dot}`}
                                            />
                                        )}
                                        {pick.label}
                                        <span className="font-mono text-text-muted">
                                            {count(pick.count)}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-[11px] leading-[15px] text-text-muted">
                            {t(
                                'A quick pick fills in the fields below; change any of them after.',
                            )}
                        </p>
                    </div>
                )}
                {fields.map((field) => (
                    <div
                        key={field.kind === 'dates' ? field.from : field.key}
                        className="flex flex-col gap-[6px]"
                    >
                        <p className={fieldLabelClass}>
                            {field.label}
                            {field.kind === 'chips' && (
                                <span className="font-normal tracking-normal normal-case">
                                    {' · '}
                                    {t('any of')}
                                </span>
                            )}
                        </p>
                        {field.kind === 'select' && (
                            <select
                                aria-label={field.label}
                                value={String(values[field.key] ?? '')}
                                onChange={(event) =>
                                    onChange({
                                        [field.key]: event.target.value,
                                    })
                                }
                                className="h-9 rounded-md border border-solid border-border bg-white px-3 text-[14px] text-text outline-none focus:border-primary"
                            >
                                <option value="">{field.anyLabel}</option>
                                {field.options.map((option) => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        )}
                        {field.kind === 'chips' && (
                            <div className="flex flex-wrap gap-[6px]">
                                {field.options.map((option) => {
                                    const chosen = asList(values[field.key]);
                                    const on = chosen.includes(option.value);

                                    return (
                                        <Chip
                                            key={option.value}
                                            on={on}
                                            tone={option.tone}
                                            onClick={() =>
                                                onChange({
                                                    [field.key]: on
                                                        ? chosen.filter(
                                                              (value) =>
                                                                  value !==
                                                                  option.value,
                                                          )
                                                        : [
                                                              ...chosen,
                                                              option.value,
                                                          ],
                                                })
                                            }
                                        >
                                            {option.label}
                                        </Chip>
                                    );
                                })}
                            </div>
                        )}
                        {field.kind === 'segments' && (
                            <div className="flex overflow-hidden rounded-md border border-solid border-border">
                                {[
                                    { value: '', label: field.anyLabel },
                                    ...field.options,
                                ].map((option, position) => {
                                    const on =
                                        String(values[field.key] ?? '') ===
                                        option.value;

                                    return (
                                        <button
                                            key={option.value || 'any'}
                                            type="button"
                                            aria-pressed={on}
                                            onClick={() =>
                                                onChange({
                                                    [field.key]: option.value,
                                                })
                                            }
                                            className={`h-8 flex-1 text-[13px] ${position > 0 ? 'border-l border-solid border-border' : ''} ${
                                                on
                                                    ? 'bg-primary-tint font-semibold text-primary'
                                                    : 'text-text hover:bg-surface'
                                            }`}
                                        >
                                            {option.label}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        {field.kind === 'dates' && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    aria-label={t(':label from', {
                                        label: field.label,
                                    })}
                                    value={String(values[field.from] ?? '')}
                                    onChange={(event) =>
                                        onChange({
                                            [field.from]: event.target.value,
                                        })
                                    }
                                    className="h-9 min-w-0 flex-1 rounded-md border border-solid border-border px-3 text-[13px] text-text outline-none focus:border-primary"
                                />
                                <span className="text-[13px] text-text-muted">
                                    –
                                </span>
                                <input
                                    type="date"
                                    aria-label={t(':label to', {
                                        label: field.label,
                                    })}
                                    value={String(values[field.to] ?? '')}
                                    onChange={(event) =>
                                        onChange({
                                            [field.to]: event.target.value,
                                        })
                                    }
                                    className="h-9 min-w-0 flex-1 rounded-md border border-solid border-border px-3 text-[13px] text-text outline-none focus:border-primary"
                                />
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <div className="flex items-center justify-between gap-3 rounded-b-xl border-t border-solid border-border bg-surface px-4 py-3">
                <p className="text-[12px] text-text-muted">
                    {t('Filters apply as you choose')}
                </p>
                <button
                    type="button"
                    onClick={onClose}
                    className="flex h-[34px] items-center rounded-md bg-primary px-[14px] text-[13px] font-semibold text-white hover:bg-primary-hover"
                >
                    {t('Show :count', { count: count(total) })}
                </button>
            </div>
        </div>
    );
}

function SortMenu({
    options,
    value,
    onChange,
}: {
    options: SortOption[];
    value: string;
    onChange: (value: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const box = useDismiss(open, () => setOpen(false));
    const current =
        options.find((option) => option.value === value) ?? options[0];

    return (
        <div ref={box} className="relative">
            <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen(!open)}
                className="flex h-9 items-center gap-2 rounded-md border border-solid border-border bg-white px-3 text-[13px] font-medium text-text hover:bg-surface"
            >
                <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
                    <path
                        d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"
                        fill="none"
                        stroke="var(--color-text-muted)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
                {t('Sort: :sort', { sort: current?.label ?? '' })}
            </button>
            {open && (
                <div
                    role="menu"
                    className="absolute top-[calc(100%+6px)] left-0 z-40 flex w-[220px] flex-col rounded-lg border border-solid border-border bg-white p-[6px] shadow-[0_12px_32px_color-mix(in_srgb,var(--color-text)_14%,transparent)]"
                >
                    {options.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            role="menuitemradio"
                            aria-checked={option.value === current?.value}
                            onClick={() => {
                                setOpen(false);
                                onChange(option.value);
                            }}
                            className={`flex h-[34px] items-center rounded-md px-[10px] text-left text-[13px] hover:bg-surface ${option.value === current?.value ? 'font-semibold text-primary' : 'text-text'}`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export function DownloadIcon({
    colour = 'var(--color-text)',
}: {
    colour?: string;
}) {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
            <path
                d="M12 4v11M7 10l5 5 5-5M4 17v3h16v-3"
                fill="none"
                stroke={colour}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

/**
 * The one toolbar every list shares: search, filter, sort, how many
 * rows match, and export. While rows are selected the bulk bar takes
 * its place.
 */
export function TableToolbar({
    searchLabel,
    searchPlaceholder,
    search,
    onSearch,
    filterTitle,
    fields,
    quickPicks = [],
    values,
    onFilter,
    sorts,
    sort,
    onSort,
    countLabel,
    total,
    onExport,
}: {
    searchLabel: string;
    searchPlaceholder: string;
    search: string;
    onSearch: (value: string) => void;
    filterTitle: string;
    fields: FilterField[];
    quickPicks?: QuickPick[];
    values: FilterValues;
    onFilter: (patch: FilterValues) => void;
    sorts: SortOption[];
    sort: string;
    onSort: (value: string) => void;
    countLabel: ReactNode;
    total: number;
    onExport?: () => void;
}) {
    const [open, setOpen] = useState(false);
    const box = useDismiss(open, () => setOpen(false));
    const active = activeCount(fields, values);

    function clear() {
        onFilter(
            Object.fromEntries(
                fields.flatMap((field) =>
                    field.kind === 'dates'
                        ? [
                              [field.from, ''],
                              [field.to, ''],
                          ]
                        : [[field.key, '']],
                ),
            ),
        );
    }

    return (
        <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-9 w-full items-center gap-2 rounded-md border border-solid border-border bg-white px-3 focus-within:border-primary sm:w-[340px]">
                <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    className="shrink-0"
                    aria-hidden
                >
                    <circle
                        cx="11"
                        cy="11"
                        r="7"
                        fill="none"
                        stroke="var(--color-text-muted)"
                        strokeWidth="2"
                    />
                    <path
                        d="M16 16l5 5"
                        fill="none"
                        stroke="var(--color-text-muted)"
                        strokeWidth="2"
                        strokeLinecap="round"
                    />
                </svg>
                <input
                    type="search"
                    aria-label={searchLabel}
                    placeholder={searchPlaceholder}
                    value={search}
                    onChange={(event) => onSearch(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-[14px] text-text outline-none placeholder:text-text-muted"
                />
            </label>
            <div ref={box} className="relative">
                <button
                    type="button"
                    aria-haspopup="dialog"
                    aria-expanded={open}
                    onClick={() => setOpen(!open)}
                    className={`flex h-9 items-center gap-2 rounded-md border border-solid bg-white px-3 text-[13px] font-semibold hover:bg-surface ${
                        active > 0
                            ? 'border-primary text-primary'
                            : 'border-border text-text'
                    }`}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
                        <path
                            d="M3 5h18l-7 8v6l-4-2v-4z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinejoin="round"
                        />
                    </svg>
                    {t('Filter')}
                    {active > 0 && (
                        <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-[5px] font-mono text-[11px] text-white">
                            {active}
                        </span>
                    )}
                </button>
                {open && (
                    <FilterPanel
                        title={filterTitle}
                        fields={fields}
                        quickPicks={quickPicks}
                        values={values}
                        onChange={onFilter}
                        onClear={clear}
                        onClose={() => setOpen(false)}
                        total={total}
                    />
                )}
            </div>
            {sorts.length > 1 && (
                <SortMenu options={sorts} value={sort} onChange={onSort} />
            )}
            <span className="flex-1" />
            <span className="text-[13px] text-text-muted">{countLabel}</span>
            {onExport && (
                <button
                    type="button"
                    onClick={onExport}
                    className="flex h-9 items-center gap-2 rounded-md border border-solid border-border bg-white px-[14px] text-[13px] font-medium text-text hover:bg-surface"
                >
                    <DownloadIcon />
                    {t('Export')}
                </button>
            )}
        </div>
    );
}

/** The filters in use, each removable, under the toolbar. */
export function FilterChips({
    fields,
    values,
    onFilter,
}: {
    fields: FilterField[];
    values: FilterValues;
    onFilter: (patch: FilterValues) => void;
}) {
    const chips: {
        key: string;
        label: string;
        value: string;
        clear: FilterValues;
    }[] = [];

    fields.forEach((field) => {
        if (field.kind === 'dates') {
            const from = String(values[field.from] ?? '');
            const to = String(values[field.to] ?? '');

            if (from || to) {
                chips.push({
                    key: field.from,
                    label: field.label,
                    value: `${from || '…'} – ${to || '…'}`,
                    clear: { [field.from]: '', [field.to]: '' },
                });
            }

            return;
        }

        const chosen = asList(values[field.key]);

        if (chosen.length > 0) {
            chips.push({
                key: field.key,
                label: field.label,
                value: chosen
                    .map(
                        (value) =>
                            field.options.find(
                                (option) => option.value === value,
                            )?.label ?? value,
                    )
                    .join(', '),
                clear: { [field.key]: '' },
            });
        }
    });

    if (chips.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-wrap items-center gap-2">
            {chips.map((chip) => (
                <span
                    key={chip.key}
                    className="flex h-7 items-center gap-[6px] rounded-full border border-solid border-border bg-surface pr-[6px] pl-[10px] text-[12px] text-text"
                >
                    <span className="text-text-muted">{chip.label}</span>
                    <span className="font-semibold">{chip.value}</span>
                    <button
                        type="button"
                        aria-label={t('Remove :label filter', {
                            label: chip.label,
                        })}
                        onClick={() => onFilter(chip.clear)}
                        className="flex h-[18px] w-[18px] items-center justify-center rounded-full hover:bg-border"
                    >
                        <svg
                            width="10"
                            height="10"
                            viewBox="0 0 10 10"
                            aria-hidden
                        >
                            <path
                                d="M2.5 2.5l5 5M7.5 2.5l-5 5"
                                stroke="var(--color-text-muted)"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                            />
                        </svg>
                    </button>
                </span>
            ))}
            <button
                type="button"
                onClick={() =>
                    onFilter(
                        Object.assign({}, ...chips.map((chip) => chip.clear)),
                    )
                }
                className="px-[6px] text-[12px] font-semibold text-primary hover:underline"
            >
                {t('Clear filters')}
            </button>
        </div>
    );
}

function pageList(last: number, current: number): (number | 'gap')[] {
    const pages = [...new Set([1, current - 1, current, current + 1, last])]
        .filter((page) => page >= 1 && page <= last)
        .sort((a, b) => a - b);
    const list: (number | 'gap')[] = [];

    pages.forEach((page, position) => {
        if (position > 0 && page - pages[position - 1] > 1) {
            list.push('gap');
        }
        list.push(page);
    });

    return list;
}

const pageButtonClass =
    'flex h-[30px] min-w-[30px] items-center justify-center rounded-md border border-solid px-2 font-mono text-[12px]';

/** "Showing 1–25 of 412", rows per page and page buttons. */
export function TableFooter({
    paged,
    onPage,
    onPerPage,
}: {
    paged: Paged;
    onPage: (page: number) => void;
    onPerPage: (perPage: number) => void;
}) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-[13px] text-text-muted">
                {paged.total === 0
                    ? t('Showing 0')
                    : t('Showing :from–:to of :total', {
                          from: count(paged.from ?? 0),
                          to: count(paged.to ?? 0),
                          total: count(paged.total),
                      })}
            </p>
            <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-[13px] text-text-muted">
                    {t('Rows per page')}
                    <select
                        value={paged.perPage}
                        onChange={(event) =>
                            onPerPage(Number(event.target.value))
                        }
                        className="h-[30px] rounded-md border border-solid border-border bg-white px-2 font-mono text-[12px] text-text outline-none focus:border-primary"
                    >
                        {[25, 50, 100].map((size) => (
                            <option key={size} value={size}>
                                {size}
                            </option>
                        ))}
                    </select>
                </label>
                <nav
                    aria-label={t('Pages')}
                    className="flex items-center gap-1"
                >
                    <button
                        type="button"
                        aria-label={t('Previous page')}
                        disabled={paged.page <= 1}
                        onClick={() => onPage(paged.page - 1)}
                        className={`${pageButtonClass} border-border text-text hover:bg-surface disabled:opacity-40`}
                    >
                        ‹
                    </button>
                    {pageList(paged.lastPage, paged.page).map(
                        (page, position) =>
                            page === 'gap' ? (
                                <span
                                    key={`gap-${position}`}
                                    className="px-1 text-[13px] text-text-muted"
                                >
                                    …
                                </span>
                            ) : (
                                <button
                                    key={page}
                                    type="button"
                                    aria-current={
                                        page === paged.page ? 'page' : undefined
                                    }
                                    onClick={() => onPage(page)}
                                    className={`${pageButtonClass} ${
                                        page === paged.page
                                            ? 'border-primary bg-primary-tint font-semibold text-primary'
                                            : 'border-border text-text hover:bg-surface'
                                    }`}
                                >
                                    {page}
                                </button>
                            ),
                    )}
                    <button
                        type="button"
                        aria-label={t('Next page')}
                        disabled={paged.page >= paged.lastPage}
                        onClick={() => onPage(paged.page + 1)}
                        className={`${pageButtonClass} border-border text-text hover:bg-surface disabled:opacity-40`}
                    >
                        ›
                    </button>
                </nav>
            </div>
        </div>
    );
}

export function Checkbox({
    checked,
    mixed = false,
    onChange,
    label,
}: {
    checked: boolean;
    mixed?: boolean;
    onChange: () => void;
    label: string;
}) {
    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={mixed ? 'mixed' : checked}
            aria-label={label}
            onClick={(event) => {
                event.stopPropagation();
                onChange();
            }}
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border-[1.5px] border-solid ${
                checked || mixed
                    ? 'border-primary bg-primary'
                    : 'border-text-disabled bg-white hover:border-primary'
            }`}
        >
            {mixed ? (
                <span className="h-[2px] w-2 rounded-full bg-white" />
            ) : (
                checked && (
                    <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden>
                        <path
                            d="M2.5 6.2l2.3 2.3 4.7-4.9"
                            fill="none"
                            stroke="var(--color-bg)"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                )
            )}
        </button>
    );
}

/**
 * Which rows are picked. "All that match" stands for every row the
 * filters find, on every page, without loading them.
 */
export function useSelection(pageIds: string[]) {
    const [ids, setIds] = useState<string[]>([]);
    const [allMatching, setAllMatching] = useState(false);
    const onPage = pageIds.filter((id) => ids.includes(id)).length;

    return {
        ids,
        allMatching,
        has: (id: string) => allMatching || ids.includes(id),
        toggle: (id: string) => {
            setAllMatching(false);
            setIds(
                ids.includes(id)
                    ? ids.filter((other) => other !== id)
                    : [...ids, id],
            );
        },
        togglePage: () => {
            setAllMatching(false);
            setIds(
                onPage === pageIds.length
                    ? ids.filter((id) => !pageIds.includes(id))
                    : [...new Set([...ids, ...pageIds])],
            );
        },
        pageState: (allMatching || (onPage > 0 && onPage === pageIds.length)
            ? 'all'
            : onPage > 0
              ? 'some'
              : 'none') as 'all' | 'some' | 'none',
        selectAllMatching: () => setAllMatching(true),
        clear: () => {
            setIds([]);
            setAllMatching(false);
        },
    };
}

/** Replaces the toolbar while rows are ticked. */
export function BulkBar({
    selected,
    total,
    allMatching,
    onSelectAll,
    onClear,
    children,
}: {
    selected: number;
    total: number;
    allMatching: boolean;
    onSelectAll: () => void;
    onClear: () => void;
    children: ReactNode;
}) {
    return (
        <div className="flex min-h-11 flex-wrap items-center gap-[10px] rounded-md bg-primary py-[6px] pr-2 pl-[14px]">
            <span className="text-[14px] font-semibold text-white">
                {t(':count selected', {
                    count: count(allMatching ? total : selected),
                })}
            </span>
            {!allMatching && selected < total && (
                <>
                    <span className="text-[13px] text-primary-border">·</span>
                    <button
                        type="button"
                        onClick={onSelectAll}
                        className="text-[13px] font-semibold text-print-cream underline"
                    >
                        {t('Select all :total that match', {
                            total: count(total),
                        })}
                    </button>
                </>
            )}
            <span className="flex-1" />
            {children}
            <span className="h-5 w-px bg-white/25" />
            <button
                type="button"
                onClick={onClear}
                className="flex h-8 items-center gap-[6px] px-[10px] text-[13px] font-medium text-white"
            >
                {t('Cancel')}
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                    <path
                        d="M2.5 2.5l5 5M7.5 2.5l-5 5"
                        stroke="var(--color-bg)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                    />
                </svg>
            </button>
        </div>
    );
}

export const bulkButtonClass =
    'flex h-8 items-center gap-[6px] rounded-md border border-solid border-white/35 px-3 text-[13px] font-medium text-white hover:bg-white/10';

export interface ExportColumn {
    key: string;
    label: string;
    /** Ticked when the dialog opens. */
    on: boolean;
}

/**
 * Which rows, which format and which columns. The CSV downloads at
 * once; the printable list opens a page to print or save as PDF.
 */
export function ExportDialog({
    title,
    subtitle,
    noun,
    matching,
    selected,
    everyone,
    columns,
    href,
    onClose,
}: {
    title: string;
    subtitle: string;
    /** Plural noun for the rows, e.g. "students". */
    noun: string;
    matching: number;
    selected: string[] | 'all';
    everyone: number;
    columns: ExportColumn[];
    /** The export address for a scope, format and set of columns. */
    href: (options: {
        scope: 'matching' | 'selected' | 'everyone';
        format: 'csv' | 'print';
        columns: string[];
    }) => string;
    onClose: () => void;
}) {
    const picked = selected === 'all' ? matching : selected.length;
    const [scope, setScope] = useState<'matching' | 'selected' | 'everyone'>(
        picked > 0 ? 'selected' : 'matching',
    );
    const [format, setFormat] = useState<'csv' | 'print'>('csv');
    const [chosen, setChosen] = useState(
        columns.filter((column) => column.on).map((column) => column.key),
    );
    const rows =
        scope === 'selected'
            ? picked
            : scope === 'everyone'
              ? everyone
              : matching;

    useEffect(() => {
        const escape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', escape);

        return () => document.removeEventListener('keydown', escape);
    }, [onClose]);

    function go() {
        const target = href({ scope, format, columns: chosen });

        if (format === 'print') {
            router.visit(target);
        } else {
            window.location.href = target;
        }
        onClose();
    }

    const scopes = [
        {
            key: 'matching' as const,
            label: t('The :count that match these filters', {
                count: count(matching),
            }),
            rows: matching,
        },
        {
            key: 'selected' as const,
            label: t('Only the ones I selected'),
            rows: picked,
        },
        {
            key: 'everyone' as const,
            label: t('All :noun', { noun }),
            rows: everyone,
        },
    ];

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 p-4"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className="flex max-h-[calc(100vh-32px)] w-[520px] max-w-full flex-col overflow-y-auto rounded-xl bg-white shadow-[0_24px_60px_color-mix(in_srgb,var(--color-text)_28%,transparent)]"
            >
                <div className="flex items-start justify-between gap-4 px-[22px] pt-5 pb-[14px]">
                    <div className="flex flex-col gap-1">
                        <p className="font-display text-[20px] leading-6 font-bold text-text">
                            {title}
                        </p>
                        <p className="text-[13px] text-text-muted">
                            {subtitle}
                        </p>
                    </div>
                    <button
                        type="button"
                        aria-label={t('Close')}
                        onClick={onClose}
                        className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-surface"
                    >
                        <svg
                            width="12"
                            height="12"
                            viewBox="0 0 10 10"
                            aria-hidden
                        >
                            <path
                                d="M2.5 2.5l5 5M7.5 2.5l-5 5"
                                stroke="var(--color-text-muted)"
                                strokeWidth="1.3"
                                strokeLinecap="round"
                            />
                        </svg>
                    </button>
                </div>
                <div className="flex flex-col gap-[18px] px-[22px] pb-5">
                    <fieldset className="flex flex-col gap-2">
                        <legend className={`${fieldLabelClass} pb-2`}>
                            {t('Which :noun', { noun })}
                        </legend>
                        <div className="flex flex-col overflow-hidden rounded-md border border-solid border-border">
                            {scopes.map((option, position) => (
                                <label
                                    key={option.key}
                                    className={`flex items-center gap-[10px] px-3 py-[10px] text-[14px] ${position > 0 ? 'border-t border-solid border-border' : ''} ${scope === option.key ? 'bg-primary-tint font-semibold' : ''} ${option.rows === 0 ? 'opacity-45' : 'cursor-pointer'}`}
                                >
                                    <input
                                        type="radio"
                                        name="export-scope"
                                        disabled={option.rows === 0}
                                        checked={scope === option.key}
                                        onChange={() => setScope(option.key)}
                                        className="accent-primary"
                                    />
                                    <span className="flex-1 text-text">
                                        {option.label}
                                    </span>
                                    <span className="font-mono text-[12px] font-normal text-text-muted">
                                        {count(option.rows)}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </fieldset>
                    <fieldset className="flex flex-col gap-2">
                        <legend className={`${fieldLabelClass} pb-2`}>
                            {t('Format')}
                        </legend>
                        <div className="flex gap-2">
                            {(
                                [
                                    {
                                        key: 'csv',
                                        label: t('Spreadsheet (CSV)'),
                                        hint: t('opens in Excel'),
                                    },
                                    {
                                        key: 'print',
                                        label: t('Printable list'),
                                        hint: t('to print or save as PDF'),
                                    },
                                ] as const
                            ).map((option) => (
                                <button
                                    key={option.key}
                                    type="button"
                                    aria-pressed={format === option.key}
                                    onClick={() => setFormat(option.key)}
                                    className={`flex flex-1 flex-col gap-[2px] rounded-md border border-solid px-3 py-[10px] text-left ${
                                        format === option.key
                                            ? 'border-primary bg-primary-tint'
                                            : 'border-border hover:bg-surface'
                                    }`}
                                >
                                    <span
                                        className={`text-[14px] font-semibold ${format === option.key ? 'text-primary' : 'text-text'}`}
                                    >
                                        {option.label}
                                    </span>
                                    <span className="text-[12px] text-text-muted">
                                        {option.hint}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </fieldset>
                    <fieldset className="flex flex-col gap-2">
                        <div className="flex items-baseline justify-between">
                            <legend className={fieldLabelClass}>
                                {t('Columns · :chosen of :all', {
                                    chosen: chosen.length,
                                    all: columns.length,
                                })}
                            </legend>
                            <button
                                type="button"
                                onClick={() =>
                                    setChosen(
                                        columns
                                            .filter((column) => column.on)
                                            .map((column) => column.key),
                                    )
                                }
                                className="text-[12px] font-semibold text-primary hover:underline"
                            >
                                {t('Same as the table')}
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-[6px]">
                            {columns.map((column) => (
                                <Chip
                                    key={column.key}
                                    on={chosen.includes(column.key)}
                                    onClick={() =>
                                        setChosen(
                                            chosen.includes(column.key)
                                                ? chosen.filter(
                                                      (key) =>
                                                          key !== column.key,
                                                  )
                                                : columns
                                                      .map((each) => each.key)
                                                      .filter(
                                                          (key) =>
                                                              key ===
                                                                  column.key ||
                                                              chosen.includes(
                                                                  key,
                                                              ),
                                                      ),
                                        )
                                    }
                                >
                                    {column.label}
                                </Chip>
                            ))}
                        </div>
                    </fieldset>
                    <p className="rounded-md bg-surface px-3 py-[10px] text-[12px] leading-[17px] text-text-muted">
                        {t(
                            'The file starts with the school, the filters and the date it was made. Lists hold personal data: every export is recorded in the audit log.',
                        )}
                    </p>
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-solid border-border px-[22px] py-[14px]">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 items-center rounded-md border border-solid border-border px-4 text-[13px] font-medium text-text hover:bg-surface"
                    >
                        {t('Cancel')}
                    </button>
                    <button
                        type="button"
                        disabled={rows === 0 || chosen.length === 0}
                        onClick={go}
                        className="flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-[13px] font-semibold text-white hover:bg-primary-hover disabled:opacity-40"
                    >
                        <DownloadIcon colour="var(--color-bg)" />
                        {t('Export :count :noun', { count: count(rows), noun })}
                    </button>
                </div>
            </div>
        </div>
    );
}

export { default as TableRowMenu } from './row-menu';
export { default as TableEmptyState } from './empty-state';

export function tableRowClass({
    index,
    selected = false,
    interactive = false,
}: {
    index: number;
    selected?: boolean;
    interactive?: boolean;
}): string {
    if (selected)
        return interactive
            ? 'bg-primary-tint/60 hover:bg-primary-tint'
            : 'bg-primary-tint/60';
    return `${index % 2 === 1 ? 'bg-row-alt' : 'bg-white'}${interactive ? ' hover:bg-surface' : ''}`;
}
