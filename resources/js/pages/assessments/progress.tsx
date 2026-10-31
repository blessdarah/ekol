import { Head, Link } from '@inertiajs/react';
import { index } from '@/actions/App/Http/Controllers/AssessmentController';
import { results } from '@/actions/App/Http/Controllers/AssessmentResultController';
import {
    AssessmentHeader,
    Empty,
    day,
    primaryClass,
    quietClass,
    range,
} from '../../components/assessments/ui';
import { ErrorText } from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';
import {
    type ProgressProps,
    useMarksProgress,
} from '../../components/assessments/progress/model';
import { MarksWindow } from '../../components/assessments/progress/marks-window';
import { ClassProgress } from '../../components/assessments/progress/class-progress';
import { TeacherProgress } from '../../components/assessments/progress/teacher-progress';
import { CloseMarks } from '../../components/assessments/progress/close-marks';
function Progress(props: ProgressProps) {
    const { tabs, plan } = props;
    if (!plan) {
        return (
            <div className="flex flex-col gap-5">
                <Head title={t('Marks progress')} />
                <AssessmentHeader
                    active="progress"
                    tabs={tabs}
                    trail={[{ label: t('Marks progress') }]}
                    title={t('Marks progress')}
                    meta={t(
                        'Who has handed in marks for the assessment you pick.',
                    )}
                />
                <Empty title={t('Nothing is scheduled yet')}>
                    {t(
                        'Marks progress follows an assessment once it is scheduled.',
                    )}{' '}
                    <Link
                        href={index.url()}
                        className="font-medium text-primary hover:underline"
                    >
                        {t('Open the calendar →')}
                    </Link>
                </Empty>
            </div>
        );
    }
    return <MarksProgressPage {...props} plan={plan} />;
}
function MarksProgressPage(
    props: ProgressProps & { plan: NonNullable<ProgressProps['plan']> },
) {
    const model = useMarksProgress(props);
    const {
        tabs,
        plan,
        acceptsMarks,
        classes,
        errors,
        view,
        closing,
        setClosing,
        extending,
        setExtending,
        canExtend,
    } = model;
    return (
        <div className="flex flex-col gap-7">
            <Head title={t('Marks progress')} />
            <AssessmentHeader
                active="progress"
                tabs={tabs}
                trail={[{ label: t('Marks progress') }]}
                title={t('Marks progress')}
                meta={[
                    plan.name,
                    plan.term ? t(plan.term) : null,
                    plan.held_from && plan.held_until
                        ? t('tests held :range', {
                              range: range(plan.held_from, plan.held_until),
                          })
                        : null,
                ]
                    .filter(Boolean)
                    .join(' · ')}
                action={
                    <div className="flex flex-wrap gap-2">
                        {canExtend && (
                            <button
                                type="button"
                                onClick={() => setExtending(!extending)}
                                className={quietClass}
                            >
                                {plan.state === 'marks_closed'
                                    ? t('Reopen marks entry')
                                    : t('Extend the window')}
                            </button>
                        )}
                        {plan.state === 'marks_open' ? (
                            <button
                                type="button"
                                onClick={() => setClosing(true)}
                                className={primaryClass}
                            >
                                {t('Close marks entry →')}
                            </button>
                        ) : (
                            plan.state !== 'scheduled' && (
                                <Link
                                    href={results.url({
                                        query: { plan: plan.id },
                                    })}
                                    className={primaryClass}
                                >
                                    {t('Open results →')}
                                </Link>
                            )
                        )}
                    </div>
                }
            />

            <MarksWindow {...model} />

            {classes.length === 0 ? (
                <Empty title={t('No mark sheets yet')}>
                    {t(
                        'Sheets are made for every class in the assessment’s levels, one per subject the class takes. None of those classes has subjects yet.',
                    )}
                </Empty>
            ) : view === 'class' ? (
                <ClassProgress {...model} />
            ) : (
                <TeacherProgress {...model} />
            )}

            <ErrorText message={errors.close} />

            <p className="-mt-3 max-w-[640px] text-[13px] leading-[19px] text-text-muted">
                {plan.state === 'scheduled' &&
                    t(
                        'Marks open on :window_starts_on. Teachers cannot enter marks before then.',
                        { window_starts_on: day(plan.window_starts_on) },
                    )}
                {plan.state === 'marks_open' &&
                    (acceptsMarks
                        ? t(
                              'Marks close on :window_ends_on. After that teachers cannot enter marks.',
                              { window_ends_on: day(plan.window_ends_on) },
                          )
                        : t(
                              'The window ended on :window_ends_on, so teachers can no longer enter marks. Extend it, or close marks entry.',
                              { window_ends_on: day(plan.window_ends_on) },
                          ))}
                {plan.state === 'marks_closed' &&
                    t(
                        'Marks entry is closed. Review the results, then publish them.',
                    )}
                {plan.state === 'published' &&
                    t(
                        'Results were published on :published_on. Marks are locked.',
                        { published_on: day(plan.published_on) },
                    )}
            </p>

            {closing && <CloseMarks {...model} />}
        </div>
    );
}
export default withAppShell(Progress);
