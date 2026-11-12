import { Link } from '@inertiajs/react';
import { reports } from '@/actions/App/Http/Controllers/TermReportController';
import { t, tChoice } from '../../../lib/i18n';
import { capsLabelClass } from '../../structure/ui';
import { linkClass, type StudentAcademics } from './model';

/** The grade remark, the report cards and where the subjects come from. */
export function AcademicsAside({ academics }: { academics: StudentAcademics }) {
    const {
        canOpenReports,
        student,
        term,
        columns,
        focus,
        remark,
        termComplete,
        published,
    } = academics;

    return (
        <aside className="flex shrink-0 flex-col gap-5 border-solid border-border lg:w-[328px] lg:border-l lg:pl-8">
            <div className="flex flex-col gap-2 rounded-lg border border-solid border-border bg-surface p-4">
                <p className={capsLabelClass}>{t('Remark for the grade')}</p>
                {remark && focus ? (
                    <>
                        <p className="text-[14px] leading-[21px] text-text">
                            {t(remark.text)}
                        </p>
                        <p className="text-[12px] leading-4 text-text-muted">
                            {focus.name} · {remark.grade}
                            {remark.form_master
                                ? t(' · form master :form_master', {
                                      form_master: remark.form_master,
                                  })
                                : ''}
                        </p>
                    </>
                ) : (
                    <p className="text-[13px] leading-[19px] text-text-muted">
                        {t('A remark shows once there is an average to grade.')}
                    </p>
                )}
            </div>

            <div className="flex flex-col gap-2 rounded-lg border border-solid border-border bg-white p-4">
                <p className="text-[14px] leading-[18px] font-semibold text-text">
                    {t('Report cards')}
                </p>
                <ul className="flex flex-col">
                    {columns.map((column) => (
                        <li
                            key={column.id}
                            className="flex items-center justify-between gap-3 py-[5px] text-[13px] leading-4"
                        >
                            <span className="text-text">{column.name}</span>
                            {column.state === 'published' &&
                            canOpenReports &&
                            student.class_id ? (
                                <Link
                                    href={reports.url({
                                        query: {
                                            plan: column.id,
                                            class: student.class_id,
                                            student: student.id,
                                        },
                                    })}
                                    className={linkClass}
                                >
                                    {t('Open card →')}
                                </Link>
                            ) : (
                                <span
                                    className={
                                        column.state === 'published'
                                            ? 'text-success'
                                            : 'text-text-muted'
                                    }
                                >
                                    {column.state === 'published'
                                        ? t('Published')
                                        : t('After publishing')}
                                </span>
                            )}
                        </li>
                    ))}
                    {term && (
                        <li className="flex items-center justify-between gap-3 py-[5px] text-[13px] leading-4">
                            <span className="text-text-muted">
                                {t(':label report', {
                                    label: term.label,
                                })}
                            </span>
                            {termComplete &&
                            canOpenReports &&
                            student.class_id ? (
                                <Link
                                    href={reports.url({
                                        query: {
                                            term: term.id,
                                            class: student.class_id,
                                            student: student.id,
                                        },
                                    })}
                                    className={linkClass}
                                >
                                    {t('Open card →')}
                                </Link>
                            ) : (
                                <span className="text-text-muted">
                                    {termComplete
                                        ? t('Ready')
                                        : tChoice(
                                              '{1} After :count more is published|[2,*] After :count more are published',
                                              columns.length - published.length,
                                          )}
                                </span>
                            )}
                        </li>
                    )}
                </ul>
            </div>

            <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-4">
                <p className="text-[13px] leading-4 font-semibold text-text">
                    {t('Where the subjects come from')}
                </p>
                <p className="text-[13px] leading-[19px] text-text-muted">
                    {student.series
                        ? t(
                              ':series marks which subjects are core and which are this student’s electives. The list itself is every subject :class takes.',
                              {
                                  series: student.series,
                                  class: student.class,
                              },
                          )
                        : t(
                              'These are the subjects :class takes, each with the coefficient of its level.',
                              { class: student.class },
                          )}
                </p>
            </div>
        </aside>
    );
}
