import { Head, Link, router, usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import {
    placement,
    storeConfirmation,
} from '@/actions/App/Http/Controllers/EnrolmentController';
import { index as seriesRegistration } from '@/actions/App/Http/Controllers/SeriesRegistrationController';
import {
    EnrolmentHeader,
    type EnrolmentProgress,
    RowSection,
    count,
    linkClass,
} from '../../components/enrolment/ui';
import {
    ErrorText,
    capsLabelClass,
    outlineButtonClass,
} from '../../components/structure/ui';
import { fullDate } from '../../components/students/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface ConfirmProps {
    enrolment: EnrolmentProgress;
    confirmedOn: string | null;
    who: {
        promoted: number;
        repeating: number;
        new: number;
        graduating: number;
        leaving: number;
        series: number;
    };
}

function Check({
    done,
    label,
    detail,
}: {
    done: boolean;
    label: string;
    detail: string;
}) {
    return (
        <div className="flex items-center gap-[10px] border-t border-solid border-border py-[10px]">
            <span
                className={`h-[6px] w-[6px] shrink-0 rounded-full ${done ? 'bg-success' : 'bg-warning'}`}
            />
            <span className="flex-1 text-[14px] leading-[18px] text-text">
                {label}
            </span>
            <span className="text-[13px] leading-4 text-text-muted">
                {detail}
            </span>
        </div>
    );
}

function Tally({
    label,
    value,
    strong = false,
    muted = false,
}: {
    label: string;
    value: number;
    strong?: boolean;
    muted?: boolean;
}) {
    return (
        <div
            className={`flex items-center gap-[10px] border-t border-solid border-border py-[10px] ${strong ? 'bg-surface' : ''}`}
        >
            <span
                className={`flex-1 text-[14px] leading-[18px] ${muted ? 'text-text-muted' : 'text-text'} ${strong ? 'font-semibold' : ''}`}
            >
                {label}
            </span>
            <span
                className={`font-mono text-[14px] leading-[18px] ${muted ? 'text-text-muted' : 'text-text'}`}
            >
                {count(value)}
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
        <li className="flex items-start gap-2 text-[13px] leading-[18px] text-text">
            <span
                className={`mt-[5px] h-[6px] w-[6px] shrink-0 rounded-full ${tone === 'success' ? 'bg-success' : 'bg-warning'}`}
            />
            <span>{children}</span>
        </li>
    );
}

function Confirm({ enrolment, confirmedOn, who }: ConfirmProps) {
    const errors = usePage().props.errors as Record<string, string | undefined>;
    const placed = enrolment.expected - enrolment.unplaced;
    const notReturning = who.graduating + who.leaving;

    return (
        <div className="flex flex-col gap-5">
            <Head title={t('Confirm enrolment')} />
            <EnrolmentHeader
                active="confirm"
                progress={enrolment}
                trail={[{ label: t('Confirm') }]}
                title={t('Confirm enrolment')}
                meta={t('the last step: everyone placed becomes Enrolled')}
            />

            <div className="flex flex-col gap-8 lg:flex-row">
                <div className="flex min-w-0 flex-1 flex-col gap-[22px]">
                    <RowSection label={t('Checks')}>
                        <Check
                            done={enrolment.to_review === 0}
                            label={t('Every application has an answer')}
                            detail={`${count(enrolment.to_review)} left`}
                        />
                        <Check
                            done={enrolment.undecided === 0}
                            label={t('Every continuing student is decided')}
                            detail={`${count(enrolment.undecided)} left`}
                        />
                        <Check
                            done={
                                enrolment.unplaced === 0 &&
                                enrolment.expected > 0
                            }
                            label={t('Every student has a class')}
                            detail={`${count(placed)} of ${count(enrolment.expected)}`}
                        />
                        <Check
                            done={enrolment.over_classes === 0}
                            label={t('No class is over its seats')}
                            detail={
                                enrolment.over_classes > 0
                                    ? `${count(enrolment.over_classes)} over`
                                    : `${count(enrolment.classes)} ${enrolment.classes === 1 ? 'class' : 'classes'}`
                            }
                        />
                    </RowSection>

                    <RowSection
                        label={t('Who is enrolled for :year', {
                            year: enrolment.year,
                        })}
                    >
                        <Tally
                            label={t('Moving up to the next level')}
                            value={who.promoted}
                        />
                        <Tally
                            label={t('Repeating their level')}
                            value={who.repeating}
                        />
                        <Tally
                            label={t('New students, admitted')}
                            value={who.new}
                        />
                        <Tally
                            label={t('Enrolled')}
                            value={enrolment.expected}
                            strong
                        />
                        <Tally
                            label={t(
                                'Not returning: :graduating graduating, :leaving leaving',
                                {
                                    graduating: count(who.graduating),
                                    leaving: count(who.leaving),
                                },
                            )}
                            value={notReturning}
                            muted
                        />
                    </RowSection>
                </div>

                <aside className="flex shrink-0 flex-col gap-5 border-solid border-border lg:w-[328px] lg:border-l lg:pl-8">
                    <div className="flex flex-col gap-[14px] rounded-lg border border-solid border-border bg-surface p-4">
                        <p className={capsLabelClass}>
                            {enrolment.confirmed
                                ? t('Confirmed')
                                : t('When you confirm')}
                        </p>
                        {enrolment.confirmed ? (
                            <p className="text-[13px] leading-[19px] text-text">
                                {t('Enrolment for')} {enrolment.year}{' '}
                                {t('was confirmed')}
                                {confirmedOn
                                    ? t(' on :confirmed_on', {
                                          confirmed_on: fullDate(confirmedOn),
                                      })
                                    : ''}
                                {t(
                                    '. Students placed from now on are Enrolled straight away.',
                                )}
                            </p>
                        ) : (
                            <ul className="flex flex-col gap-[14px]">
                                <Effect>
                                    {count(placed)}{' '}
                                    {placed === 1
                                        ? t('student becomes')
                                        : t('students become')}{' '}
                                    {t('Enrolled for')} {enrolment.year}
                                </Effect>
                                <Effect
                                    tone={
                                        enrolment.has_fee_plan
                                            ? 'success'
                                            : 'warning'
                                    }
                                >
                                    {enrolment.has_fee_plan
                                        ? t(
                                              'A :year invoice is issued where the level has a fee plan and the year has a first term',
                                              { year: enrolment.year },
                                          )
                                        : t(
                                              'No :year fee plan exists, so nobody is billed',
                                              { year: enrolment.year },
                                          )}
                                </Effect>
                                <Effect tone="warning">
                                    {t(
                                        'The :not_returning not returning keep their records and stay on this year’s roster until the year closes',
                                        { not_returning: count(notReturning) },
                                    )}
                                </Effect>
                                {who.series > 0 && (
                                    <Effect tone="warning">
                                        {count(who.series)}{' '}
                                        {t(
                                            'entering a series level choose their series once the year is active.',
                                        )}{' '}
                                        <Link
                                            href={seriesRegistration.url()}
                                            className={linkClass}
                                        >
                                            {t('Open Series Registration →')}
                                        </Link>
                                    </Effect>
                                )}
                            </ul>
                        )}
                        <ErrorText message={errors.confirm ?? errors.year} />
                        <div className="flex flex-col gap-2">
                            {!enrolment.confirmed && (
                                <button
                                    type="button"
                                    disabled={!enrolment.ready}
                                    onClick={() =>
                                        router.post(
                                            storeConfirmation.url(),
                                            {},
                                            { preserveScroll: true },
                                        )
                                    }
                                    className="flex h-10 shrink-0 items-center justify-center rounded-md bg-primary px-3 text-[14px] leading-[18px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
                                >
                                    {t('Confirm enrolment for')} {count(placed)}{' '}
                                    {placed === 1
                                        ? t('student')
                                        : t('students')}
                                </button>
                            )}
                            <Link
                                href={placement.url()}
                                className={outlineButtonClass}
                            >
                                {t('← Back to class placement')}
                            </Link>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border bg-white p-4">
                        <p className="text-[13px] leading-4 font-semibold text-text">
                            {t('After confirming')}
                        </p>
                        <p className="text-[13px] leading-[19px] text-text-muted">
                            {t(
                                'The roster opens on :year when that year is made active in School Setup.',
                                { year: enrolment.year },
                            )}
                        </p>
                    </div>
                </aside>
            </div>
        </div>
    );
}

export default withAppShell(Confirm);
