import { Head, Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import {
    edit,
    index,
} from '@/actions/App/Http/Controllers/SubjectController';
import { Note, longDate } from '../../components/staff/ui';
import { StructureHeader, capsLabelClass } from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';

interface RecordProps {
    yearLabel: string | null;
    subject: {
        id: string;
        name: string;
        code: string;
        department: string;
        kind: string;
        note: string | null;
        levels_label: string;
        level_names: string[];
        coefficient: number | null;
        classes: number;
        teachers: number;
        unstaffed: number;
        periods: number;
        rows: {
            class: string | null;
            students: number;
            teacher: string | null;
            weekly_periods: number;
        }[];
        not_offered: string[];
    };
    lastEdit: { by: string | null; on: string } | null;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex items-baseline gap-4 border-t border-solid border-border py-3 last:border-b">
            <dt className="w-[184px] shrink-0 text-[13px] leading-[1.35] text-text-muted">
                {label}
            </dt>
            <dd className="min-w-0 text-[14px] leading-[1.35] text-text">
                {children}
            </dd>
        </div>
    );
}

function SubjectRecord({ yearLabel, subject, lastEdit }: RecordProps) {
    const staffed = subject.classes > 0 && subject.unstaffed === 0;
    const coefficient = subject.coefficient ?? '—';
    const levels =
        subject.level_names.length > 0 ? subject.level_names.join(', ') : 'No level yet';

    return (
        <div className="flex min-h-[calc(100vh-56px)] flex-col gap-7">
            <Head title={subject.name} />
            <StructureHeader
                path={`Classes & Subjects / ${subject.name}`}
                title="One subject record"
                tag={`Record${yearLabel ? ` · ${yearLabel}` : ''}`}
                meta={[
                    subject.code,
                    subject.department,
                    subject.levels_label !== '—' ? subject.levels_label : null,
                    `coefficient ${coefficient}`,
                    `${subject.periods} periods a week`,
                ]
                    .filter(Boolean)
                    .join(' · ')}
            />

            <div className="flex flex-1 flex-col gap-8 lg:flex-row">
                <div className="flex min-w-0 flex-1 flex-col gap-6">
                    <div className="flex flex-wrap items-center gap-4">
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-tint font-display text-[20px] font-bold text-primary">
                            {subject.name.slice(0, 2).toUpperCase()}
                        </span>
                        <div className="flex min-w-0 flex-col gap-1">
                            <p className="font-display text-[20px] leading-[1.1] font-semibold text-text">
                                {subject.name}
                            </p>
                            <p className="text-[13px] leading-[1.35] text-text-muted">
                                {[subject.department, subject.kind, `coefficient ${coefficient}`].join(' · ')}
                            </p>
                        </div>
                        <span className="ml-auto flex h-7 shrink-0 items-center gap-2 rounded-md border border-solid border-border px-3 text-[13px] font-medium text-text">
                            <span
                                className={`h-[6px] w-[6px] shrink-0 rounded-full ${staffed ? 'bg-success' : 'bg-warning'}`}
                            />
                            {subject.classes === 0
                                ? 'No classes yet'
                                : staffed
                                  ? 'All classes staffed'
                                  : `${subject.unstaffed} ${subject.unstaffed === 1 ? 'class needs' : 'classes need'} a teacher`}
                        </span>
                    </div>

                    <section className="flex flex-col gap-2">
                        <p className={capsLabelClass}>Subject profile</p>
                        <dl className="flex flex-col">
                            <Row label="Subject code">
                                <span className="font-mono">{subject.code}</span>
                            </Row>
                            <Row label="Department">{subject.department}</Row>
                            <Row label="Coefficient">
                                {coefficient} · the same for sequences and
                                exams
                            </Row>
                            <Row label="Levels covered">
                                {levels} · {subject.classes}{' '}
                                {subject.classes === 1 ? 'class' : 'classes'}
                            </Row>
                            {subject.note && <Row label="Internal note">{subject.note}</Row>}
                        </dl>
                    </section>

                    <section className="flex flex-col gap-2">
                        <p className={capsLabelClass}>Classes &amp; teachers</p>
                        {subject.rows.length === 0 ? (
                            <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                                This subject is a draft with no classes. Edit
                                it to choose the classes that take it.
                            </p>
                        ) : (
                            <div className="flex flex-col">
                                <div className="flex items-center gap-4 border-y border-solid border-border py-2 text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase">
                                    <span className="w-[184px] shrink-0">Class</span>
                                    <span className="flex-1">Teacher</span>
                                    <span className="w-[120px] shrink-0">Weekly periods</span>
                                </div>
                                {subject.rows.map((row) => (
                                    <div
                                        key={row.class}
                                        className="flex items-baseline gap-4 border-b border-solid border-border py-3"
                                    >
                                        <span className="flex w-[184px] shrink-0 items-baseline gap-2">
                                            <span className="text-[14px] leading-[18px] font-medium text-text">
                                                {row.class}
                                            </span>
                                            <span className="font-mono text-[12px] leading-4 text-text-muted">
                                                {row.students}
                                            </span>
                                        </span>
                                        <span
                                            className={`flex-1 text-[14px] leading-[18px] ${row.teacher ? 'text-text' : 'text-warning'}`}
                                        >
                                            {row.teacher ?? 'No teacher yet'}
                                        </span>
                                        <span className="w-[120px] shrink-0 font-mono text-[14px] leading-[18px] text-text">
                                            {row.weekly_periods}
                                        </span>
                                    </div>
                                ))}
                                <div className="flex items-center justify-between border-b border-solid border-border py-3">
                                    <span className="text-[13px] leading-4 text-text-muted">
                                        {subject.not_offered.length > 0
                                            ? `Not offered in ${subject.not_offered.join(', ')}`
                                            : 'Offered in every class of these levels'}
                                    </span>
                                    <span className="flex items-baseline gap-[6px]">
                                        <span className="font-mono text-[13px] leading-4 text-text">
                                            {subject.periods} periods
                                        </span>
                                        <span className="text-[13px] leading-4 text-text-muted">
                                            per week in total
                                        </span>
                                    </span>
                                </div>
                            </div>
                        )}
                    </section>
                </div>

                <aside className="flex shrink-0 flex-col gap-6 border-solid border-border lg:w-[328px] lg:border-l lg:pl-8">
                    <div className="flex flex-col gap-3">
                        <p className={capsLabelClass}>Reporting impact</p>
                        <div className="flex items-start gap-2 text-[13px] leading-[1.5] text-text">
                            <span className="mt-[7px] h-[6px] w-[6px] shrink-0 rounded-full bg-warning" />
                            {subject.name} counts {coefficient} toward the
                            class average in every class it is taught in, for
                            both sequences and exams.
                        </div>
                        <p className="text-[13px] leading-[1.5] text-text-muted">
                            Changing the coefficient changes every average
                            and position from the next entry onwards.
                        </p>
                    </div>
                    <Note title="Coefficients change over time">
                        Nothing in this record was checked with a government
                        body. It exists only inside the school: its
                        coefficient, its teachers, and the classes it is
                        taught to.
                    </Note>
                    <div className="mt-auto flex flex-col gap-2">
                        <p className="text-[12px] leading-[1.5] text-text-muted">
                            {lastEdit
                                ? `Last edited${lastEdit.by ? ` by the ${lastEdit.by}` : ''} on ${longDate(lastEdit.on, false)}. `
                                : ''}
                            Every change is kept so a term’s averages can
                            always be explained.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Link
                                href={edit.url(subject.id)}
                                className="flex h-9 items-center rounded-md border border-solid border-border px-4 text-[14px] font-medium text-primary hover:bg-surface"
                            >
                                Edit this subject
                            </Link>
                            <Link
                                href={index.url()}
                                className="flex h-9 items-center rounded-md px-[14px] text-[14px] font-medium text-primary hover:underline"
                            >
                                Back to roster
                            </Link>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}

export default withAppShell(SubjectRecord);
