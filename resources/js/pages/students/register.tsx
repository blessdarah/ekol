import { Head, Link } from '@inertiajs/react';
import { index } from '@/actions/App/Http/Controllers/StudentRosterController';
import { show } from '@/actions/App/Http/Controllers/StudentController';
import {
    capsLabelClass,
    outlineButtonClass,
    solidButtonClass,
} from '../../components/structure/ui';
import { StudentHeader, money, shortDate } from '../../components/students/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';
import {
    type RegisterProps,
    useStudentRegistration,
    ORDINALS,
    Tick,
} from '../../components/students/registration/model';
import { StudentIdentity } from '../../components/students/registration/student-identity';
import { StudentBackground } from '../../components/students/registration/student-background';
import { StudentClass } from '../../components/students/registration/student-class';
import { StudentGuardians } from '../../components/students/registration/student-guardians';
import { RegistrationSummary } from '../../components/students/registration/registration-summary';
function Register(props: RegisterProps) {
    const model = useStudentRegistration(props);
    const {
        student,
        currency,
        data,
        setData,
        processing,
        errors,
        levelId,
        level,
        plan,
        submit,
    } = model;
    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                submit(false);
            }}
            className="flex flex-col gap-6"
        >
            <Head
                title={student ? t('Edit a student') : t('Register a student')}
            />
            <StudentHeader
                trail={
                    student
                        ? [
                              {
                                  label: `${student.surname} ${student.given_names}`.trim(),
                                  href: show.url(student.id),
                              },
                              { label: t('Edit') },
                          ]
                        : [{ label: t('Add student') }]
                }
                title={student ? t('Edit a student') : t('Register a student')}
                tag={t('Enrolment:year_label', {
                    year_label: props.yearLabel ? ` · ${props.yearLabel}` : '',
                })}
                meta={t(
                    'identity, background, class, parents and fees in one go',
                )}
            />

            <div className="flex flex-col gap-8 lg:flex-row">
                <div className="flex min-w-0 flex-1 flex-col gap-7">
                    <StudentIdentity {...model} />

                    <StudentBackground {...model} />

                    <StudentClass {...model} />

                    <StudentGuardians {...model} />

                    {!student && (
                        <section className="flex flex-col gap-[14px]">
                            <p className={capsLabelClass}>{t('Fees')}</p>
                            {plan ? (
                                <div className="flex flex-wrap items-center gap-3 rounded-md bg-surface px-[14px] py-3">
                                    <div className="flex w-[150px] shrink-0 flex-col gap-[2px]">
                                        <span className="text-[13px] leading-4 text-text-muted">
                                            {t('Standard plan')}
                                        </span>
                                        <span className="font-mono text-[15px] leading-5 text-text">
                                            {money(plan.amount, currency)}
                                        </span>
                                        {plan.items.length > 1 &&
                                            plan.items.map((item) => (
                                                <span
                                                    key={item.name}
                                                    className="text-[12px] leading-4 text-text-muted"
                                                >
                                                    {item.name} ·{' '}
                                                    {money(item.amount)}
                                                </span>
                                            ))}
                                    </div>
                                    <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                                        {plan.installments.map(
                                            (installment) => (
                                                <div
                                                    key={installment.seq}
                                                    className="flex min-w-[110px] flex-1 flex-col gap-[2px] rounded-md border border-solid border-border bg-white px-[10px] py-[6px]"
                                                >
                                                    <span className="text-[12px] leading-4 text-text-muted">
                                                        {ORDINALS[
                                                            installment.seq - 1
                                                        ] ??
                                                            `#${installment.seq}`}{' '}
                                                        ·{' '}
                                                        {shortDate(
                                                            installment.due_on,
                                                        )}
                                                    </span>
                                                    <span className="font-mono text-[13px] leading-4 text-text">
                                                        {money(
                                                            installment.amount,
                                                        )}
                                                    </span>
                                                </div>
                                            ),
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <p className="rounded-md bg-surface px-[14px] py-3 text-[13px] leading-[19px] text-text-muted">
                                    {levelId
                                        ? t(
                                              'No fee plan is set for :level this year, so nothing is billed at admission.',
                                              { level: level?.name },
                                          )
                                        : t(
                                              'Choose a level to see its fee plan.',
                                          )}
                                </p>
                            )}
                        </section>
                    )}

                    {errors.duplicate && (
                        <div
                            role="alert"
                            className="flex flex-col gap-[10px] rounded-lg border border-solid border-warning bg-warning-tint p-4"
                        >
                            <p className="text-[14px] leading-[18px] font-semibold text-warning-text">
                                {t('Possible duplicate')}
                            </p>
                            <p className="text-[13px] leading-[19px] text-text">
                                {errors.duplicate}
                            </p>
                            <Tick
                                checked={data.allow_duplicate}
                                onChange={(next) =>
                                    setData('allow_duplicate', next)
                                }
                            >
                                {t(
                                    'This is a different student. Register anyway.',
                                )}
                            </Tick>
                        </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <p className="text-[13px] leading-4 text-text-muted">
                            {t('Fees come from School Setup.')}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Link
                                href={
                                    student ? show.url(student.id) : index.url()
                                }
                                className={outlineButtonClass}
                            >
                                {t('Cancel')}
                            </Link>
                            {!student && (
                                <button
                                    type="button"
                                    disabled={processing}
                                    onClick={() => submit(true)}
                                    className={outlineButtonClass}
                                >
                                    {t('Save and add another')}
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={processing}
                                className={solidButtonClass}
                            >
                                {student
                                    ? t('Save changes')
                                    : t('Register student')}
                            </button>
                        </div>
                    </div>
                </div>

                <RegistrationSummary {...model} />
            </div>
        </form>
    );
}
export default withAppShell(Register);
