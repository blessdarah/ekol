import { Head, Link, router, useForm } from '@inertiajs/react';
import type { ReactNode } from 'react';
import {
    decide,
    documents as saveDocuments,
    index,
} from '@/actions/App/Http/Controllers/ApplicationController';
import { placement } from '@/actions/App/Http/Controllers/EnrolmentController';
import { show as studentRecord } from '@/actions/App/Http/Controllers/StudentController';
import {
    EnrolmentHeader,
    type EnrolmentProgress,
    RowSection,
    StagePill,
    amberText,
    count,
    linkClass,
} from '../../components/enrolment/ui';
import {
    ErrorText,
    capsLabelClass,
    fieldLabelClass,
} from '../../components/structure/ui';
import {
    GENDER_LABELS,
    RELATION_LABELS,
    fullDate,
} from '../../components/students/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

type Decision = 'admit' | 'waitlist' | 'decline';

interface ReviewProps {
    enrolment: EnrolmentProgress;
    application: {
        id: string;
        name: string;
        reference: string;
        level: string | null;
        stage: string;
        date_of_birth: string;
        place_of_birth: string | null;
        gender: string;
        religion: string | null;
        disability: string | null;
        transferred: boolean;
        previous_school: string | null;
        previous_class: string | null;
        reason: string | null;
        guardians: {
            relation: string;
            name: string;
            phone: string | null;
            occupation: string | null;
            is_main: boolean;
        }[];
        documents: { key: string; label: string; received: boolean }[];
        condition: string | null;
        student_id: string | null;
        matricule: string | null;
    };
    canSeePrivate: boolean;
    sibling: { id: string; name: string; class: string | null } | null;
    nextMatricule: string;
    capacity: { expected: number; seats: number } | null;
    hasNext: boolean;
}

const DECISIONS: { key: Decision; label: string; verb: string }[] = [
    { key: 'admit', label: 'Admit', verb: 'Admit' },
    { key: 'waitlist', label: 'Waitlist', verb: 'Waitlist' },
    { key: 'decline', label: 'Decline', verb: 'Decline' },
];

function Detail({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex items-baseline gap-4 border-t border-solid border-border py-[10px]">
            <span className="w-[184px] shrink-0 text-[13px] leading-[18px] text-text-muted">
                {label}
            </span>
            <span className="min-w-0 text-[14px] leading-[19px] text-text">
                {children}
            </span>
        </div>
    );
}

function Effect({
    tone = 'success',
    children,
}: {
    tone?: 'success' | 'warning';
    children: ReactNode;
}) {
    return (
        <li className="flex items-start gap-2 text-[13px] leading-[18px] text-text-muted">
            <span
                className={`mt-[5px] h-[6px] w-[6px] shrink-0 rounded-full ${tone === 'success' ? 'bg-success' : 'bg-warning'}`}
            />
            <span>{children}</span>
        </li>
    );
}

function Review({
    enrolment,
    application,
    canSeePrivate,
    sibling,
    nextMatricule,
    capacity,
    hasNext,
}: ReviewProps) {
    const form = useForm<{ decision: Decision; condition: string }>({
        decision: 'admit',
        condition: application.condition ?? '',
    });
    const { data, setData, processing } = form;
    const errors = form.errors as Record<string, string | undefined>;
    const admitted = application.stage === 'admitted';
    const missing = application.documents.filter(
        (document) => !document.received,
    );
    const stage =
        application.stage === 'to_review' && missing.length > 0
            ? 'documents'
            : application.stage;
    const they = application.gender === 'female' ? t('She') : t('He');
    const them = application.gender === 'female' ? 'her' : 'him';
    const over = capacity !== null && capacity.expected >= capacity.seats;
    const verb =
        DECISIONS.find((option) => option.key === data.decision)?.verb ??
        'Admit';

    function toggleDocument(key: string) {
        const received = application.documents
            .filter((document) =>
                document.key === key ? !document.received : document.received,
            )
            .map((document) => document.key);

        router.patch(
            saveDocuments.url(application.id),
            { documents: received },
            { preserveScroll: true },
        );
    }

    return (
        <div className="flex flex-col gap-5">
            <Head title={application.name} />
            <EnrolmentHeader
                active="applications"
                progress={enrolment}
                trail={[
                    { label: t('Applications'), href: index.url() },
                    { label: application.name },
                ]}
                title={application.name}
                status={
                    <>
                        <span className="font-mono uppercase">
                            {t(':reference · applying to :level', {
                                reference: application.reference,
                                level: application.level,
                            })}
                        </span>
                        <StagePill stage={stage} small />
                    </>
                }
            />

            <div className="flex flex-col gap-8 lg:flex-row">
                <div className="flex min-w-0 flex-1 flex-col gap-[22px]">
                    <RowSection label={t('Applicant')}>
                        <Detail label={t('Born')}>
                            {fullDate(application.date_of_birth)}
                            {application.place_of_birth
                                ? t(' in :place_of_birth', {
                                      place_of_birth:
                                          application.place_of_birth,
                                  })
                                : ''}{' '}
                            ·{' '}
                            {GENDER_LABELS[application.gender] ??
                                application.gender}
                        </Detail>
                        {canSeePrivate && (
                            <>
                                <Detail label={t('Religion')}>
                                    {application.religion ?? t('Not given')}
                                </Detail>
                                <Detail label={t('Disability')}>
                                    {application.disability ?? t('None')}
                                </Detail>
                            </>
                        )}
                        <Detail
                            label={
                                application.transferred
                                    ? t('Transferring from')
                                    : t('Coming from')
                            }
                        >
                            {[
                                application.previous_school,
                                application.previous_class,
                            ]
                                .filter(Boolean)
                                .join(' · ') || t('Not given')}
                        </Detail>
                        <Detail label={t('Reason')}>
                            {application.reason ?? t('Not given')}
                        </Detail>
                    </RowSection>

                    <RowSection label={t('Parents')}>
                        {application.guardians.map((guardian) => (
                            <div
                                key={guardian.relation}
                                className="flex items-center gap-4 border-t border-solid border-border py-[10px]"
                            >
                                <span className="flex w-[184px] shrink-0 flex-col">
                                    <span className="text-[14px] leading-[19px] text-text">
                                        {guardian.name}
                                    </span>
                                    <span className="text-[12px] leading-4 text-text-muted">
                                        {[
                                            RELATION_LABELS[
                                                guardian.relation
                                            ] ?? guardian.relation,
                                            guardian.occupation?.toLowerCase(),
                                            guardian.is_main
                                                ? 'main contact'
                                                : null,
                                        ]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </span>
                                </span>
                                <span className="font-mono text-[13px] leading-[18px] text-text">
                                    {guardian.phone ?? '—'}
                                </span>
                            </div>
                        ))}
                        <Detail label={t('Sibling here')}>
                            {sibling ? (
                                <Link
                                    href={studentRecord.url(sibling.id)}
                                    className="hover:underline"
                                >
                                    {sibling.name}
                                    {sibling.class ? ` · ${sibling.class}` : ''}
                                </Link>
                            ) : (
                                <span className="text-text-muted">
                                    {t(
                                        'None found by the parents’ phone numbers',
                                    )}
                                </span>
                            )}
                        </Detail>
                    </RowSection>

                    <RowSection label={t('Documents')}>
                        {application.documents.map((document) => (
                            <div
                                key={document.key}
                                className="flex items-center gap-4 border-t border-solid border-border py-[10px]"
                            >
                                <span className="flex-1 text-[14px] leading-[19px] text-text">
                                    {t(document.label)}
                                </span>
                                <span className="flex items-center gap-[6px] text-[13px] leading-4">
                                    <span
                                        className={`h-[6px] w-[6px] shrink-0 rounded-full ${document.received ? 'bg-success' : 'bg-warning'}`}
                                    />
                                    <span
                                        className={
                                            document.received
                                                ? 'text-text'
                                                : amberText
                                        }
                                    >
                                        {document.received
                                            ? t('Received')
                                            : t('Missing')}
                                    </span>
                                </span>
                                {!admitted && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            toggleDocument(document.key)
                                        }
                                        className={`w-[112px] shrink-0 text-right ${linkClass}`}
                                    >
                                        {document.received
                                            ? t('Not received')
                                            : t('Mark received')}
                                    </button>
                                )}
                            </div>
                        ))}
                    </RowSection>
                </div>

                <aside className="flex shrink-0 flex-col gap-5 border-solid border-border lg:w-[328px] lg:border-l lg:pl-8">
                    {admitted ? (
                        <div className="flex flex-col gap-[10px] rounded-lg border border-solid border-border bg-surface p-4">
                            <p className={capsLabelClass}>{t('Decision')}</p>
                            <p className="text-[14px] leading-[19px] font-semibold text-text">
                                {t('Admitted as :matricule', {
                                    matricule: application.matricule,
                                })}
                            </p>
                            {application.condition && (
                                <p className="text-[13px] leading-[19px] text-text">
                                    {t('Condition: :condition', {
                                        condition: application.condition,
                                    })}
                                </p>
                            )}
                            <p className="text-[13px] leading-[19px] text-text-muted">
                                {t(
                                    ':they is a student now. :they is Enrolled once :to_lower_case has a class and enrolment is confirmed.',
                                    { they, to_lower_case: they.toLowerCase() },
                                )}
                            </p>
                            {application.student_id && (
                                <Link
                                    href={studentRecord.url(
                                        application.student_id,
                                    )}
                                    className={linkClass}
                                >
                                    {t('Open the student record →')}
                                </Link>
                            )}
                            <Link href={placement.url()} className={linkClass}>
                                {t('Go to class placement →')}
                            </Link>
                        </div>
                    ) : (
                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                form.post(decide.url(application.id), {
                                    preserveState: 'errors',
                                });
                            }}
                            className="flex flex-col gap-[14px] rounded-lg border border-solid border-border bg-surface p-4"
                        >
                            <p className={capsLabelClass}>{t('Decision')}</p>
                            <div
                                role="radiogroup"
                                aria-label={t('Decision')}
                                className="flex gap-2"
                            >
                                {DECISIONS.map((option) => {
                                    const selected =
                                        data.decision === option.key;

                                    return (
                                        <button
                                            key={option.key}
                                            type="button"
                                            role="radio"
                                            aria-checked={selected}
                                            onClick={() =>
                                                setData('decision', option.key)
                                            }
                                            className={`flex h-9 flex-1 items-center justify-center rounded-md border border-solid text-[13px] leading-4 ${
                                                selected
                                                    ? 'border-primary bg-primary-tint font-semibold text-primary'
                                                    : 'border-border bg-white font-medium text-text hover:bg-surface'
                                            }`}
                                        >
                                            {t(option.label)}
                                        </button>
                                    );
                                })}
                            </div>
                            {data.decision === 'admit' && (
                                <label
                                    className={`flex flex-col gap-[6px] ${fieldLabelClass}`}
                                >
                                    {t('Condition of admission')}
                                    <textarea
                                        rows={2}
                                        value={data.condition}
                                        onChange={(e) =>
                                            setData('condition', e.target.value)
                                        }
                                        placeholder={
                                            missing.length > 0
                                                ? t(
                                                      'Bring the :to_lower_case by…',
                                                      {
                                                          to_lower_case:
                                                              missing[0].label.toLowerCase(),
                                                      },
                                                  )
                                                : t('None')
                                        }
                                        className="min-h-10 w-full resize-y rounded-md border border-solid border-border bg-white px-3 py-2 text-[14px] leading-[19px] font-normal text-text outline-none focus:border-primary"
                                    />
                                </label>
                            )}
                            <ErrorText
                                message={
                                    errors.decision ??
                                    errors.condition ??
                                    errors.year
                                }
                            />
                            <button
                                type="submit"
                                disabled={processing}
                                className="flex h-10 shrink-0 items-center justify-center rounded-md bg-primary px-3 text-[14px] leading-[18px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
                            >
                                {hasNext
                                    ? t(':verb and open the next application', {
                                          verb,
                                      })
                                    : verb}
                            </button>
                        </form>
                    )}

                    {!admitted && (
                        <div className="flex flex-col gap-2 rounded-lg border border-solid border-border bg-white p-4">
                            <p className="text-[14px] leading-[18px] font-semibold text-text">
                                {t('What admitting does')}
                            </p>
                            <ul className="flex flex-col gap-2">
                                <Effect>
                                    {t(
                                        'Creates the student with matricule :next_matricule',
                                        { next_matricule: nextMatricule },
                                    )}
                                </Effect>
                                {sibling && (
                                    <Effect>
                                        {t(
                                            'Links :them to :sibling as siblings',
                                            { them, sibling: sibling.name },
                                        )}
                                    </Effect>
                                )}
                                <Effect tone="warning">
                                    {t(
                                        ':they is Admitted, not yet Enrolled. :they then waits in Class placement, :level.',
                                        { they, level: application.level },
                                    )}
                                </Effect>
                                <Effect tone="warning">
                                    {t(
                                        'No notice is sent to the parents. Tell them yourself.',
                                    )}
                                </Effect>
                            </ul>
                        </div>
                    )}

                    {!admitted && over && capacity && (
                        <div className="flex flex-col gap-2 rounded-lg border border-solid border-warning bg-warning-tint p-4">
                            <p
                                className={`text-[14px] leading-[18px] font-semibold ${amberText}`}
                            >
                                {application.level} {t('is')}{' '}
                                {capacity.expected > capacity.seats
                                    ? t('over capacity')
                                    : t('full')}
                            </p>
                            <p className="text-[13px] leading-[19px] text-text">
                                {t(
                                    ':expected expected for :seats seats. You can still admit :them. Add a class on the Overview, then place :them.',
                                    {
                                        expected: count(capacity.expected),
                                        seats: count(capacity.seats),
                                        them,
                                    },
                                )}
                            </p>
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
}

export default withAppShell(Review);
