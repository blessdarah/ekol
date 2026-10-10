import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { index as seriesIndex } from '@/actions/App/Http/Controllers/SeriesController';
import { index as levelsIndex } from '@/actions/App/Http/Controllers/StructureController';

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
    crumb,
    title,
    tag,
    meta,
    action,
}: {
    crumb?: string;
    title: string;
    tag: string;
    meta?: string;
    action?: ReactNode;
}) {
    return (
        <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-[6px]">
                <p className="text-[13px] leading-4 text-text-muted">
                    Classes &amp; Subjects / Levels and series
                    {crumb ? ` / ${crumb}` : ''}
                </p>
                <h1 className="font-display text-[40px] leading-[44px] font-extrabold tracking-[-0.02em] text-text">
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

export function StructureTabs({ active }: { active: 'levels' | 'series' }) {
    const tabs = [
        { key: 'levels', label: 'Levels', href: levelsIndex.url() },
        { key: 'series', label: 'Series setup', href: seriesIndex.url() },
    ];

    return (
        <nav className="flex gap-6 border-b border-solid border-border">
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
                    {tab.label}
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
