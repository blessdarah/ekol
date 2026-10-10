import { Head, Link, router } from '@inertiajs/react';
import { index as applicationsIndex } from '@/actions/App/Http/Controllers/ApplicationController';
import {
    copyClasses,
    placement as placementPage,
    reEnrolment,
    storeClass,
} from '@/actions/App/Http/Controllers/EnrolmentController';
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
import { capsLabelClass, solidButtonClass } from '../../components/structure/ui';
import { fullDate } from '../../components/students/ui';
import { withAppShell } from '../../layouts/app-layout';

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
    applications?: { total: number; admitted: number; to_review: number; waitlist: number; declined: number };
    continuing?: { total: number; promote: number; repeat: number; leaving: number; undecided: number; graduating: number };
    levels?: LevelRow[];
    copyable?: number;
}

const cardClass = 'flex min-w-0 flex-1 flex-col gap-4 rounded-lg border border-solid border-border bg-surface p-5';

function Stat({ value, label, tone = 'text-text' }: { value: number; label: string; tone?: string }) {
    return (
        <div className="flex flex-col gap-[2px]">
            <span className={`font-mono text-[16px] leading-5 ${tone}`}>{count(value)}</span>
            <span className="text-[12px] leading-4 text-text-muted">{label}</span>
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
                    <span key={part.tone} className={part.tone} style={{ flexGrow: part.value, flexBasis: 0 }} />
                ))
            )}
        </div>
    );
}

function BigNumber({ value, label }: { value: number; label: string }) {
    return (
        <div className="flex items-baseline gap-2">
            <span className="font-display text-[40px] leading-[44px] font-extrabold tracking-[-0.02em] text-text">
                {count(value)}
            </span>
            <span className="text-[14px] leading-[18px] text-text-muted">{label}</span>
        </div>
    );
}

function LevelStatus({ level }: { level: LevelRow }) {
    const room = level.seats - level.expected;

    if (level.classes === 0) {
        return level.expected > 0 ? (
            <span className={`flex h-[22px] items-center rounded-full bg-warning-tint px-2 text-[12px] leading-4 font-medium ${amberText}`}>
                No classes yet
            </span>
        ) : (
            <span className="text-[13px] leading-4 text-text-muted">—</span>
        );
    }

    return room < 0 ? (
        <span className="flex h-[22px] items-center rounded-full bg-danger-tint px-2 text-[12px] leading-4 font-medium text-danger">
            {count(-room)} over
        </span>
    ) : (
        <span className="flex h-[22px] items-center rounded-full bg-success-tint px-2 text-[12px] leading-4 font-medium text-success">
            {room === 0 ? 'Full' : `Room for ${count(room)}`}
        </span>
    );
}

function Overview({ enrolment, currentLabel, startsOn, applications, continuing, levels = [], copyable = 0 }: OverviewProps) {
    if (!enrolment || !applications || !continuing) {
        return (
            <div className="flex flex-col gap-5">
                <Head title="Enrolment" />
                <div className="flex flex-col gap-[6px]">
                    <Breadcrumbs trail={[{ label: 'Enrolment' }]} />
                    <h1 className="font-display text-[40px] leading-[44px] font-extrabold tracking-[-0.02em] text-text">
                        Enrolment
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
            <Head title={`Enrolment ${enrolment.year}`} />
            <EnrolmentHeader
                active="overview"
                progress={enrolment}
                title={`Enrolment ${enrolment.year}`}
                status={
                    enrolment.confirmed ? (
                        <span className="flex h-[22px] items-center gap-[6px] rounded-full bg-surface px-2 text-[12px] leading-4 font-medium text-text">
                            Confirmed
                        </span>
                    ) : (
                        <span className="flex h-[22px] items-center gap-[6px] rounded-full bg-success-tint px-2 text-[12px] leading-4 font-medium text-success">
                            <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-success" />
                            Open
                        </span>
                    )
                }
                meta={startsOn ? `for the year starting ${fullDate(startsOn)}` : undefined}
            />

            <div className="flex flex-col gap-5 lg:flex-row">
                <div className={cardClass}>
                    <div className="flex items-baseline justify-between gap-3">
                        <p className={capsLabelClass}>New students</p>
                        <Link href={applicationsIndex.url(applications.to_review > 0 ? { query: { stage: 'to_review' } } : undefined)} className={linkClass}>
                            {applications.to_review > 0
                                ? `Review ${count(applications.to_review)} ${applications.to_review === 1 ? 'application' : 'applications'} →`
                                : 'Open applications →'}
                        </Link>
                    </div>
                    <BigNumber value={applications.total} label={applications.total === 1 ? 'application' : 'applications'} />
                    <SplitBar
                        parts={[
                            { value: applications.admitted, tone: 'bg-success' },
                            { value: applications.to_review, tone: 'bg-warning' },
                            { value: applications.waitlist, tone: 'bg-text-muted' },
                            { value: applications.declined, tone: 'bg-border' },
                        ]}
                    />
                    <div className="flex flex-wrap gap-5">
                        <Stat value={applications.admitted} label="Admitted" />
                        <Stat value={applications.to_review} label="To review" tone={applications.to_review > 0 ? amberText : undefined} />
                        <Stat value={applications.waitlist} label="Waitlist" />
                        <Stat value={applications.declined} label="Declined" />
                    </div>
                </div>

                <div className={cardClass}>
                    <div className="flex items-baseline justify-between gap-3">
                        <p className={capsLabelClass}>Continuing students</p>
                        <Link href={reEnrolment.url()} className={linkClass}>
                            {continuing.undecided > 0 ? `Decide ${count(continuing.undecided)} →` : 'Open re-enrolment →'}
                        </Link>
                    </div>
                    <BigNumber value={continuing.total} label={`from ${currentLabel ?? 'this year'}`} />
                    <SplitBar
                        parts={[
                            { value: continuing.total - continuing.undecided, tone: 'bg-success' },
                            { value: continuing.undecided, tone: 'bg-warning' },
                        ]}
                    />
                    <div className="flex flex-wrap gap-5">
                        <Stat value={continuing.promote} label="Promote" />
                        <Stat value={continuing.repeat} label="Repeat" />
                        <Stat value={continuing.leaving} label="Leaving" />
                        <Stat value={continuing.undecided} label="Not decided" tone={continuing.undecided > 0 ? amberText : undefined} />
                    </div>
                </div>

                <div className={cardClass}>
                    <div className="flex items-baseline justify-between gap-3">
                        <p className={capsLabelClass}>Class placement</p>
                        <Link href={placementPage.url()} className={linkClass}>
                            {enrolment.unplaced > 0 ? `Place ${count(enrolment.unplaced)} →` : 'Open placement →'}
                        </Link>
                    </div>
                    <BigNumber value={placed} label={`of ${count(enrolment.expected)} placed`} />
                    <FillBar value={placed} max={enrolment.expected} height={8} tone="bg-science" />
                    <p className="text-[13px] leading-[19px] text-text-muted">
                        Students can be placed as soon as they are decided.
                        Confirm opens when everyone has a class.
                        {continuing.graduating > 0 &&
                            ` ${count(continuing.graduating)} final-year ${continuing.graduating === 1 ? 'student is' : 'students are'} graduating and not re-enrolled.`}
                    </p>
                </div>
            </div>

            <section className="flex flex-col gap-[14px]">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <div className="flex flex-col gap-1">
                        <p className={capsLabelClass}>Room next year</p>
                        <p className="text-[13px] leading-4 text-text-muted">
                            Students expected in each level, against the seats in its classes.
                        </p>
                    </div>
                    {short.length > 0 && (
                        <p className="flex items-center gap-[6px] text-[13px] leading-4 text-text">
                            <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-warning" />
                            {short.length} {short.length === 1 ? 'level needs' : 'levels need'} another class
                        </p>
                    )}
                </div>

                {enrolment.classes === 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-solid border-warning bg-warning-tint px-4 py-3">
                        <p className="text-[13px] leading-[19px] text-text">
                            {enrolment.year} has no classes yet, so nobody can be placed.
                            {copyable > 0
                                ? ` Start with the same ${count(copyable)} classes as ${currentLabel}, then add or change them.`
                                : ' Add a class to a level below.'}
                        </p>
                        {copyable > 0 && (
                            <button
                                type="button"
                                onClick={() => router.post(copyClasses.url(), {}, { preserveScroll: true })}
                                className={solidButtonClass}
                            >
                                Copy this year’s classes
                            </button>
                        )}
                    </div>
                )}

                <div className="overflow-x-auto rounded-lg border border-solid border-border">
                    <div className="flex min-w-[860px] flex-col">
                        <div className={`flex h-[34px] items-center gap-4 border-b border-solid border-border bg-surface px-4 ${capsLabelClass}`}>
                            <span className="w-[130px] shrink-0">Level</span>
                            <span className="w-[70px] shrink-0">Classes</span>
                            <span className="w-20 shrink-0 text-right">Seats</span>
                            <span className="w-[90px] shrink-0 text-right">Expected</span>
                            <span className="flex-1">Filled</span>
                            <span className="w-[120px] shrink-0 text-right">Placed</span>
                            <span className="w-[130px] shrink-0">Status</span>
                            <span className="w-[92px] shrink-0" />
                        </div>
                        {levels.map((level, position) => (
                            <div
                                key={level.id}
                                className={`flex h-11 items-center gap-4 border-b border-solid border-border px-4 last:border-b-0 ${position % 2 === 1 ? 'bg-row-alt' : ''}`}
                            >
                                <Link
                                    href={placementPage.url({ query: { level: level.id } })}
                                    className="w-[130px] shrink-0 truncate text-[14px] leading-[18px] font-medium text-text hover:underline"
                                >
                                    {level.name}
                                </Link>
                                <span className="w-[70px] shrink-0 font-mono text-[13px] leading-4 text-text">{level.classes}</span>
                                <span className="w-20 shrink-0 text-right font-mono text-[13px] leading-4 text-text">{count(level.seats)}</span>
                                <span className="w-[90px] shrink-0 text-right font-mono text-[13px] leading-4 text-text">{count(level.expected)}</span>
                                <span className="flex flex-1 flex-col">
                                    <FillBar value={level.expected} max={level.seats} tone="bg-success" />
                                </span>
                                <span className="w-[120px] shrink-0 text-right font-mono text-[13px] leading-4 text-text">
                                    {count(level.placed)} of {count(level.expected)}
                                </span>
                                <span className="flex w-[130px] shrink-0">
                                    <LevelStatus level={level} />
                                </span>
                                <span className="flex w-[92px] shrink-0 justify-end">
                                    <button
                                        type="button"
                                        onClick={() => router.post(storeClass.url(level.id), {}, { preserveScroll: true })}
                                        className={linkClass}
                                    >
                                        Add a class
                                    </button>
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
                <p className="text-[13px] leading-[19px] text-text-muted">
                    Expected counts promoted students, repeaters and admitted
                    applicants. Students who are not decided yet are not counted.
                </p>
            </section>
        </div>
    );
}

export default withAppShell(Overview);
