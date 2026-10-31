import { Head, Link, router } from '@inertiajs/react';
import {
    decide,
    promoteClass,
    reEnrolment,
} from '@/actions/App/Http/Controllers/ReEnrolmentController';
import { placement } from '@/actions/App/Http/Controllers/StudentPlacementController';
import {
    EnrolmentHeader,
    type EnrolmentProgress,
    amberText,
    count,
    nextStepClass,
} from '../../components/enrolment/ui';
import {
    capsLabelClass,
    solidButtonClass,
} from '../../components/structure/ui';
import { money } from '../../components/students/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

type Decision = 'promote' | 'repeat' | 'leaving';

interface ReEnrolmentProps {
    enrolment: EnrolmentProgress;
    levels: { id: string; name: string }[];
    graduating: string[];
    level: { id: string; name: string; next: string | null } | null;
    classes: { id: string; name: string; total: number; decided: number }[];
    class: { id: string; name: string } | null;
    students: {
        id: string;
        name: string | null;
        matricule: string | null;
        decision: Decision | null;
        owed: number;
    }[];
}

const CHOICES: { key: Decision; label: string; on: string }[] = [
    {
        key: 'promote',
        label: 'Promote',
        on: 'border-primary bg-primary-tint font-semibold text-primary',
    },
    {
        key: 'repeat',
        label: 'Repeat',
        on: `border-warning bg-warning-tint font-semibold ${amberText}`,
    },
    {
        key: 'leaving',
        label: 'Leaving',
        on: 'border-text bg-surface font-semibold text-text',
    },
];

function ReEnrolment({
    enrolment,
    levels,
    graduating,
    level,
    classes,
    class: selected,
    students,
}: ReEnrolmentProps) {
    const undecided = students.filter(
        (student) => student.decision === null,
    ).length;
    const tally = (decision: Decision) =>
        students.filter((student) => student.decision === decision).length;
    const others = levels.filter((option) => option.id !== level?.id);

    function choose(id: string, current: Decision | null, decision: Decision) {
        router.post(
            decide.url(),
            {
                enrolment_id: id,
                decision: current === decision ? null : decision,
            },
            { preserveScroll: true, preserveState: true },
        );
    }

    function next(decision: Decision | null): string {
        if (decision === 'promote') {
            return level?.next ?? '—';
        }

        return decision === 'repeat' ? (level?.name ?? '—') : '—';
    }

    return (
        <div className="flex flex-col gap-5">
            <Head title={t('Promotion')} />
            <EnrolmentHeader
                progress={enrolment}
                trail={[{ label: t('Promotion') }]}
                title={t('Promotion')}
                meta={t('decide for every student: promote, repeat or leaving')}
            />

            {!level || !selected ? (
                <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                    {t(
                        'No class has continuing students this year, so there is nobody to decide for.',
                    )}
                    {graduating.length > 0 &&
                        t(' :graduating students are graduating.', {
                            graduating: graduating.join(', '),
                        })}
                </p>
            ) : (
                <>
                    <div className="flex flex-wrap items-center gap-4 rounded-md bg-surface px-4 py-3">
                        <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                            <p className="text-[14px] leading-[18px] font-semibold text-text">
                                {t('Decide each student by hand for now')}
                            </p>
                            <p className="text-[13px] leading-4 text-text-muted">
                                {t(
                                    'Annual averages will suggest promote or repeat once marks are entered. Any decision can be changed until enrolment is confirmed.',
                                )}
                            </p>
                        </div>
                        <button
                            type="button"
                            disabled={undecided === 0}
                            onClick={() =>
                                router.post(
                                    promoteClass.url(),
                                    { class_id: selected.id },
                                    { preserveScroll: true },
                                )
                            }
                            className={solidButtonClass}
                        >
                            {undecided > 0
                                ? t(
                                      'Promote the :undecided undecided in :selected',
                                      {
                                          undecided: count(undecided),
                                          selected: selected.name,
                                      },
                                  )
                                : t('Everyone in :selected is decided', {
                                      selected: selected.name,
                                  })}
                        </button>
                    </div>

                    <div className="flex flex-col gap-6 lg:flex-row">
                        <div className="flex shrink-0 flex-col gap-2 lg:w-[230px]">
                            <p className={`px-[2px] pb-1 ${capsLabelClass}`}>
                                {level.name}
                            </p>
                            {classes.map((option) => {
                                const active = option.id === selected.id;
                                const share =
                                    option.total > 0
                                        ? Math.round(
                                              (option.decided / option.total) *
                                                  100,
                                          )
                                        : 0;

                                return (
                                    <Link
                                        key={option.id}
                                        href={reEnrolment.url({
                                            query: { class: option.id },
                                        })}
                                        aria-current={
                                            active ? 'page' : undefined
                                        }
                                        preserveScroll
                                        className={`flex flex-col gap-[7px] rounded-md border border-solid px-3 py-[10px] ${
                                            active
                                                ? 'border-primary bg-primary-tint'
                                                : 'border-border hover:bg-surface'
                                        }`}
                                    >
                                        <span className="flex items-center justify-between">
                                            <span
                                                className={`text-[14px] leading-[18px] ${active ? 'font-semibold text-primary' : 'font-medium text-text'}`}
                                            >
                                                {option.name}
                                            </span>
                                            <span
                                                className={`font-mono text-[12px] leading-4 ${active ? 'text-primary' : 'text-text-muted'}`}
                                            >
                                                {option.decided} /{' '}
                                                {option.total}
                                            </span>
                                        </span>
                                        <span
                                            className={`flex h-1 shrink-0 rounded-full ${active ? 'bg-white' : 'bg-border'}`}
                                        >
                                            <span
                                                className="h-1 rounded-full bg-primary"
                                                style={{ width: `${share}%` }}
                                            />
                                        </span>
                                    </Link>
                                );
                            })}
                            {others.length > 0 && (
                                <p className="px-[2px] pt-2 text-[13px] leading-[18px] text-text-muted">
                                    {t('Other levels:')}{' '}
                                    {others.map((option, position) => (
                                        <span key={option.id}>
                                            {position > 0 && ', '}
                                            <Link
                                                href={reEnrolment.url({
                                                    query: { level: option.id },
                                                })}
                                                className="font-medium text-primary hover:underline"
                                            >
                                                {option.name}
                                            </Link>
                                        </span>
                                    ))}
                                </p>
                            )}
                            {graduating.length > 0 && (
                                <p className="px-[2px] pt-1 text-[12px] leading-[17px] text-text-muted">
                                    {graduating.join(', ')}{' '}
                                    {t(
                                        'students are graduating. They are not re-enrolled.',
                                    )}
                                </p>
                            )}
                        </div>

                        <div className="flex min-w-0 flex-1 flex-col gap-[14px]">
                            <div className="overflow-x-auto rounded-lg border border-solid border-border">
                                <div className="flex min-w-[640px] flex-col">
                                    <div
                                        className={`flex h-[34px] items-center gap-3 border-b border-solid border-border bg-surface px-[14px] ${capsLabelClass}`}
                                    >
                                        <span className="flex-1">
                                            {t('Student')}
                                        </span>
                                        <span className="w-16 shrink-0 text-right">
                                            {t('Average')}
                                        </span>
                                        <span className="w-56 shrink-0">
                                            {t('Decision')}
                                        </span>
                                        <span className="w-[70px] shrink-0">
                                            {t('Next')}
                                        </span>
                                        <span className="w-[76px] shrink-0 text-right">
                                            {t('Fees owed')}
                                        </span>
                                    </div>
                                    {students.length === 0 && (
                                        <p className="px-[14px] py-4 text-[13px] leading-[19px] text-text-muted">
                                            {t(
                                                ':selected has no students this year.',
                                                { selected: selected.name },
                                            )}
                                        </p>
                                    )}
                                    {students.map((student) => (
                                        <div
                                            key={student.id}
                                            className="flex h-12 shrink-0 items-center gap-3 border-b border-solid border-border px-[14px] last:border-b-0"
                                        >
                                            <span className="flex min-w-0 flex-1 flex-col">
                                                <span className="truncate text-[14px] leading-[18px] font-medium text-text">
                                                    {student.name}
                                                </span>
                                                <span className="font-mono text-[11px] leading-[14px] text-text-muted">
                                                    {student.matricule}
                                                </span>
                                            </span>
                                            <span className="w-16 shrink-0 text-right font-mono text-[13px] leading-4 text-text-muted">
                                                —
                                            </span>
                                            <span
                                                role="radiogroup"
                                                aria-label={t(
                                                    'Decision for :student',
                                                    { student: student.name },
                                                )}
                                                className="flex w-56 shrink-0 gap-1"
                                            >
                                                {CHOICES.map((choice) => {
                                                    const on =
                                                        student.decision ===
                                                        choice.key;

                                                    return (
                                                        <button
                                                            key={choice.key}
                                                            type="button"
                                                            role="radio"
                                                            aria-checked={on}
                                                            onClick={() =>
                                                                choose(
                                                                    student.id,
                                                                    student.decision,
                                                                    choice.key,
                                                                )
                                                            }
                                                            className={`flex h-7 flex-1 items-center justify-center rounded-sm border border-solid text-[12px] leading-4 ${
                                                                on
                                                                    ? choice.on
                                                                    : 'border-border text-text hover:bg-surface'
                                                            }`}
                                                        >
                                                            {t(choice.label)}
                                                        </button>
                                                    );
                                                })}
                                            </span>
                                            <span
                                                className={`w-[70px] shrink-0 truncate text-[13px] leading-4 ${next(student.decision) === '—' ? 'text-text-muted' : 'text-text'}`}
                                            >
                                                {next(student.decision)}
                                            </span>
                                            {student.owed > 0 ? (
                                                <span
                                                    className={`w-[76px] shrink-0 text-right font-mono text-[13px] leading-4 ${amberText}`}
                                                >
                                                    {money(student.owed)}
                                                </span>
                                            ) : (
                                                <span className="w-[76px] shrink-0 text-right text-[13px] leading-4 text-text-muted">
                                                    {t('Clear')}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="text-[13px] leading-4 text-text">
                                    {selected.name} · {tally('promote')}{' '}
                                    {t('promote ·')} {tally('repeat')}{' '}
                                    {t('repeat ·')} {tally('leaving')}{' '}
                                    {t('leaving ·')} {undecided}{' '}
                                    {t('not decided')}
                                </p>
                                <Link
                                    href={placement.url()}
                                    className={nextStepClass}
                                >
                                    {t('Next: class placement →')}
                                </Link>
                            </div>
                            <p className="text-[13px] leading-[19px] text-text-muted">
                                {t(
                                    'Click a chosen decision again to clear it. Fees owed are shown for the conversation with the parents; they do not block a decision.',
                                )}
                            </p>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default withAppShell(ReEnrolment);
