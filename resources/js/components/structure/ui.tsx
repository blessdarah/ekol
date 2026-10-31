import { Link, usePage } from '@inertiajs/react';
import { index as roomsIndex } from '@/actions/App/Http/Controllers/TimetableRoomController';
import { index as seriesRegistration } from '@/actions/App/Http/Controllers/SeriesRegistrationController';
import { index as seriesSetup } from '@/actions/App/Http/Controllers/SeriesController';
import SharedPageHeader from '../shell/page-header';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { type Crumb } from '../shell/breadcrumbs';
import { index as levelsIndex } from '@/actions/App/Http/Controllers/StructureController';
import { index as subjectsIndex } from '@/actions/App/Http/Controllers/SubjectController';
import { t } from '../../lib/i18n';

export const CYCLE_LABELS: Record<string, string> = {
    primary: 'Primary',
    secondary: 'Secondary',
    high_school: 'High school',
};

export const SUBSYSTEM_LABELS: Record<string, string> = {
    anglophone: 'Anglophone (GCE)',
    francophone: 'Francophone',
    bilingual: 'Bilingual',
};

export const capsLabelClass =
    'text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase';

export const fieldLabelClass = 'text-[13px] leading-4 font-medium text-text';

export const fieldInputClass =
    'h-10 w-full rounded-md border border-solid border-border bg-white px-3 text-[16px] leading-5 text-text outline-none focus:border-primary';

export const outlineButtonClass =
    'flex h-9 items-center justify-center rounded-md border border-solid border-border bg-white px-4 text-[13px] leading-4 font-medium text-text hover:bg-surface';

export const solidButtonClass =
    'flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-[13px] leading-4 font-semibold text-white hover:bg-primary-hover disabled:opacity-50';

export function segmentClass(selected: boolean): string {
    return `flex h-10 flex-1 items-center justify-center rounded-md border border-solid text-[14px] leading-[18px] ${
        selected
            ? 'border-primary bg-primary-tint font-semibold text-primary'
            : 'border-border font-medium text-text hover:bg-surface'
    }`;
}

export function LockIcon({
    size = 12,
    tone = 'var(--color-text-muted)',
}: {
    size?: number;
    tone?: string;
}) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            className="shrink-0"
        >
            <rect
                x="5"
                y="11"
                width="14"
                height="10"
                rx="2"
                fill="none"
                stroke={tone}
                strokeWidth="2.5"
            />
            <path
                d="M8 11V7a4 4 0 018 0v4"
                fill="none"
                stroke={tone}
                strokeWidth="2.5"
            />
        </svg>
    );
}

export function PlusIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" className="shrink-0">
            <path
                d="M12 5v14M5 12h14"
                fill="none"
                stroke="var(--color-bg)"
                strokeWidth="2.5"
                strokeLinecap="round"
            />
        </svg>
    );
}

export function Toggle({
    checked,
    disabled = false,
    label,
    onChange,
}: {
    checked: boolean;
    disabled?: boolean;
    label: string;
    onChange: (next: boolean) => void;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={`flex h-5 w-9 shrink-0 items-center rounded-full px-[2px] transition-colors disabled:opacity-60 ${
                checked ? 'justify-end bg-primary' : 'justify-start bg-border'
            }`}
        >
            <span className="size-4 rounded-full bg-white" />
        </button>
    );
}

export function StructureHeader({
    trail = [],
    section = 'levels',
    title,
    tag,
    meta,
    action,
}: {
    section?: 'levels' | 'subjects' | 'series';
    /** Steps within the selected management area. */
    trail?: Crumb[];
    title: string;
    tag: string;
    meta?: string;
    action?: ReactNode;
}) {
    const root = {
        levels: { label: t('Levels and series'), href: levelsIndex.url() },
        subjects: { label: t('Rooms and subjects'), href: roomsIndex.url() },
        series: { label: t('Levels and series'), href: levelsIndex.url() },
    }[section];

    return (
        <SharedPageHeader
            root={root}
            trail={trail.filter(
                (crumb, index) =>
                    index !== 0 ||
                    (crumb.href !== root.href && crumb.label !== root.label),
            )}
            title={title}
            tag={tag}
            meta={meta}
            action={action}
        />
    );
}

type ManagementTabsProps =
    | {
          group: 'structure';
          active: 'levels' | 'setup' | 'registration';
          levelId?: string;
      }
    | { group: 'resources'; active: 'rooms' | 'subjects' };

export function ManagementTabs(props: ManagementTabsProps) {
    const { can } = usePage<{ can: Record<string, boolean> }>().props;
    const options =
        props.group === 'structure' && props.levelId
            ? { query: { level: props.levelId } }
            : undefined;
    const tabs =
        props.group === 'structure'
            ? [
                  {
                      key: 'levels',
                      label: 'Levels & classes',
                      href: levelsIndex.url(options),
                      allowed: can['manage-structure'],
                  },
                  {
                      key: 'setup',
                      label: 'Series setup',
                      href: seriesSetup.url(options),
                      allowed: can['manage-structure'],
                  },
                  {
                      key: 'registration',
                      label: 'Student registration',
                      href: seriesRegistration.url(options),
                      allowed: can['manage-students'],
                  },
              ]
            : [
                  {
                      key: 'rooms',
                      label: 'Rooms',
                      href: roomsIndex.url(),
                      allowed: can['manage-structure'],
                  },
                  {
                      key: 'subjects',
                      label: 'Subjects',
                      href: subjectsIndex.url(),
                      allowed: can['manage-structure'],
                  },
              ];
    return (
        <nav
            aria-label={t(
                props.group === 'structure'
                    ? 'Levels and series'
                    : 'Rooms and subjects',
            )}
            className="flex h-[46px] shrink-0 gap-7 overflow-x-auto border-b border-solid border-border whitespace-nowrap"
        >
            {tabs
                .filter((tab) => tab.allowed)
                .map((tab) => (
                    <Link
                        key={tab.key}
                        href={tab.href}
                        aria-current={
                            tab.key === props.active ? 'page' : undefined
                        }
                        className={`flex items-center border-b-[3px] border-solid text-[14px] leading-5 ${tab.key === props.active ? 'border-primary font-semibold text-primary' : 'border-transparent font-medium text-text-muted hover:text-text'}`}
                    >
                        {t(tab.label)}
                    </Link>
                ))}
        </nav>
    );
}

export function StreamChip({
    stream,
    children,
}: {
    stream: string;
    children: ReactNode;
}) {
    return (
        <span
            className={`flex h-[22px] items-center rounded-sm px-2 font-mono text-[12px] leading-4 ${
                stream === 'arts'
                    ? 'bg-arts-tint text-arts'
                    : stream === 'science'
                      ? 'bg-science-tint text-science'
                      : 'bg-primary-tint text-primary'
            }`}
        >
            {children}
        </span>
    );
}

export function ErrorText({ message }: { message?: string | null }) {
    if (!message) {
        return null;
    }

    return (
        <span role="alert" className="text-[12px] leading-4 text-danger">
            {message}
        </span>
    );
}

export function RemoveIcon({ tone }: { tone: string }) {
    return (
        <svg width="10" height="10" viewBox="0 0 10 10" className="shrink-0">
            <path
                d="M2 2l6 6M8 2L2 8"
                fill="none"
                stroke={tone}
                strokeWidth="1.5"
                strokeLinecap="round"
            />
        </svg>
    );
}

/** Chips for what is chosen, with a native picker for what is left. */
export function SearchPicker({
    label,
    placeholder,
    options,
    onSelect,
}: {
    label: string;
    placeholder: string;
    options: { id: string; name: string; code?: string | null }[];
    onSelect: (id: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [active, setActive] = useState(0);
    const box = useRef<HTMLDivElement>(null);
    const input = useRef<HTMLInputElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const listId = useId();
    const listed = options.filter((option) =>
        `${option.name} ${option.code ?? ''}`
            .toLocaleLowerCase()
            .includes(search.trim().toLocaleLowerCase()),
    );
    const current =
        listed.length > 0 ? Math.min(active, listed.length - 1) : -1;

    const activeOptionId =
        current >= 0 ? `${listId}-${listed[current].id}` : undefined;
    useEffect(() => {
        if (open && activeOptionId) {
            document
                .getElementById(activeOptionId)
                ?.scrollIntoView({ block: 'nearest' });
        }
    }, [open, activeOptionId]);

    useEffect(() => {
        if (!open) {
            return;
        }
        input.current?.focus();
        const away = (event: PointerEvent) => {
            if (
                event.target instanceof Node &&
                !box.current?.contains(event.target)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener('pointerdown', away);
        return () => document.removeEventListener('pointerdown', away);
    }, [open]);

    function choose(id: string) {
        onSelect(id);
        setOpen(false);
        setSearch('');
        setActive(0);
        trigger.current?.focus();
    }

    return (
        <div ref={box} className="relative">
            <button
                ref={trigger}
                type="button"
                aria-label={label}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={open ? listId : undefined}
                onClick={() => {
                    setSearch('');
                    setActive(0);
                    setOpen(!open);
                }}
                className="flex h-8 items-center gap-2 rounded-md border border-solid border-border bg-white px-3 text-[13px] font-medium text-text hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary"
            >
                {placeholder}
                <span aria-hidden="true">⌄</span>
            </button>
            {open && (
                <div className="absolute top-full right-0 z-40 mt-2 w-72 max-w-[calc(100vw-3rem)] overflow-hidden rounded-lg border border-solid border-border bg-white shadow-lg">
                    <div className="border-b border-solid border-border p-2">
                        <input
                            ref={input}
                            role="combobox"
                            aria-label={label}
                            aria-expanded={open}
                            aria-controls={listId}
                            aria-autocomplete="list"
                            aria-activedescendant={
                                current >= 0
                                    ? `${listId}-${listed[current].id}`
                                    : undefined
                            }
                            value={search}
                            placeholder={t('Search…')}
                            onChange={(event) => {
                                setSearch(event.target.value);
                                setActive(0);
                            }}
                            onKeyDown={(event) => {
                                if (
                                    event.key === 'ArrowDown' ||
                                    event.key === 'ArrowUp'
                                ) {
                                    event.preventDefault();
                                    if (listed.length > 0) {
                                        setActive(
                                            (current +
                                                (event.key === 'ArrowDown'
                                                    ? 1
                                                    : -1) +
                                                listed.length) %
                                                listed.length,
                                        );
                                    }
                                } else if (event.key === 'Enter') {
                                    event.preventDefault();
                                    if (current >= 0) {
                                        choose(listed[current].id);
                                    }
                                } else if (event.key === 'Escape') {
                                    event.preventDefault();
                                    setOpen(false);
                                    trigger.current?.focus();
                                } else if (event.key === 'Tab') {
                                    trigger.current?.focus();
                                    setOpen(false);
                                }
                            }}
                            className="h-9 w-full rounded-md border border-solid border-border px-3 text-[14px] text-text outline-none focus:border-primary"
                        />
                    </div>
                    <ul
                        id={listId}
                        role="listbox"
                        aria-label={label}
                        className="max-h-60 overflow-y-auto p-1"
                    >
                        {listed.map((option, position) => (
                            <li
                                id={`${listId}-${option.id}`}
                                key={option.id}
                                role="option"
                                aria-selected={position === current}
                            >
                                <button
                                    type="button"
                                    tabIndex={-1}
                                    onMouseDown={(event) =>
                                        event.preventDefault()
                                    }
                                    onMouseEnter={() => setActive(position)}
                                    onClick={() => choose(option.id)}
                                    className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-[13px] ${position === current ? 'bg-primary-tint text-primary' : 'text-text hover:bg-surface'}`}
                                >
                                    <span>{option.name}</span>
                                    {option.code && (
                                        <span className="font-mono text-[12px] text-text-muted">
                                            {option.code}
                                        </span>
                                    )}
                                </button>
                            </li>
                        ))}
                    </ul>
                    {listed.length === 0 && (
                        <p
                            role="status"
                            className="px-4 py-3 text-[13px] text-text-muted"
                        >
                            {t('No matching options.')}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

export function ChipPicker({
    label,
    chosen,
    options,
    summary,
    addLabel,
    onAdd,
    children,
}: {
    label: string;
    chosen: number;
    options: { id: string; name: string; code?: string | null }[];
    summary: string;
    addLabel: string;
    onAdd: (id: string) => void;
    children: ReactNode;
}) {
    return (
        <div className="flex min-h-10 flex-wrap items-center justify-between gap-3 rounded-md border border-solid border-border px-3 py-[7px]">
            <div className="flex flex-wrap items-center gap-[6px]">
                {children}
                {chosen === 0 && (
                    <span className="text-[13px] leading-4 text-text-muted">
                        {t('None chosen')}
                    </span>
                )}
            </div>
            <div className="flex items-center gap-[10px]">
                <span className="text-[13px] leading-4 text-text-muted">
                    {summary}
                </span>
                {options.length > 0 && (
                    <SearchPicker
                        label={label}
                        placeholder={addLabel}
                        options={options}
                        onSelect={onAdd}
                    />
                )}
            </div>
        </div>
    );
}

/** The Levels and series step, linked for pages beneath it. */
export const levelsCrumb: Crumb = {
    label: 'Levels and series',
    href: levelsIndex.url(),
};

/** The Subjects step, linked for pages beneath the roster. */
export const subjectsCrumb: Crumb = {
    label: 'Subjects',
    href: subjectsIndex.url(),
};
