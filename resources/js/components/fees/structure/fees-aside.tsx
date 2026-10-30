import { show as schoolSetup } from '@/actions/App/Http/Controllers/SetupController';
import { Link } from '@inertiajs/react';
import { t } from '../../../lib/i18n';
import { capsLabelClass, solidButtonClass } from '../../structure/ui';
import { amberText, dayMonth } from '../ui';
import { type FeeStructure, linkClass } from './model';

/** Installments, billing students, and fees for new students. */
export function FeesAside({ fees }: { fees: FeeStructure }) {
    const {
        year,
        billingTerm,
        installments,
        dirty,
        unbilled,
        hasUpfront,
        billStudents,
    } = fees;

    return (
        <>
            <div className="flex flex-col gap-3 rounded-lg border border-solid border-border bg-surface p-4">
                <div className="flex items-baseline justify-between">
                    <p className={capsLabelClass}>{t('Installments')}</p>
                    <Link href={schoolSetup.url()} className={linkClass}>
                        {t('Edit in School Setup')}
                    </Link>
                </div>
                {installments.length === 0 ? (
                    <p className="text-[13px] leading-[19px] text-text">
                        {t(
                            ':label has no installments, so each invoice is one amount due the day it is issued.',
                            { label: year.label },
                        )}
                    </p>
                ) : (
                    <>
                        <ul className="flex flex-col">
                            {installments.map((installment) => (
                                <li
                                    key={installment.seq}
                                    className="flex items-center justify-between border-t border-solid border-border py-2 first:border-t-0 first:pt-0"
                                >
                                    <span className="text-[13px] leading-4 text-text">
                                        {t(installment.label)} ·{' '}
                                        {installment.percent}%
                                    </span>
                                    <span className="font-mono text-[12px] leading-4 text-text-muted">
                                        {t('due :due_on', {
                                            due_on: dayMonth(
                                                installment.due_on,
                                            ),
                                        })}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <p className="text-[12px] leading-[17px] text-text-muted">
                            {t(
                                'The percentages apply to items spread over the installments.',
                            )}
                            {hasUpfront
                                ? t(
                                      ' Items paid in full are added to the 1st installment.',
                                  )
                                : ''}
                        </p>
                    </>
                )}
            </div>

            <div className="flex flex-col gap-[10px] rounded-lg border border-solid border-border bg-white p-4">
                <p className="text-[14px] leading-[18px] font-semibold text-text">
                    {t('Billing students')}
                </p>
                {year.current ? (
                    <>
                        <p className="text-[13px] leading-[19px] text-text-muted">
                            {unbilled > 0
                                ? t(
                                      ':unbilled enrolled :have a fee set and no invoice yet.',
                                      {
                                          unbilled,
                                          have:
                                              unbilled === 1
                                                  ? 'student has'
                                                  : 'students have',
                                      },
                                  )
                                : t(
                                      'Every enrolled student in a level with a fee has an invoice.',
                                  )}{' '}
                            {billingTerm
                                ? t(
                                      'Invoices are issued against :billing_term.',
                                      { billing_term: billingTerm },
                                  )
                                : t(
                                      'The year has no term to bill against yet.',
                                  )}
                        </p>
                        {unbilled > 0 && (
                            <button
                                type="button"
                                disabled={dirty}
                                onClick={() => billStudents()}
                                className={solidButtonClass}
                            >
                                {t('Bill')} {unbilled}{' '}
                                {unbilled === 1 ? t('student') : t('students')}
                            </button>
                        )}
                        {dirty && unbilled > 0 && (
                            <p
                                className={`text-[12px] leading-[17px] ${amberText}`}
                            >
                                {t(
                                    'Save the fees first, so students are billed the new amounts.',
                                )}
                            </p>
                        )}
                    </>
                ) : (
                    <p className="text-[13px] leading-[19px] text-text-muted">
                        {t(
                            ':label is not active yet. Its students are billed when enrolment is confirmed, on the fees set here.',
                            { label: year.label },
                        )}
                    </p>
                )}
            </div>

            <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-4">
                <p className="text-[13px] leading-4 font-semibold text-text">
                    {t('New students')}
                </p>
                <p className="text-[13px] leading-[19px] text-text-muted">
                    {t(
                        'A student registered after this is billed automatically, on the items of the level they join. A student is new in their first year at the school, and only then pays the items marked for new students.',
                    )}
                </p>
            </div>
        </>
    );
}
