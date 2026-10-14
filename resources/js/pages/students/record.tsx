import { Head, Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import {
    change as changeSeries,
    one as chooseSeries,
} from '@/actions/App/Http/Controllers/SeriesRegistrationController';
import { studentTab as feesTab } from '@/actions/App/Http/Controllers/FeeController';
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
    StudentTabs,
    fullDate,
    money,
} from '../../components/students/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

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
        class: {
            name: string;
            students: number;
            level: string | null;
            uses_series: boolean;
        } | null;
        series: {
            code: string;
            name: string;
            stream: string;
            core: number;
            electives: number;
        } | null;
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

function StudentRecord({
    yearLabel,
    currency,
    canSeePrivate,
    student,
}: RecordProps) {
    const paidShare =
        student.fees && student.fees.due > 0
            ? Math.round(
                  ((student.fees.due - student.fees.balance) /
                      student.fees.due) *
                      100,
              )
            : 0;

    return (
        <div className="flex flex-col gap-5 lg:min-h-[calc(100vh-56px)]">
            <Head title={student.name} />
            <StudentHeader
                trail={[{ label: student.name }]}
                title={student.name}
                tag={[
                    student.matricule,
                    student.class?.name,
                    student.series?.code,
                ]
                    .filter(Boolean)
                    .join(' · ')}
                meta={[
                    `enrolled ${student.admitted_on.slice(0, 4)}`,
                    student.class?.level,
                ]
                    .filter(Boolean)
                    .join(' · ')}
                action={
                    <Link
                        href={edit.url(student.id)}
                        className={outlineButtonClass}
                    >
                        {t('Edit student')}
                    </Link>
                }
            />

            <StudentTabs studentId={student.id} active="overview" />

            <div className="flex flex-1 flex-col gap-8 lg:flex-row">
                <div className="flex min-w-0 flex-1 flex-col gap-[22px]">
                    <section className="flex flex-col gap-2">
                        <p className={capsLabelClass}>{t('Profile')}</p>
                        <dl className="flex flex-col">
                            <Row label={t('Surname')}>{student.surname}</Row>
                            <Row label={t('Name')}>{student.given_names}</Row>
                            <Row label={t('Born')}>
                                {fullDate(student.date_of_birth)}
                                {student.place_of_birth
                                    ? t(' in :place_of_birth', {
                                          place_of_birth:
                                              student.place_of_birth,
                                      })
                                    : ''}{' '}
                                · {t(GENDER_LABELS[student.gender])}
                            </Row>
                            {canSeePrivate && (
                                <>
                                    <Row label={t('Religion')}>
                                        {student.religion ?? t('Not recorded')}
                                    </Row>
                                    <Row label={t('Disability')}>
                                        {student.disability ?? t('None')}
                                    </Row>
                                </>
                            )}
                            <Row label={t('Admitted')}>
                                {fullDate(student.admitted_on)}
                                {student.transferred_from
                                    ? t(
                                          ' · transferred from :transferred_from',
                                          {
                                              transferred_from:
                                                  student.transferred_from,
                                          },
                                      )
                                    : ''}
                            </Row>
                        </dl>
                    </section>

                    <section className="flex flex-col gap-2">
                        <p className={capsLabelClass}>
                            {t('Class and series')}
                        </p>
                        <dl className="flex flex-col">
                            <Row label={t('Class')}>
                                {student.class
                                    ? t(':class · :students students', {
                                          class: student.class.name,
                                          students: student.class.students,
                                      })
                                    : t('Not placed in a class this year')}
                            </Row>
                            {student.class?.uses_series && (
                                <>
                                    <Row label={t('Series')}>
                                        {student.series ? (
                                            <span className="flex items-center gap-2">
                                                <StreamChip
                                                    stream={
                                                        student.series.stream
                                                    }
                                                >
                                                    {student.series.code}
                                                </StreamChip>
                                                {student.series.name}
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-[6px] text-[#8A5A12]">
                                                <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-warning" />
                                                {t(
                                                    'No series yet. Until one is chosen, there is no subject list.',
                                                )}
                                            </span>
                                        )}
                                    </Row>
                                    {student.series && (
                                        <Row label={t('Subjects')}>
                                            {t(
                                                ':electives in the series · :core core, :electives_a in the elective pool',
                                                {
                                                    electives:
                                                        student.series.core +
                                                        student.series
                                                            .electives,
                                                    core: student.series.core,
                                                    electives_a:
                                                        student.series
                                                            .electives,
                                                },
                                            )}
                                        </Row>
                                    )}
                                </>
                            )}
                        </dl>
                    </section>

                    <section className="flex flex-col gap-2">
                        <p className={capsLabelClass}>
                            {t('Parents and guardian')}
                        </p>
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
                                                RELATION_LABELS[
                                                    guardian.relation
                                                ],
                                                guardian.occupation?.toLowerCase(),
                                                guardian.is_main
                                                    ? 'main contact'
                                                    : null,
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
                                        {guardian.is_main &&
                                            student.on_whatsapp && (
                                                <span className="flex h-[22px] items-center rounded-full bg-success-tint px-2 text-[12px] leading-4 font-medium text-success">
                                                    {t('WhatsApp')}
                                                </span>
                                            )}
                                    </dd>
                                </div>
                            ))}
                            <Row label={t('Lives with')}>
                                {student.lives_with ?? t('Not recorded')}
                            </Row>
                        </dl>
                    </section>
                </div>

                <aside className="flex shrink-0 flex-col gap-5 border-solid border-border lg:w-[328px] lg:border-l lg:pl-8">
                    {student.fees ? (
                        <div className="flex flex-col gap-[14px] rounded-lg border border-solid border-border bg-surface p-4">
                            <div className="flex items-center justify-between">
                                <p className={capsLabelClass}>
                                    {t('Fees')}
                                    {yearLabel ? ` · ${yearLabel}` : ''}
                                </p>
                                <FeePill status={student.fees.status} />
                            </div>
                            <div className="flex flex-col gap-[2px]">
                                <p className="font-mono text-[28px] leading-[34px] text-text">
                                    {money(student.fees.balance, currency)}
                                </p>
                                <p className="text-[13px] leading-4 text-text-muted">
                                    {t('still to pay, of :currency', {
                                        currency: money(
                                            student.fees.due,
                                            currency,
                                        ),
                                    })}
                                </p>
                            </div>
                            <div
                                role="progressbar"
                                aria-label={t('Share of fees paid')}
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
                                {t('Payments are recorded in Fees.')}{' '}
                                <Link
                                    href={feesTab.url(student.id)}
                                    className="font-medium text-primary hover:underline"
                                >
                                    {t('Open the Fees tab →')}
                                </Link>
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2 rounded-lg border border-solid border-border bg-surface p-4">
                            <p className={capsLabelClass}>{t('Fees')}</p>
                            <p className="text-[13px] leading-[19px] text-text-muted">
                                {t(
                                    'No fee plan was set for this student’s level at admission, so nothing is owed yet.',
                                )}
                            </p>
                        </div>
                    )}
                    <div className="flex flex-col gap-[10px] rounded-lg border border-dashed border-border bg-white p-4">
                        <p className="text-[13px] leading-4 font-semibold text-text">
                            {t('Changes to enrolment')}
                        </p>
                        <Link
                            href={edit.url(student.id)}
                            className="text-[13px] leading-4 font-medium text-primary hover:underline"
                        >
                            {t('Move to another class')}
                        </Link>
                        {student.class?.uses_series && (
                            <Link
                                href={
                                    student.series
                                        ? changeSeries.url(student.id)
                                        : chooseSeries.url({
                                              query: { student: student.id },
                                          })
                                }
                                className="text-[13px] leading-4 font-medium text-primary hover:underline"
                            >
                                {student.series
                                    ? t('Change series')
                                    : t('Choose a series')}
                            </Link>
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
}

export default withAppShell(StudentRecord);
