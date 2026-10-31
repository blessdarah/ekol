import { tableRowClass } from '../../components/table/ui';
import { Head, Link, router } from '@inertiajs/react';
import { index as applicationsIndex } from '@/actions/App/Http/Controllers/ApplicationRosterController';
import { confirm as confirmPage } from '@/actions/App/Http/Controllers/EnrolmentConfirmationController';
import {
    copyClasses,
    storeClass,
} from '@/actions/App/Http/Controllers/EnrolmentController';
import { placement as placementPage } from '@/actions/App/Http/Controllers/StudentPlacementController';
import { reEnrolment } from '@/actions/App/Http/Controllers/ReEnrolmentController';
import { show as setup } from '@/actions/App/Http/Controllers/SetupController';
import {
    EnrolmentHeader,
    type EnrolmentProgress,
    FillBar,
    NoYear,
    amberText,
    count,
    linkClass,
} from '../../components/enrolment/ui';
import Breadcrumbs from '../../components/shell/breadcrumbs';
import {
    capsLabelClass,
    solidButtonClass,
} from '../../components/structure/ui';
import { fullDate } from '../../components/students/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface LevelRow {
    id: string;
    name: string;
    classes: number;
    seats: number;
    expected: number;
    placed: number;
}

interface OverviewProps {
    enrolment: EnrolmentProgress | null;
    currentLabel: string | null;
    startsOn?: string;
    applications?: {
        total: number;
        admitted: number;
        to_review: number;
        waitlist: number;
        declined: number;
    };
    continuing?: {
        total: number;
        promote: number;
        repeat: number;
        leaving: number;
        undecided: number;
        graduating: number;
    };
    levels?: LevelRow[];
    copyable?: number;
}

const cardClass =
    'flex min-w-0 flex-1 flex-col gap-4 rounded-lg border border-solid border-border bg-surface p-5';

function Stat({
    value,
    label,
    tone = 'text-text',
}: {
    value: number;
    label: string;
    tone?: string;
}) {
    return (
        <div className="flex flex-col gap-[2px]">
            <span className={`font-mono text-[16px] leading-5 ${tone}`}>
                {count(value)}
            </span>
            <span className="text-[12px] leading-4 text-text-muted">
                {label}
            </span>
        </div>
    );
}

/** A bar split in proportion to its parts; empty parts take no room. */
function SplitBar({ parts }: { parts: { value: number; tone: string }[] }) {
    const shown = parts.filter((part) => part.value > 0);

    return (
        <div className="flex h-2 shrink-0 gap-[2px] overflow-clip rounded-full">
            {shown.length === 0 ? (
                <span className="flex-1 bg-border" />
            ) : (
                shown.map((part) => (
                    <span
                        key={part.tone}
                        className={part.tone}
                        style={{ flexGrow: part.value, flexBasis: 0 }}
                    />
                ))
            )}
        </div>
    );
}

function BigNumber({ value, label }: { value: number; label: string }) {
    return (
        <div className="flex items-baseline gap-2">
            <span className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text sm:text-[40px] sm:leading-[44px]">
                {count(value)}
            </span>
            <span className="text-[14px] leading-[18px] text-text-muted">
                {label}
            </span>
        </div>
    );
}

function LevelStatus({ level }: { level: LevelRow }) {
    const room = level.seats - level.expected;

    if (level.classes === 0) {
        return level.expected > 0 ? (
            <span
                className={`flex h-[22px] items-center rounded-full bg-warning-tint px-2 text-[12px] leading-4 font-medium ${amberText}`}
            >
                {t('No classes yet')}
            </span>
        ) : (
            <span className="text-[13px] leading-4 text-text-muted">—</span>
        );
    }

    return room < 0 ? (
        <span className="flex h-[22px] items-center rounded-full bg-danger-tint px-2 text-[12px] leading-4 font-medium text-danger">
            {t(':room over', { room: count(-room) })}
        </span>
    ) : (
        <span className="flex h-[22px] items-center rounded-full bg-success-tint px-2 text-[12px] leading-4 font-medium text-success">
            {room === 0
                ? t('Full')
                : t('Room for :room', { room: count(room) })}
        </span>
    );
}

function Overview({
    enrolment,
    currentLabel,
    startsOn,
    applications,
    continuing,
    levels = [],
    copyable = 0,
}: OverviewProps) {
    if (!enrolment || !applications || !continuing) {
        return (
            <div className="flex flex-col gap-5">
                <Head title={t('New school year')} />
                <div className="flex flex-col gap-[6px]">
                    <Breadcrumbs trail={[{ label: t('New school year') }]} />
                    <h1 className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text sm:text-[40px] sm:leading-[44px]">
                        {t('New school year')}
                    </h1>
                </div>
                <NoYear currentLabel={currentLabel} setupHref={setup.url()} />
            </div>
        );
    }

    const short = levels.filter((level) => level.expected > level.seats);
    const placed = enrolment.expected - enrolment.unplaced;

    return (
        <div className="flex flex-col gap-5">
            <Head title={t('Prepare :year', { year: enrolment.year })} />
            <EnrolmentHeader
                progress={enrolment}
                title={t('Prepare :year', { year: enrolment.year })}
                status={
                    enrolment.confirmed ? (
                        <span className="flex h-[22px] items-center gap-[6px] rounded-full bg-surface px-2 text-[12px] leading-4 font-medium text-text">
                            {t('Confirmed')}
                        </span>
                    ) : (
                        <span className="flex h-[22px] items-center gap-[6px] rounded-full bg-success-tint px-2 text-[12px] leading-4 font-medium text-success">
                            <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-success" />
                            {t('Open')}
                        </span>
                    )
                }
                meta={
                    startsOn
                        ? t('for the year starting :starts_on', {
                              starts_on: fullDate(startsOn),
                          })
                        : undefined
                }
            />

            <div className="flex flex-col gap-5 lg:flex-row">
                <div className={cardClass}>
                    <div className="flex items-baseline justify-between gap-3">
                        <p className={capsLabelClass}>{t('New students')}</p>
                        <Link
                            href={applicationsIndex.url(
                                applications.to_review > 0
                                    ? { query: { stage: 'to_review' } }
                                    : undefined,
                            )}
                            className={linkClass}
                        >
                            {applications.to_review > 0
                                ? t('Review :to_review :applications →', {
                                      to_review: count(applications.to_review),
                                      applications:
                                          applications.to_review === 1
                                              ? 'application'
                                              : 'applications',
                                  })
                                : t('Open applications →')}
                        </Link>
                    </div>
                    <BigNumber
                        value={applications.total}
                        label={
                            applications.total === 1
                                ? t('application')
                                : t('applications')
                        }
                    />
                    <SplitBar
                        parts={[
                            {
                                value: applications.admitted,
                                tone: 'bg-success',
                            },
                            {
                                value: applications.to_review,
                                tone: 'bg-warning',
                            },
                            {
                                value: applications.waitlist,
                                tone: 'bg-text-muted',
                            },
                            { value: applications.declined, tone: 'bg-border' },
                        ]}
                    />
                    <div className="flex flex-wrap gap-5">
                        <Stat
                            value={applications.admitted}
                            label={t('Admitted')}
                        />
                        <Stat
                            value={applications.to_review}
                            label={t('To review')}
                            tone={
                                applications.to_review > 0
                                    ? amberText
                                    : undefined
                            }
                        />
                        <Stat
                            value={applications.waitlist}
                            label={t('Waitlist')}
                        />
                        <Stat
                            value={applications.declined}
                            label={t('Declined')}
                        />
                    </div>
                </div>

                <div className={cardClass}>
                    <div className="flex items-baseline justify-between gap-3">
                        <p className={capsLabelClass}>
                            {t('Continuing students')}
                        </p>
                        <Link href={reEnrolment.url()} className={linkClass}>
                            {continuing.undecided > 0
                                ? t('Decide :undecided →', {
                                      undecided: count(continuing.undecided),
                                  })
                                : t('Open promotion →')}
                        </Link>
                    </div>
                    <BigNumber
                        value={continuing.total}
                        label={t('from :year', {
                            year: currentLabel ?? 'this year',
                        })}
                    />
                    <SplitBar
                        parts={[
                            {
                                value: continuing.total - continuing.undecided,
                                tone: 'bg-success',
                            },
                            { value: continuing.undecided, tone: 'bg-warning' },
                        ]}
                    />
                    <div className="flex flex-wrap gap-5">
                        <Stat value={continuing.promote} label={t('Promote')} />
                        <Stat value={continuing.repeat} label={t('Repeat')} />
                        <Stat value={continuing.leaving} label={t('Leaving')} />
                        <Stat
                            value={continuing.undecided}
                            label={t('Not decided')}
                            tone={
                                continuing.undecided > 0 ? amberText : undefined
                            }
                        />
                    </div>
                </div>

                <div className={cardClass}>
                    <div className="flex items-baseline justify-between gap-3">
                        <p className={capsLabelClass}>{t('Class placement')}</p>
                        <Link href={placementPage.url()} className={linkClass}>
                            {enrolment.unplaced > 0
                                ? t('Place :unplaced →', {
                                      unplaced: count(enrolment.unplaced),
                                  })
                                : t('Open placement →')}
                        </Link>
                    </div>
                    <BigNumber
                        value={placed}
                        label={t('of :expected placed', {
                            expected: count(enrolment.expected),
                        })}
                    />
                    <FillBar
                        value={placed}
                        max={enrolment.expected}
                        height={8}
                        tone="bg-science"
                    />
                    <p className="text-[13px] leading-[19px] text-text-muted">
                        {t(
                            'Students can be placed as soon as they are decided. Confirm opens when everyone has a class.',
                        )}
                        {continuing.graduating > 0 &&
                            t(
                                ' :graduating final-year :are graduating and not re-enrolled.',
                                {
                                    graduating: count(continuing.graduating),
                                    are:
                                        continuing.graduating === 1
                                            ? 'student is'
                                            : 'students are',
                                },
                            )}
                    </p>
                </div>
            </div>

            <section className="flex flex-col gap-[14px]">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <div className="flex flex-col gap-1">
                        <p className={capsLabelClass}>{t('Room next year')}</p>
                        <p className="text-[13px] leading-4 text-text-muted">
                            {t(
                                'Students expected in each level, against the seats in its classes.',
                            )}
                        </p>
                    </div>
                    {short.length > 0 && (
                        <p className="flex items-center gap-[6px] text-[13px] leading-4 text-text">
                            <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-warning" />
                            {short.length}{' '}
                            {short.length === 1
                                ? t('level needs')
                                : t('levels need')}{' '}
                            {t('another class')}
                        </p>
                    )}
                </div>

                {enrolment.classes === 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-solid border-warning bg-warning-tint px-4 py-3">
                        <p className="text-[13px] leading-[19px] text-text">
                            {enrolment.year}{' '}
                            {t('has no classes yet, so nobody can be placed.')}
                            {copyable > 0
                                ? t(
                                      ' Start with the same :copyable classes as :current_label, then add or change them.',
                                      {
                                          copyable: count(copyable),
                                          current_label: currentLabel,
                                      },
                                  )
                                : t(' Add a class to a level below.')}
                        </p>
                        {copyable > 0 && (
                            <button
                                type="button"
                                onClick={() =>
                                    router.post(
                                        copyClasses.url(),
                                        {},
                                        { preserveScroll: true },
                                    )
                                }
                                className={solidButtonClass}
                            >
                                {t('Copy this year’s classes')}
                            </button>
                        )}
                    </div>
                )}

                <div className="overflow-x-auto rounded-lg border border-solid border-border">
                    <div className="flex min-w-[860px] flex-col">
                        <div
                            className={`flex h-[34px] items-center gap-4 border-b border-solid border-border bg-surface px-4 ${capsLabelClass}`}
                        >
                            <span className="w-[130px] shrink-0">
                                {t('Level')}
                            </span>
                            <span className="w-[70px] shrink-0">
                                {t('Classes')}
                            </span>
                            <span className="w-20 shrink-0 text-right">
                                {t('Seats')}
                            </span>
                            <span className="w-[90px] shrink-0 text-right">
                                {t('Expected')}
                            </span>
                            <span className="flex-1">{t('Filled')}</span>
                            <span className="w-[120px] shrink-0 text-right">
                                {t('Placed')}
                            </span>
                            <span className="w-[130px] shrink-0">
                                {t('Status')}
                            </span>
                            <span className="w-[92px] shrink-0" />
                        </div>
                        {levels.map((level, position) => (
                            <div
                                key={level.id}
                                className={`flex h-11 items-center gap-4 border-b border-solid border-border px-4 last:border-b-0 ${tableRowClass({ index: position })}`}
                            >
                                <Link
                                    href={placementPage.url({
                                        query: { level: level.id },
                                    })}
                                    className="w-[130px] shrink-0 truncate text-[14px] leading-[18px] font-medium text-text hover:underline"
                                >
                                    {level.name}
                                </Link>
                                <span className="w-[70px] shrink-0 font-mono text-[13px] leading-4 text-text">
                                    {level.classes}
                                </span>
                                <span className="w-20 shrink-0 text-right font-mono text-[13px] leading-4 text-text">
                                    {count(level.seats)}
                                </span>
                                <span className="w-[90px] shrink-0 text-right font-mono text-[13px] leading-4 text-text">
                                    {count(level.expected)}
                                </span>
                                <span className="flex flex-1 flex-col">
                                    <FillBar
                                        value={level.expected}
                                        max={level.seats}
                                        tone="bg-success"
                                    />
                                </span>
                                <span className="w-[120px] shrink-0 text-right font-mono text-[13px] leading-4 text-text">
                                    {t(':placed of :expected', {
                                        placed: count(level.placed),
                                        expected: count(level.expected),
                                    })}
                                </span>
                                <span className="flex w-[130px] shrink-0">
                                    <LevelStatus level={level} />
                                </span>
                                <span className="flex w-[92px] shrink-0 justify-end">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            router.post(
                                                storeClass.url(level.id),
                                                {},
                                                { preserveScroll: true },
                                            )
                                        }
                                        className={linkClass}
                                    >
                                        {t('Add a class')}
                                    </button>
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
                <p className="text-[13px] leading-[19px] text-text-muted">
                    {t(
                        'Expected counts promoted students, repeaters and admitted applicants. Students who are not decided yet are not counted.',
                    )}
                </p>
            </section>

            <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-dashed border-border px-5 py-4">
                <div className="flex min-w-0 items-center gap-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-solid border-border font-mono text-[12px] leading-4 text-text-muted">
                        4
                    </span>
                    <div className="flex min-w-0 flex-col gap-1">
                        <p className="text-[15px] leading-5 font-semibold text-text">
                            {t('Confirm the new year')}
                        </p>
                        <p className="text-[13px] leading-[18px] text-text-muted">
                            {enrolment.confirmed
                                ? t(':year is confirmed.', {
                                      year: enrolment.year,
                                  })
                                : enrolment.ready
                                  ? t(
                                        'Every admitted and promoted student has a class. Confirm makes them Enrolled.',
                                    )
                                  : t(
                                        'Opens when every admitted and promoted student has a class · :unplaced still to place',
                                        { unplaced: count(enrolment.unplaced) },
                                    )}
                        </p>
                    </div>
                </div>
                <Link
                    href={confirmPage.url()}
                    className={
                        enrolment.ready && !enrolment.confirmed
                            ? solidButtonClass
                            : 'flex h-9 items-center rounded-md border border-solid border-border bg-surface px-4 text-[13px] leading-4 font-semibold text-text-muted hover:text-text'
                    }
                >
                    {enrolment.confirmed
                        ? t('Open confirmation')
                        : t('Confirm :year', { year: enrolment.year })}
                </Link>
            </section>
        </div>
    );
}

export default withAppShell(Overview);
