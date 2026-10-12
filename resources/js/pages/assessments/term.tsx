import { Head, Link, router } from '@inertiajs/react';
import { reports, term as termPage } from '@/actions/App/Http/Controllers/TermResultController';
import { AssessmentHeader, type AssessmentTabs, Empty, quietClass, score } from '../../components/assessments/ui';
import { capsLabelClass } from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';

interface TermProps {
    tabs: AssessmentTabs;
    passMark: number;
    terms: { id: string; label: string; complete: boolean }[];
    term: { id: string; label: string; complete: boolean } | null;
    annual: boolean;
    classes: { id: string; name: string }[];
    class: { id: string; name: string } | null;
    columns: { id: string; label: string; published: boolean }[];
    rows: { id: string; name: string; matricule: string; values: Record<string, number | null>; average: number | null; rank: number | null }[];
}

function short(label: string): string {
    return label.replace('Sequence', 'Seq').replace(/^Term \d+ exam$/i, 'Exam');
}

function TermAndYear({ tabs, passMark, terms, term, annual, classes, class: current, columns, rows }: TermProps) {
    const scope = annual ? 'annual' : (term?.id ?? '');
    const visit = (query: Record<string, string>) => termPage.url({ query: { term: scope, class: current?.id ?? '', ...query } });
    const pending = columns.filter((column) => !column.published).length;
    const allDone = terms.length > 0 && terms.every((option) => option.complete);

    return (
        <div className="flex lg:min-h-[calc(100vh-56px)] flex-col gap-5">
            <Head title="Term and year" />
            <AssessmentHeader
                active="term"
                tabs={tabs}
                trail={[{ label: 'Term and year' }]}
                title="Term and year"
                meta={
                    <span
                        className={`flex h-[22px] items-center gap-[6px] rounded-full px-[10px] text-[12px] leading-4 font-medium ${
                            (annual ? allDone : term?.complete) ? 'bg-success-tint text-success' : 'border border-solid border-border bg-surface text-text'
                        }`}
                    >
                        {annual
                            ? allDone
                                ? 'Every term is published'
                                : 'The annual average is complete after the last term is published'
                            : term
                              ? term.complete
                                  ? `${term.label} · every assessment published`
                                  : `${term.label} · ${pending} ${pending === 1 ? 'assessment' : 'assessments'} not published yet`
                              : 'No term'}
                    </span>
                }
            />

            {!current ? (
                <Empty title="No classes this year">Term results are shown class by class.</Empty>
            ) : (
                <div className="flex flex-1 flex-col gap-7 lg:flex-row">
                    <div className="flex min-w-0 flex-1 flex-col gap-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap gap-2">
                                {[...terms.map((option) => ({ key: option.id, label: option.label })), { key: 'annual', label: 'Annual' }].map((option) => (
                                    <Link
                                        key={option.key}
                                        href={visit({ term: option.key })}
                                        preserveScroll
                                        aria-current={option.key === scope ? 'true' : undefined}
                                        className={`flex h-[30px] items-center rounded-full border border-solid px-3 text-[13px] leading-4 ${
                                            option.key === scope
                                                ? 'border-primary bg-primary-tint font-semibold text-primary'
                                                : 'border-border font-medium text-text hover:bg-surface'
                                        }`}
                                    >
                                        {option.label}
                                    </Link>
                                ))}
                            </div>
                            <select
                                aria-label="Class"
                                value={current.id}
                                onChange={(e) => router.get(visit({ class: e.target.value }), {}, { preserveScroll: true })}
                                className="h-[30px] rounded-md border border-solid border-border bg-white px-2 text-[13px] leading-4 font-medium text-text outline-none focus:border-primary"
                            >
                                {classes.map((option) => (
                                    <option key={option.id} value={option.id}>
                                        {option.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {columns.length === 0 ? (
                            <Empty title={annual ? 'No terms yet' : `${term?.label ?? 'This term'} has no scheduled assessments`}>
                                Averages appear once assessments are published.
                            </Empty>
                        ) : rows.length === 0 ? (
                            <Empty title="Nothing published yet">
                                {annual ? 'A term counts once all of its assessments are published.' : 'Publish an assessment’s results and its averages appear here.'}
                            </Empty>
                        ) : (
                            <div className="overflow-x-auto rounded-lg border border-solid border-border">
                                <div className="flex min-w-[560px] flex-col">
                                    <div className={`flex h-8 items-center gap-4 border-b border-solid border-border bg-surface px-[14px] ${capsLabelClass}`}>
                                        <span className="w-10 shrink-0">Rank</span>
                                        <span className="flex-1">Student</span>
                                        {columns.map((column) => (
                                            <span key={column.id} className="w-[70px] shrink-0 truncate text-right">
                                                {short(column.label)}
                                            </span>
                                        ))}
                                        <span className="w-[80px] shrink-0 text-right">{annual ? 'Annual' : 'Term avg'}</span>
                                    </div>
                                    {rows.map((row, position) => (
                                        <div
                                            key={row.id}
                                            className={`flex h-10 shrink-0 items-center gap-4 border-b border-solid border-border px-[14px] last:border-b-0 ${position % 2 === 1 ? 'bg-row-alt' : ''}`}
                                        >
                                            <span className="w-10 shrink-0 font-mono text-[13px] leading-4 text-text">{row.rank ?? '—'}</span>
                                            <span className="min-w-0 flex-1 truncate text-[14px] leading-[18px] font-medium text-text">{row.name}</span>
                                            {columns.map((column) => (
                                                <span key={column.id} className="w-[70px] shrink-0 text-right font-mono text-[13px] leading-4 text-text">
                                                    {score(row.values[column.id])}
                                                </span>
                                            ))}
                                            <span
                                                className={`w-[80px] shrink-0 text-right font-mono text-[14px] leading-[18px] ${
                                                    row.average !== null && row.average < passMark ? 'text-danger' : 'text-text'
                                                }`}
                                            >
                                                {score(row.average)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col gap-[6px] rounded-lg bg-surface p-4">
                            <p className="text-[13px] leading-4 font-semibold text-text">How the numbers are made</p>
                            <p className="text-[13px] leading-[19px] text-text-muted">
                                Term average is the mean of the term’s
                                published assessments, each already weighted by
                                subject coefficient. Annual average is the mean
                                of the term averages. Neither is given or
                                ranked until every mark is in.
                            </p>
                        </div>
                    </div>

                    <aside className="flex shrink-0 flex-col gap-4 border-solid border-border lg:w-[300px] lg:border-l lg:pl-7">
                        {!annual && term && (
                            <div className="flex flex-col gap-3 rounded-lg border border-solid border-border bg-surface p-4">
                                <p className={capsLabelClass}>{term.label} report cards</p>
                                <p className="text-[13px] leading-[19px] text-text">
                                    Each subject’s mark across the term, the
                                    term average, the position and the remark
                                    for the grade.
                                </p>
                                {term.complete ? (
                                    <Link
                                        href={reports.url({ query: { term: term.id, class: current.id } })}
                                        className="flex h-10 items-center justify-center rounded-md bg-primary text-[14px] leading-[18px] font-semibold text-white hover:bg-primary-hover"
                                    >
                                        {term.label} report cards →
                                    </Link>
                                ) : (
                                    <p className="text-[13px] leading-[19px] text-text-muted">
                                        Term report cards open when every
                                        assessment of the term is published.
                                    </p>
                                )}
                                <Link href={reports.url()} className={quietClass}>
                                    Report cards for one assessment
                                </Link>
                            </div>
                        )}
                        <div className="flex flex-col gap-2 rounded-lg border border-solid border-border bg-white p-4">
                            <p className="text-[14px] leading-[18px] font-semibold text-text">Annual average</p>
                            <ul className="flex flex-col">
                                {terms.map((option) => (
                                    <li key={option.id} className="flex items-center justify-between py-1 text-[13px] leading-4">
                                        <span className="text-text-muted">{option.label}</span>
                                        <span className={`font-mono ${option.complete ? 'text-success' : 'text-text-muted'}`}>{option.complete ? 'published' : 'not yet'}</span>
                                    </li>
                                ))}
                            </ul>
                            <p className="text-[13px] leading-[19px] text-text-muted">
                                Complete after the last term is published. It
                                is the figure the promotion decision in
                                Re-enrolment is meant to use.
                            </p>
                        </div>
                    </aside>
                </div>
            )}
        </div>
    );
}

export default withAppShell(TermAndYear);
