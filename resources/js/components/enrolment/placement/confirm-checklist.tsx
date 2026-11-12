import { Link } from '@inertiajs/react';
import { index as applications } from '@/actions/App/Http/Controllers/ApplicationRosterController';
import { confirm } from '@/actions/App/Http/Controllers/EnrolmentConfirmationController';
import { reEnrolment } from '@/actions/App/Http/Controllers/ReEnrolmentController';
import { t, tChoice } from '../../../lib/i18n';
import { CheckLine, count, linkClass, listed } from '../ui';
import { type ClassPlacement } from './model';

/** What is left before enrolment can be confirmed. */
export function ConfirmChecklist({
    classPlacement,
}: {
    classPlacement: ClassPlacement;
}) {
    const { enrolment } = classPlacement;

    return (
        <div className="flex flex-col gap-[10px] rounded-lg border border-solid border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[14px] leading-[18px] font-semibold text-text">
                    {enrolment.confirmed
                        ? t('Enrolment is confirmed')
                        : t('Before enrolment can be confirmed')}
                </p>
                {enrolment.ready || enrolment.confirmed ? (
                    <Link
                        href={confirm.url()}
                        className="flex h-8 items-center rounded-md bg-primary px-[14px] text-[13px] leading-4 font-semibold text-white hover:bg-primary-hover"
                    >
                        {enrolment.confirmed
                            ? t('Open confirmation')
                            : t('Confirm enrolment')}
                    </Link>
                ) : (
                    <span
                        aria-disabled="true"
                        className="flex h-8 items-center rounded-md border border-solid border-border bg-white px-[14px] text-[13px] leading-4 font-semibold text-text opacity-50"
                    >
                        {t('Confirm enrolment')}
                    </span>
                )}
            </div>
            <ul className="flex flex-col gap-[10px]">
                <CheckLine done={enrolment.undecided === 0}>
                    {enrolment.undecided === 0 ? (
                        t('Every continuing student is decided')
                    ) : (
                        <>
                            {count(enrolment.undecided)} {t('continuing')}{' '}
                            {enrolment.undecided === 1
                                ? t('student is')
                                : t('students are')}{' '}
                            {t('not decided →')}{' '}
                            <Link
                                href={reEnrolment.url()}
                                className={linkClass}
                            >
                                {t('Promotion')}
                            </Link>
                        </>
                    )}
                </CheckLine>
                <CheckLine done={enrolment.to_review === 0}>
                    {enrolment.to_review === 0 ? (
                        t('Every application has an answer')
                    ) : (
                        <>
                            {count(enrolment.to_review)}{' '}
                            {enrolment.to_review === 1
                                ? t('application is')
                                : t('applications are')}{' '}
                            {t('still to review →')}{' '}
                            <Link
                                href={applications.url({
                                    query: {
                                        stage: 'to_review',
                                    },
                                })}
                                className={linkClass}
                            >
                                {t('Admissions')}
                            </Link>
                        </>
                    )}
                </CheckLine>
                <CheckLine
                    done={
                        enrolment.over_levels.length === 0 &&
                        enrolment.unplaced === 0 &&
                        enrolment.expected > 0
                    }
                >
                    {enrolment.over_levels.length > 0
                        ? tChoice(
                              '{1} :over_levels has more students than seats → Add a class|[2,*] :over_levels have more students than seats → Add a class',
                              enrolment.over_levels.length,
                              { over_levels: listed(enrolment.over_levels) },
                          )
                        : enrolment.unplaced > 0
                          ? tChoice(
                                '{1} :count student is still waiting for a class|[2,*] :count students are still waiting for a class',
                                enrolment.unplaced,
                                { count: count(enrolment.unplaced) },
                            )
                          : enrolment.expected > 0
                            ? t('Every student has a class')
                            : t('Nobody is headed for next year yet')}
                </CheckLine>
                <CheckLine done={enrolment.has_fee_plan}>
                    {enrolment.has_fee_plan
                        ? t('The :year fee plan is set', {
                              year: enrolment.year,
                          })
                        : t(
                              'No :year fee plan yet, so confirming bills nothing',
                              { year: enrolment.year },
                          )}
                </CheckLine>
            </ul>
        </div>
    );
}
