import { Head, Link, useForm } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { publish } from '@/actions/App/Http/Controllers/TimetableController';
import { show as review } from '@/actions/App/Http/Controllers/TimetableReviewController';
import { ErrorText, capsLabelClass, fieldLabelClass } from '../../components/structure/ui';
import {
    TimetableHeader,
    type TimetablePhase,
    linkClass,
    plural,
    quietActionClass,
} from '../../components/timetable/ui';
import { withAppShell } from '../../layouts/app-layout';

interface PublishProps {
    phase: TimetablePhase;
    checks: { placed: number; total: number; clashes: number };
    warnings: { title: string; action: { label: string; href: string } | null }[];
    diff: { from: number; added: number; added_subjects: string[]; moved: number; teachers: number; classes: number } | null;
    defaultDate: string;
    termEnds: string;
}

function Row({ dot, label, children }: { dot?: string; label: ReactNode; children: ReactNode }) {
    return (
        <div className="flex items-center gap-[10px] border-b border-solid border-border py-[10px]">
            {dot && <span className={`h-[6px] w-[6px] shrink-0 rounded-full ${dot}`} />}
            <span className="min-w-0 flex-1 text-[14px] leading-[18px] text-text">{label}</span>
            {children}
        </div>
    );
}

function Publish({ phase, checks, warnings, diff, defaultDate, termEnds }: PublishProps) {
    const form = useForm({ effective_on: defaultDate });
    const errors = form.errors as Record<string, string | undefined>;
    const figure = (value: number) => new Intl.NumberFormat('en-US').format(value);
    const ready = checks.placed === checks.total && checks.clashes === 0 && checks.total > 0;
    const mono = 'shrink-0 font-mono text-[13px] leading-4';

    return (
        <div className="flex min-h-[calc(100vh-56px)] flex-col gap-5">
            <Head title={`Publish version ${phase.draft}`} />
            <TimetableHeader
                page="publish"
                phase={phase}
                trail={[{ label: 'Publish' }]}
                title={`Publish version ${phase.draft}`}
                meta="The school works from the new timetable only after this step."
            />

            <div className="flex flex-1 flex-col gap-7 lg:flex-row">
                <div className="flex min-w-0 flex-1 flex-col gap-6">
                    <section className="flex flex-col">
                        <p className={`border-b border-solid border-border pb-2 ${capsLabelClass}`}>Checks</p>
                        <Row dot={checks.placed === checks.total ? 'bg-success' : 'bg-danger'} label="Every lesson is placed">
                            <span className={`${mono} text-text-muted`}>
                                {figure(checks.placed)} of {figure(checks.total)}
                            </span>
                        </Row>
                        <Row dot={checks.clashes === 0 ? 'bg-success' : 'bg-danger'} label="No teacher or room is in two places at once">
                            <span className={`${mono} text-text-muted`}>{plural(checks.clashes, 'clash', 'clashes')}</span>
                        </Row>
                        {warnings.map((warning) => (
                            <Row key={warning.title} dot="bg-warning" label={warning.title}>
                                {warning.action && (
                                    <Link href={warning.action.href} className={`shrink-0 ${linkClass}`}>
                                        {warning.action.label} →
                                    </Link>
                                )}
                            </Row>
                        ))}
                    </section>

                    {diff ? (
                        <section className="flex flex-col">
                            <p className={`border-b border-solid border-border pb-2 ${capsLabelClass}`}>
                                What changes from version {diff.from}
                            </p>
                            <Row label={`Lessons added${diff.added_subjects.length > 0 ? `: ${diff.added_subjects.join(', ')}` : ''}`}>
                                <span className={`${mono} text-text`}>+{figure(diff.added)}</span>
                            </Row>
                            <Row label="Lessons moved to another day or period">
                                <span className={`${mono} text-text`}>{figure(diff.moved)}</span>
                            </Row>
                            <Row label="Teachers whose week changes · classes whose week changes">
                                <span className={`${mono} text-text`}>
                                    {figure(diff.teachers)} · {figure(diff.classes)}
                                </span>
                            </Row>
                        </section>
                    ) : (
                        <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                            This is the first timetable for {phase.term}, so
                            there is no earlier version to compare it with.
                        </p>
                    )}
                </div>

                <aside className="flex shrink-0 flex-col gap-4 border-solid border-border lg:w-[330px] lg:border-l lg:pl-7">
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            form.post(publish.url());
                        }}
                        className="flex flex-col gap-[14px] rounded-lg border border-solid border-border bg-surface p-4"
                    >
                        <p className={capsLabelClass}>When you publish</p>
                        <label className={`flex flex-col gap-[6px] ${fieldLabelClass}`}>
                            Takes effect on
                            <input
                                type="date"
                                value={form.data.effective_on}
                                max={termEnds}
                                onChange={(e) => form.setData('effective_on', e.target.value)}
                                className="h-10 w-full rounded-md border border-solid border-border bg-white px-3 font-mono text-[14px] leading-[18px] text-text outline-none focus:border-primary"
                            />
                            <ErrorText message={errors.effective_on} />
                        </label>
                        <p className="text-[13px] leading-[18px] text-text-muted">
                            Nobody is told automatically. Share the new
                            timetable with teachers and families yourself.
                        </p>
                        <ErrorText message={errors.publish} />
                        <div className="flex flex-col gap-2">
                            <button
                                type="submit"
                                disabled={!ready || form.processing}
                                className="flex h-10 items-center justify-center rounded-md bg-primary px-3 text-[14px] leading-[18px] font-semibold text-white hover:bg-primary-hover disabled:opacity-40"
                            >
                                Publish version {phase.draft}
                            </button>
                            <Link href={review.url()} className={quietActionClass}>
                                ← Back to the timetable
                            </Link>
                        </div>
                        {!ready && (
                            <p className="text-[13px] leading-[18px] text-danger">
                                Finish the review first: place every lesson and
                                clear every clash.
                            </p>
                        )}
                    </form>
                    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border bg-white p-4">
                        <p className="text-[13px] leading-4 font-semibold text-text">After publishing</p>
                        <p className="text-[13px] leading-[19px] text-text-muted">
                            Version {phase.draft} is live
                            {phase.live !== null ? ` and version ${phase.live} moves to history` : ''}. Later one-off
                            changes go through Changes, not a new version.
                        </p>
                    </div>
                </aside>
            </div>
        </div>
    );
}

export default withAppShell(Publish);
