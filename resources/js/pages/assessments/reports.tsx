import { Head, Link } from '@inertiajs/react';
import { print as printCards, reports } from '@/actions/App/Http/Controllers/TermResultController';
import {
    AssessmentHeader,
    type AssessmentTabs,
    Empty,
    ReportCard,
    type ReportCardData,
    day,
    linkClass,
    ordinal,
    primaryClass,
    score,
} from '../../components/assessments/ui';
import { capsLabelClass } from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';

interface ReportsProps {
    tabs: AssessmentTabs;
    issuer: { name: string; code: string };
    yearLabel: string | null;
    options: { kind: string; id: string; label: string }[];
    scope: { kind: string; id: string; label: string; published_on: string | null } | null;
    classes: { id: string; name: string; pupils: number }[];
    class: { id: string; name: string } | null;
    students: { id: string; name: string; average: number | null; position: number | null }[];
    preview: ReportCardData | null;
}

function Reports({ tabs, issuer, yearLabel, options, scope, classes, class: current, students, preview }: ReportsProps) {
    if (!scope) {
        return (
            <div className="flex flex-col gap-5">
                <Head title="Report cards" />
                <AssessmentHeader active="reports" tabs={tabs} trail={[{ label: 'Report cards' }]} title="Report cards" />
                <Empty title="No results are published yet">Report cards are made from published marks. Publish an assessment’s results first.</Empty>
            </div>
        );
    }

    const query = (extra: Record<string, string>) => ({ query: { [scope.kind]: scope.id, ...extra } });

    return (
        <div className="flex lg:min-h-[calc(100vh-56px)] flex-col gap-5">
            <Head title="Report cards" />
            <AssessmentHeader
                active="reports"
                tabs={tabs}
                trail={[{ label: 'Report cards' }]}
                title="Report cards"
                meta={
                    <span className="flex h-[22px] items-center gap-[6px] rounded-full bg-success-tint px-[10px] text-[12px] leading-4 font-medium text-success">
                        <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-success" />
                        {scope.label}
                        {scope.published_on ? ` · results published ${day(scope.published_on)}` : ' · every assessment published'}
                    </span>
                }
                action={
                    current && (
                        <Link href={printCards.url(query({ class: current.id }))} className={primaryClass}>
                            Print {current.name} cards
                        </Link>
                    )
                }
            />

            <div className="flex flex-wrap items-center gap-2">
                <span className={`mr-1 ${capsLabelClass}`}>Cards for</span>
                {options.map((option) => (
                    <Link
                        key={`${option.kind}-${option.id}`}
                        href={reports.url({ query: { [option.kind]: option.id } })}
                        aria-current={option.kind === scope.kind && option.id === scope.id ? 'true' : undefined}
                        className={`flex h-[30px] items-center rounded-full border border-solid px-3 text-[13px] leading-4 ${
                            option.kind === scope.kind && option.id === scope.id
                                ? 'border-primary bg-primary-tint font-semibold text-primary'
                                : 'border-border font-medium text-text hover:bg-surface'
                        }`}
                    >
                        {option.label}
                    </Link>
                ))}
            </div>

            <div className="flex flex-1 flex-col gap-7 lg:flex-row">
                <div className="flex min-w-0 flex-1 flex-col gap-4">
                    <div className="overflow-x-auto rounded-lg border border-solid border-border">
                        <div className="flex min-w-[420px] flex-col">
                            <div className={`flex h-8 items-center gap-4 border-b border-solid border-border bg-surface px-[14px] ${capsLabelClass}`}>
                                <span className="flex-1">Class</span>
                                <span className="w-[60px] shrink-0 text-right">Pupils</span>
                                <span className="w-[110px] shrink-0">Report cards</span>
                                <span className="w-[70px] shrink-0" />
                            </div>
                            {classes.map((row, position) => {
                                const active = row.id === current?.id;

                                return (
                                    <div
                                        key={row.id}
                                        className={`flex h-11 shrink-0 items-center gap-4 border-b border-solid border-border px-[14px] last:border-b-0 ${
                                            active ? 'bg-primary-tint' : position % 2 === 1 ? 'bg-row-alt' : ''
                                        }`}
                                    >
                                        <Link
                                            href={reports.url(query({ class: row.id }))}
                                            preserveScroll
                                            className={`min-w-0 flex-1 truncate text-[14px] leading-[18px] hover:underline ${active ? 'font-semibold text-text' : 'font-medium text-text'}`}
                                        >
                                            {row.name}
                                        </Link>
                                        <span className="w-[60px] shrink-0 text-right font-mono text-[13px] leading-4 text-text">{row.pupils}</span>
                                        <span className="flex w-[110px] shrink-0">
                                            <span className="flex h-[22px] items-center rounded-full bg-success-tint px-2 text-[12px] leading-4 font-medium text-success">
                                                Ready
                                            </span>
                                        </span>
                                        <Link href={printCards.url(query({ class: row.id }))} className={`w-[70px] shrink-0 text-right ${linkClass}`}>
                                            Print
                                        </Link>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {current && students.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <p className={capsLabelClass}>{current.name} · pick a student to preview</p>
                            <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                                {students.map((student) => (
                                    <li key={student.id} className="border-b border-solid border-border">
                                        <Link
                                            href={reports.url(query({ class: current.id, student: student.id }))}
                                            preserveScroll
                                            className={`flex items-center justify-between gap-3 py-2 hover:underline ${student.id === preview?.id ? 'font-semibold' : ''}`}
                                        >
                                            <span className="truncate text-[13px] leading-4 text-text">{student.name}</span>
                                            <span className="shrink-0 font-mono text-[12px] leading-4 text-text-muted">
                                                {score(student.average)}
                                                {student.position !== null ? ` · ${ordinal(student.position)}` : ''}
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <p className="text-[13px] leading-[19px] text-text-muted">
                        Cards are made from the published marks each time they
                        are opened, so an approved correction shows at once.
                        Print a class to paper or save it as a PDF. Nothing is
                        sent to parents from here.
                    </p>
                </div>

                <aside className="flex shrink-0 flex-col gap-3 lg:w-[360px]">
                    <p className={capsLabelClass}>Preview{preview ? ` · ${preview.name}` : ''}</p>
                    {preview ? (
                        <ReportCard card={preview} issuer={issuer} yearLabel={yearLabel} />
                    ) : (
                        <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">This class has no students with published marks.</p>
                    )}
                </aside>
            </div>
        </div>
    );
}

export default withAppShell(Reports);
