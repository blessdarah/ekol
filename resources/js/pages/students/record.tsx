import { Head, Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { edit } from '@/actions/App/Http/Controllers/StudentController';
import {
    StreamChip,
    capsLabelClass,
    outlineButtonClass,
} from '../../components/structure/ui';
import {
    FeePill,
    GENDER_LABELS,
    RELATION_LABELS,
    StudentHeader,
    fullDate,
    money,
} from '../../components/students/ui';
import { withAppShell } from '../../layouts/app-layout';

interface RecordProps {
    yearLabel: string | null;
    currency: string;
    canSeePrivate: boolean;
    student: {
        id: string;
        name: string;
        surname: string;
        given_names: string;
        matricule: string;
        gender: string;
        date_of_birth: string;
        place_of_birth: string | null;
        religion: string | null;
        disability: string | null;
        admitted_on: string;
        transferred_from: string | null;
        class: { name: string; students: number; level: string | null; uses_series: boolean } | null;
        series: { code: string; name: string; stream: string; core: number; electives: number } | null;
        guardians: {
            relation: string;
            name: string;
            phone: string | null;
            occupation: string | null;
            is_main: boolean;
        }[];
        on_whatsapp: boolean;
        lives_with: string | null;
        fees: { status: string | null; balance: number; due: number } | null;
    };
}

const LATER_TABS = [
    { label: 'Academics', arrives: 'Sequences & Exams' },
    { label: 'Fees', arrives: 'Fees' },
    { label: 'Attendance', arrives: 'the timetable' },
];

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex items-baseline gap-4 border-t border-solid border-border py-[10px] last:border-b">
            <dt className="w-[184px] shrink-0 text-[13px] leading-[1.35] text-text-muted">
                {label}
            </dt>
            <dd className="min-w-0 flex-1 text-[14px] leading-[1.35] text-text">
                {children}
            </dd>
        </div>
    );
}

function StudentRecord({ yearLabel, currency, canSeePrivate, student }: RecordProps) {
    const paidShare =
        student.fees && student.fees.due > 0
            ? Math.round(((student.fees.due - student.fees.balance) / student.fees.due) * 100)
            : 0;

    return (
        <div className="flex min-h-[calc(100vh-56px)] flex-col gap-5">
            <Head title={student.name} />
            <StudentHeader
                trail={[{ label: student.name }]}
                title={student.name}
                tag={[student.matricule, student.class?.name, student.series?.code]
                    .filter(Boolean)
                    .join(' · ')}
                meta={[
                    `enrolled ${student.admitted_on.slice(0, 4)}`,
                    student.class?.level,
                ]
                    .filter(Boolean)
                    .join(' · ')}
                action={
                    <Link href={edit.url(student.id)} className={outlineButtonClass}>
                        Edit student
                    </Link>
                }
            />

            <div className="flex gap-6 border-b border-solid border-border">
                <span
                    aria-current="page"
                    className="-mb-px border-b-2 border-solid border-primary pb-[10px] text-[14px] leading-[18px] font-semibold text-text"
                >
                    Overview
                </span>
                {LATER_TABS.map((tab) => (
                    <span
                        key={tab.label}
                        aria-disabled="true"
                        title={`Arrives with ${tab.arrives}`}
                        className="cursor-not-allowed pb-[10px] text-[14px] leading-[18px] font-medium text-text-muted opacity-60"
                    >
                        {tab.label}
                    </span>
                ))}
            </div>

            <div className="flex flex-1 flex-col gap-8 lg:flex-row">
                <div className="flex min-w-0 flex-1 flex-col gap-[22px]">
                    <section className="flex flex-col gap-2">
                        <p className={capsLabelClass}>Profile</p>
                        <dl className="flex flex-col">
                            <Row label="Surname">{student.surname}</Row>
                            <Row label="Name">{student.given_names}</Row>
                            <Row label="Born">
                                {fullDate(student.date_of_birth)}
                                {student.place_of_birth ? ` in ${student.place_of_birth}` : ''} ·{' '}
                                {GENDER_LABELS[student.gender]}
                            </Row>
                            {canSeePrivate && (
                                <>
                                    <Row label="Religion">{student.religion ?? 'Not recorded'}</Row>
                                    <Row label="Disability">{student.disability ?? 'None'}</Row>
                                </>
                            )}
                            <Row label="Admitted">
                                {fullDate(student.admitted_on)}
                                {student.transferred_from
                                    ? ` · transferred from ${student.transferred_from}`
                                    : ''}
                            </Row>
                        </dl>
                    </section>

                    <section className="flex flex-col gap-2">
                        <p className={capsLabelClass}>Class and series</p>
                        <dl className="flex flex-col">
                            <Row label="Class">
                                {student.class
                                    ? `${student.class.name} · ${student.class.students} students`
                                    : 'Not placed in a class this year'}
                            </Row>
                            {student.class?.uses_series && (
                                <>
                                    <Row label="Series">
                                        {student.series ? (
                                            <span className="flex items-center gap-2">
                                                <StreamChip stream={student.series.stream}>
                                                    {student.series.code}
                                                </StreamChip>
                                                {student.series.name}
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-[6px] text-[#8A5A12]">
                                                <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-warning" />
                                                No series yet. Until one is
                                                chosen, there is no subject
                                                list.
                                            </span>
                                        )}
                                    </Row>
                                    {student.series && (
                                        <Row label="Subjects">
                                            {student.series.core + student.series.electives} in the
                                            series · {student.series.core} core,{' '}
                                            {student.series.electives} in the elective pool
                                        </Row>
                                    )}
                                </>
                            )}
                        </dl>
                    </section>

                    <section className="flex flex-col gap-2">
                        <p className={capsLabelClass}>Parents and guardian</p>
                        <dl className="flex flex-col">
                            {student.guardians.map((guardian) => (
                                <div
                                    key={guardian.relation}
                                    className="flex items-center gap-4 border-t border-solid border-border py-[10px]"
                                >
                                    <dt className="flex w-[184px] shrink-0 flex-col">
                                        <span className="text-[14px] leading-[1.35] text-text">
                                            {guardian.name}
                                        </span>
                                        <span className="text-[12px] leading-4 text-text-muted">
                                            {[
                                                RELATION_LABELS[guardian.relation],
                                                guardian.occupation?.toLowerCase(),
                                                guardian.is_main ? 'main contact' : null,
                                            ]
                                                .filter(Boolean)
                                                .join(' · ')}
                                        </span>
                                    </dt>
                                    <dd className="flex flex-1 items-center gap-4">
                                        <span className="font-mono text-[13px] leading-[1.35] text-text">
                                            {guardian.phone ?? '—'}
                                        </span>
                                        <span className="flex-1" />
                                        {guardian.is_main && student.on_whatsapp && (
                                            <span className="flex h-[22px] items-center rounded-full bg-success-tint px-2 text-[12px] leading-4 font-medium text-success">
                                                WhatsApp
                                            </span>
                                        )}
                                    </dd>
                                </div>
                            ))}
                            <Row label="Lives with">{student.lives_with ?? 'Not recorded'}</Row>
                        </dl>
                    </section>
                </div>

                <aside className="flex shrink-0 flex-col gap-5 border-solid border-border lg:w-[328px] lg:border-l lg:pl-8">
                    {student.fees ? (
                        <div className="flex flex-col gap-[14px] rounded-lg border border-solid border-border bg-surface p-4">
                            <div className="flex items-center justify-between">
                                <p className={capsLabelClass}>
                                    Fees{yearLabel ? ` · ${yearLabel}` : ''}
                                </p>
                                <FeePill status={student.fees.status} />
                            </div>
                            <div className="flex flex-col gap-[2px]">
                                <p className="font-mono text-[28px] leading-[34px] text-text">
                                    {money(student.fees.balance, currency)}
                                </p>
                                <p className="text-[13px] leading-4 text-text-muted">
                                    still to pay, of {money(student.fees.due, currency)}
                                </p>
                            </div>
                            <div
                                role="progressbar"
                                aria-label="Share of fees paid"
                                aria-valuenow={paidShare}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                className="h-[6px] overflow-hidden rounded-full bg-border"
                            >
                                <div
                                    className="h-full rounded-full bg-success"
                                    style={{ width: `${paidShare}%` }}
                                />
                            </div>
                            <p className="text-[12px] leading-[18px] text-text-muted">
                                Payments are recorded in Fees.
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2 rounded-lg border border-solid border-border bg-surface p-4">
                            <p className={capsLabelClass}>Fees</p>
                            <p className="text-[13px] leading-[19px] text-text-muted">
                                No fee plan was set for this student’s level
                                at admission, so nothing is owed yet.
                            </p>
                        </div>
                    )}
                    <div className="flex flex-col gap-[10px] rounded-lg border border-dashed border-border bg-white p-4">
                        <p className="text-[13px] leading-4 font-semibold text-text">
                            Changes to enrolment
                        </p>
                        <Link
                            href={edit.url(student.id)}
                            className="text-[13px] leading-4 font-medium text-primary hover:underline"
                        >
                            Move to another class
                        </Link>
                        {student.class?.uses_series && (
                            <Link
                                href={edit.url(student.id)}
                                className="text-[13px] leading-4 font-medium text-primary hover:underline"
                            >
                                {student.series ? 'Change series' : 'Choose a series'}
                            </Link>
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
}

export default withAppShell(StudentRecord);
