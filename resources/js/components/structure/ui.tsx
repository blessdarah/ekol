import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import Breadcrumbs, { type Crumb } from '../shell/breadcrumbs';
import { index as seriesIndex } from '@/actions/App/Http/Controllers/SeriesController';
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

export function LockIcon({ size = 12, tone = '#56625C' }: { size?: number; tone?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" className="shrink-0">
            <rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke={tone} strokeWidth="2.5" />
            <path d="M8 11V7a4 4 0 018 0v4" fill="none" stroke={tone} strokeWidth="2.5" />
        </svg>
    );
}

export function PlusIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" className="shrink-0">
            <path d="M12 5v14M5 12h14" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
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
    title,
    tag,
    meta,
    action,
}: {
    /** Steps after Classes & Subjects; the last one is the page you are on. */
    trail?: Crumb[];
    title: string;
    tag: string;
    meta?: string;
    action?: ReactNode;
}) {
    return (
        <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-[6px]">
                <Breadcrumbs
                    trail={[
                        { label: t('Classes & Subjects'), href: levelsIndex.url() },
                        ...trail,
                    ]}
                />
                <h1 className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text sm:text-[40px] sm:leading-[44px]">
                    {title}
                </h1>
                <p className="flex flex-wrap items-center gap-x-2 text-[13px] leading-4 text-text-muted">
                    <span className="font-mono uppercase">{tag}</span>
                    {meta && <span>· {meta}</span>}
                </p>
            </div>
            {action}
        </div>
    );
}

export function StructureTabs({ active }: { active: 'subjects' | 'levels' | 'series' }) {
    const tabs = [
        { key: 'subjects', label: t('Subjects'), href: subjectsIndex.url() },
        { key: 'levels', label: t('Levels'), href: levelsIndex.url() },
        { key: 'series', label: t('Series setup'), href: seriesIndex.url() },
    ];

    return (
        <nav className="flex gap-6 overflow-x-auto border-b border-solid border-border whitespace-nowrap">
            {tabs.map((tab) => (
                <Link
                    key={tab.key}
                    href={tab.href}
                    aria-current={tab.key === active ? 'page' : undefined}
                    className={`-mb-px border-b-2 border-solid pb-[10px] text-[14px] leading-[18px] ${
                        tab.key === active
                            ? 'border-primary font-semibold text-text'
                            : 'border-transparent font-medium text-text-muted hover:text-text'
                    }`}
                >
                    {t(tab.label)}
                </Link>
            ))}
        </nav>
    );
}

export function StreamChip({ stream, children }: { stream: string; children: ReactNode }) {
    return (
        <span
            className={`flex h-[22px] items-center rounded-sm px-2 font-mono text-[12px] leading-4 ${
                stream === 'arts' ? 'bg-arts-tint text-arts' : 'bg-science-tint text-science'
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
            <path d="M2 2l6 6M8 2L2 8" fill="none" stroke={tone} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

/** Chips for what is chosen, with a native picker for what is left. */
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
    options: { id: string; name: string }[];
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
                    <select
                        aria-label={label}
                        value=""
                        onChange={(e) => {
                            if (e.target.value) {
                                onAdd(e.target.value);
                            }
                        }}
                        className="h-7 max-w-[160px] rounded-sm border border-solid border-border bg-white px-1 text-[13px] text-text outline-none focus:border-primary"
                    >
                        <option value="">{addLabel}</option>
                        {options.map((option) => (
                            <option key={option.id} value={option.id}>
                                {option.name}
                            </option>
                        ))}
                    </select>
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
