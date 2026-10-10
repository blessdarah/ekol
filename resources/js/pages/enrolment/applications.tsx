import { Head, Link, router } from '@inertiajs/react';
import { useRef, useState } from 'react';
import {
    create,
    index,
    show,
} from '@/actions/App/Http/Controllers/ApplicationController';
import { reEnrolment } from '@/actions/App/Http/Controllers/EnrolmentController';
import {
    EnrolmentHeader,
    type EnrolmentProgress,
    StagePill,
    count,
    nextStepClass,
} from '../../components/enrolment/ui';
import { PlusIcon, capsLabelClass, solidButtonClass } from '../../components/structure/ui';
import { shortDate } from '../../components/students/ui';
import { withAppShell } from '../../layouts/app-layout';

interface Filters {
    stage: string;
    q: string;
    level: string;
}

interface ApplicationsProps {
    enrolment: EnrolmentProgress;
    counts: Record<string, number>;
    filters: Filters;
    levels: { id: string; name: string }[];
    applications: {
        rows: {
            id: string;
            name: string;
            reference: string;
            level: string | null;
            from: string | null;
            transfer: boolean;
            applied: string;
            stage: string;
            missing: number;
        }[];
        page: number;
        lastPage: number;
        total: number;
    };
}

const STAGE_TABS = [
    { key: '', label: 'All', count: 'all' },
    { key: 'to_review', label: 'To review', count: 'to_review' },
    { key: 'admitted', label: 'Admitted', count: 'admitted' },
    { key: 'waitlist', label: 'Waitlist', count: 'waitlist' },
    { key: 'declined', label: 'Declined', count: 'declined' },
];

function Applications({ enrolment, counts, filters, levels, applications }: ApplicationsProps) {
    const [search, setSearch] = useState(filters.q);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    function visit(patch: Partial<Filters> & { page?: number }) {
        const next = { ...filters, ...patch };
        const query: Record<string, string | number> = {};

        if (next.stage) {
            query.stage = next.stage;
        }
        if (next.q) {
            query.q = next.q;
        }
        if (next.level) {
            query.level = next.level;
        }
        if (patch.page && patch.page > 1) {
            query.page = patch.page;
        }

        router.get(index.url({ query }), {}, { preserveState: true, preserveScroll: true, replace: true });
    }

    function onSearch(value: string) {
        setSearch(value);
        if (timer.current) {
            clearTimeout(timer.current);
        }
        timer.current = setTimeout(() => visit({ q: value.trim() }), 300);
    }

    const filtered = filters.stage !== '' || filters.q !== '' || filters.level !== '';

    return (
        <div className="flex flex-col gap-5">
            <Head title="Applications" />
            <EnrolmentHeader
                active="applications"
                progress={enrolment}
                trail={[{ label: 'Applications' }]}
                title="Applications"
                meta="record each application here, then review it"
                action={
                    <Link href={create.url()} className={solidButtonClass}>
                        <PlusIcon />
                        Add application
                    </Link>
                }
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                    {STAGE_TABS.map((tab) => {
                        const selected = filters.stage === tab.key;

                        return (
                            <button
                                key={tab.key}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => visit({ stage: tab.key })}
                                className={`flex h-8 items-center gap-[6px] rounded-full border border-solid px-[14px] text-[13px] leading-4 ${
                                    selected
                                        ? 'border-primary bg-primary-tint font-semibold text-primary'
                                        : 'border-border font-medium text-text hover:bg-surface'
                                }`}
                            >
                                {tab.key === 'to_review' && (counts.to_review ?? 0) > 0 && (
                                    <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-warning" />
                                )}
                                {tab.label} · {count(counts[tab.count] ?? 0)}
                            </button>
                        );
                    })}
                </div>
                <div className="flex flex-wrap gap-2">
                    <label className="flex h-9 w-[240px] items-center gap-2 rounded-md border border-solid border-border px-3 focus-within:border-primary">
                        <svg width="14" height="14" viewBox="0 0 24 24" className="shrink-0">
                            <circle cx="11" cy="11" r="7" fill="none" stroke="#56625C" strokeWidth="2" />
                            <path d="M16 16l5 5" fill="none" stroke="#56625C" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        <span className="sr-only">Search applications</span>
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => onSearch(e.target.value)}
                            placeholder="Name or reference"
                            className="w-full bg-transparent text-[14px] leading-[18px] text-text outline-none placeholder:text-text-muted"
                        />
                    </label>
                    <select
                        aria-label="Applying to"
                        value={filters.level}
                        onChange={(e) => visit({ level: e.target.value })}
                        className="h-9 rounded-md border border-solid border-border bg-white px-3 text-[13px] leading-4 font-medium text-text outline-none focus:border-primary"
                    >
                        <option value="">Applying to: any level</option>
                        {levels.map((level) => (
                            <option key={level.id} value={level.id}>
                                {level.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {applications.rows.length === 0 ? (
                <div className="flex flex-col items-start gap-3 rounded-md bg-surface p-5">
                    <p className="text-[14px] leading-[18px] font-semibold text-text">
                        {filtered ? 'No application matches' : `No applications for ${enrolment.year} yet`}
                    </p>
                    <p className="max-w-[560px] text-[13px] leading-[19px] text-text">
                        {filtered
                            ? 'Try another stage, level or name.'
                            : 'When a family applies, record the application here. It waits under To review until someone admits, waitlists or declines it.'}
                    </p>
                    {!filtered && (
                        <Link href={create.url()} className={solidButtonClass}>
                            <PlusIcon />
                            Add application
                        </Link>
                    )}
                </div>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-solid border-border">
                    <div className="flex min-w-[880px] flex-col">
                        <div className={`flex h-9 items-center gap-4 border-b border-solid border-border bg-surface px-4 ${capsLabelClass}`}>
                            <span className="w-[250px] shrink-0">Applicant</span>
                            <span className="w-[120px] shrink-0">Applying to</span>
                            <span className="flex-1">Coming from</span>
                            <span className="w-20 shrink-0">Applied</span>
                            <span className="w-40 shrink-0">Stage</span>
                            <span className="w-[70px] shrink-0" />
                        </div>
                        {applications.rows.map((row) => (
                            <Link
                                key={row.id}
                                href={show.url(row.id)}
                                className="flex h-[54px] shrink-0 items-center gap-4 border-b border-solid border-border px-4 last:border-b-0 hover:bg-surface"
                            >
                                <span className="flex w-[250px] shrink-0 flex-col">
                                    <span className="truncate text-[14px] leading-[18px] font-medium text-text">{row.name}</span>
                                    <span className="font-mono text-[11px] leading-[14px] text-text-muted">{row.reference}</span>
                                </span>
                                <span className="w-[120px] shrink-0 truncate text-[14px] leading-[18px] text-text">{row.level}</span>
                                <span className="min-w-0 flex-1 truncate text-[13px] leading-4 text-text-muted">
                                    {[row.from, row.transfer ? 'transfer' : null].filter(Boolean).join(' · ') || '—'}
                                </span>
                                <span className="w-20 shrink-0 font-mono text-[13px] leading-4 text-text-muted">{shortDate(row.applied)}</span>
                                <span className="flex w-40 shrink-0">
                                    <StagePill stage={row.stage === 'to_review' && row.missing > 0 ? 'documents' : row.stage} />
                                </span>
                                <span className="w-[70px] shrink-0 text-right text-[13px] leading-4 font-medium text-primary">
                                    {row.stage === 'to_review' ? 'Review' : 'Open'}
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4">
                    <p className="text-[13px] leading-4 text-text-muted">
                        {applications.rows.length} of {count(applications.total)} shown · newest first
                    </p>
                    {applications.lastPage > 1 && (
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                disabled={applications.page <= 1}
                                onClick={() => visit({ page: applications.page - 1 })}
                                className="flex h-7 items-center rounded-md px-3 text-[13px] text-text hover:bg-surface disabled:opacity-40"
                            >
                                ← Newer
                            </button>
                            <span className="px-1 font-mono text-[12px] text-text-muted">
                                {applications.page} / {applications.lastPage}
                            </span>
                            <button
                                type="button"
                                disabled={applications.page >= applications.lastPage}
                                onClick={() => visit({ page: applications.page + 1 })}
                                className="flex h-7 items-center rounded-md px-3 text-[13px] text-text hover:bg-surface disabled:opacity-40"
                            >
                                Older →
                            </button>
                        </div>
                    )}
                </div>
                <Link href={reEnrolment.url()} className={nextStepClass}>
                    Next: re-enrolment →
                </Link>
            </div>
        </div>
    );
}

export default withAppShell(Applications);
