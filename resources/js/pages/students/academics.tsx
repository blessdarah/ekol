import { Head, Link } from '@inertiajs/react';
import { show } from '@/actions/App/Http/Controllers/StudentAcademicsController';
import { edit } from '@/actions/App/Http/Controllers/StudentController';
import { reports } from '@/actions/App/Http/Controllers/TermResultController';
import {
    capsLabelClass,
    outlineButtonClass,
} from '../../components/structure/ui';
import {
    StudentHeader,
    StudentTabs,
    shortDate,
} from '../../components/students/ui';
import { withAppShell } from '../../layouts/app-layout';
import { ordinalOf, t } from '../../lib/i18n';

interface Column {
    id: string;
    name: string;
    state: string;
    window_ends_on: string | null;
    average: number | null;
    complete: boolean;
    position: number | null;
    of: number;
}

interface AcademicsProps {
    canOpenReports: boolean;
    student: {
        id: string;
        name: string;
        matricule: string;
        class: string | null;
        class_id: string | null;
        level: string | null;
        admitted_year: string;
        series: string | null;
    };
    terms: { id: string; label: string }[];
    term: { id: string; label: string } | null;
    columns: Column[];
    focus: Column | null;
    subjects: {
        subject: string;
        coefficient: number;
        marks: Record<string, number | 'ABS' | null>;
        kind: 'core' | 'elective' | null;
        teacher: string | null;
    }[];
    coefficients: number;
    remark: { grade: string; text: string; form_master: string | null } | null;
    termAverage: number | null;
    termComplete: boolean;
}

const linkClass =
    'text-[13px] leading-4 font-medium text-primary hover:underline';

function mark(value: number | 'ABS' | null | undefined): string {
    return value === null || value === undefined
        ? '—'
        : value === 'ABS'
          ? 'ABS'
          : value.toFixed(2);
}

function ordinal(position: number): string {
    return ordinalOf(position);
}

function short(name: string): string {
    return name.replace('Sequence', 'Seq').replace(/^Term \d+ exam$/i, 'Exam');
}

function Academics({
    canOpenReports,
    student,
    terms,
    term,
    columns,
    focus,
    subjects,
    coefficients,
    remark,
    termAverage,
    termComplete,
}: AcademicsProps) {
    const readable = (column: Column) =>
        ['marks_open', 'marks_closed', 'published'].includes(column.state);
    const open = columns.find((column) => column.state === 'marks_open');
    const coming = columns.find((column) => column.state === 'scheduled');
    const published = columns.filter((column) => column.state === 'published');

    return (
        <div className="flex flex-col gap-5 lg:min-h-[calc(100vh-56px)]">
            <Head
                title={t(':student · Academics', { student: student.name })}
            />
            <StudentHeader
                trail={[{ label: student.name }, { label: t('Academics') }]}
                title={student.name}
                tag={[student.matricule, student.class, student.series]
                    .filter(Boolean)
                    .join(' · ')}
                meta={[`enrolled ${student.admitted_year}`, student.level]
                    .filter(Boolean)
                    .join(' · ')}
                action={
                    <Link
                        href={edit.url(student.id)}
                        className={outlineButtonClass}
                    >
                        {t('Edit student')}
                    </Link>
                }
            />
            <StudentTabs studentId={student.id} active="academics" />

            {terms.length > 1 && (
                <div className="flex flex-wrap gap-2">
                    {terms.map((option) => (
                        <Link
                            key={option.id}
                            href={show.url(student.id, {
                                query: { term: option.id },
                            })}
                            preserveScroll
                            aria-current={
                                option.id === term?.id ? 'true' : undefined
                            }
                            className={`flex h-[30px] items-center rounded-full border border-solid px-3 text-[13px] leading-4 ${
                                option.id === term?.id
                                    ? 'border-primary bg-primary-tint font-semibold text-primary'
                                    : 'border-border font-medium text-text hover:bg-surface'
                            }`}
                        >
                            {t(option.label)}
                        </Link>
                    ))}
                </div>
            )}

            {!student.class ? (
                <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                    {t(
                        ':student is not in a class this year, so there are no marks to show.',
                        { student: student.name },
                    )}
                </p>
            ) : columns.length === 0 ? (
                <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                    {t('No assessment is scheduled for')}{' '}
                    {term?.label ?? t('this term')}{' '}
                    {t(
                        'yet. Marks appear here once one is, and teachers start entering them.',
                    )}
                </p>
            ) : (
                <div className="flex flex-1 flex-col gap-8 lg:flex-row">
                    <div className="flex min-w-0 flex-1 flex-col gap-[22px]">
                        <div className="flex flex-wrap border-y border-solid border-border">
                            <div className="flex min-w-[170px] flex-1 flex-col gap-1 py-[14px] pr-4">
                                <span className={capsLabelClass}>
                                    {focus
                                        ? t(':focus average', {
                                              focus: focus.name,
                                          })
                                        : t('Average')}
                                </span>
                                <span className="flex items-baseline gap-2">
                                    <span className="font-display text-[28px] leading-8 font-extrabold text-text">
                                        {mark(focus?.average)}
                                    </span>
                                    <span className="font-mono text-[12px] leading-4 text-text-muted">
                                        / 20
                                        {focus && !focus.complete
                                            ? t(' · so far')
                                            : ''}
                                    </span>
                                </span>
                            </div>
                            <div className="flex min-w-[170px] flex-1 flex-col gap-1 border-l border-solid border-border px-4 py-[14px]">
                                <span className={capsLabelClass}>
                                    {t('Position in class')}
                                </span>
                                <span className="flex items-baseline gap-2">
                                    <span className="font-display text-[28px] leading-8 font-extrabold text-text">
                                        {focus?.position
                                            ? ordinal(focus.position)
                                            : '—'}
                                    </span>
                                    <span className="font-mono text-[12px] leading-4 text-text-muted">
                                        {focus?.position
                                            ? t('of :of', { of: focus.of })
                                            : focus
                                              ? t(
                                                    'not ranked while a mark is missing',
                                                )
                                              : ''}
                                    </span>
                                </span>
                            </div>
                            <div className="flex min-w-[170px] flex-1 flex-col gap-1 border-l border-solid border-border py-[14px] pl-4">
                                <span className={capsLabelClass}>
                                    {t('Subjects')}
                                </span>
                                <span className="flex items-baseline gap-2">
                                    <span className="font-display text-[28px] leading-8 font-extrabold text-text">
                                        {subjects.length}
                                    </span>
                                    <span className="font-mono text-[12px] leading-4 text-text-muted">
                                        {t('coeff. total :coefficients', {
                                            coefficients,
                                        })}
                                    </span>
                                </span>
                            </div>
                        </div>

                        {subjects.length === 0 ? (
                            <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                                {t('No marks can be read yet.')}{' '}
                                {coming
                                    ? t(':coming has not opened for marks.', {
                                          coming: coming.name,
                                      })
                                    : ''}
                            </p>
                        ) : (
                            <div className="overflow-x-auto rounded-lg border border-solid border-border">
                                <div className="flex min-w-[620px] flex-col">
                                    <div
                                        className={`flex h-9 items-center gap-4 border-b border-solid border-border bg-surface px-4 ${capsLabelClass}`}
                                    >
                                        <span className="flex-1">
                                            {t('Subject')}
                                        </span>
                                        <span className="w-[170px] shrink-0">
                                            {t('Teacher')}
                                        </span>
                                        <span className="w-12 shrink-0 text-right">
                                            {t('Coef')}
                                        </span>
                                        {columns.map((column) => (
                                            <span
                                                key={column.id}
                                                className="w-[76px] shrink-0 truncate text-right"
                                            >
                                                {short(column.name)}
                                            </span>
                                        ))}
                                    </div>
                                    {subjects.map((subject, position) => (
                                        <div
                                            key={subject.subject}
                                            className={`flex h-[52px] shrink-0 items-center gap-4 border-b border-solid border-border px-4 ${position % 2 === 1 ? 'bg-row-alt' : ''}`}
                                        >
                                            <span className="flex min-w-0 flex-1 items-center gap-[10px]">
                                                <span className="truncate text-[15px] leading-5 text-text">
                                                    {subject.subject}
                                                </span>
                                                {subject.kind && (
                                                    <span
                                                        className={`flex h-5 shrink-0 items-center rounded-sm border px-[6px] font-mono text-[10px] leading-3 font-semibold tracking-[0.06em] uppercase ${
                                                            subject.kind ===
                                                            'core'
                                                                ? 'border-solid border-text text-text'
                                                                : 'border-dashed border-text-muted text-text-muted'
                                                        }`}
                                                    >
                                                        {subject.kind}
                                                    </span>
                                                )}
                                            </span>
                                            <span
                                                className={`w-[170px] shrink-0 truncate text-[13px] leading-4 ${subject.teacher ? 'text-text' : 'text-text-muted'}`}
                                            >
                                                {subject.teacher ??
                                                    t('No teacher')}
                                            </span>
                                            <span className="w-12 shrink-0 text-right font-mono text-[13px] leading-4 text-text">
                                                {subject.coefficient}
                                            </span>
                                            {columns.map((column) => (
                                                <span
                                                    key={column.id}
                                                    className={`w-[76px] shrink-0 text-right font-mono text-[14px] leading-[18px] ${readable(column) && subject.marks[column.id] != null ? 'text-text' : 'text-text-muted'}`}
                                                >
                                                    {mark(
                                                        subject.marks[
                                                            column.id
                                                        ],
                                                    )}
                                                </span>
                                            ))}
                                        </div>
                                    ))}
                                    <div className="flex h-10 shrink-0 items-center gap-4 bg-surface px-4">
                                        <span className="flex-1 text-[13px] leading-4 font-semibold text-text">
                                            {t('Average')}
                                        </span>
                                        <span className="w-[170px] shrink-0" />
                                        <span className="w-12 shrink-0 text-right font-mono text-[13px] leading-4 text-text">
                                            {coefficients}
                                        </span>
                                        {columns.map((column) => (
                                            <span
                                                key={column.id}
                                                className={`w-[76px] shrink-0 text-right ${column.average !== null ? 'font-mono text-[14px] leading-[18px] text-text' : 'text-[12px] leading-4 text-text-muted'}`}
                                            >
                                                {column.average !== null
                                                    ? `${mark(column.average)}${column.complete ? '' : '*'}`
                                                    : t('Later')}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        <p className="text-[13px] leading-[19px] text-text-muted">
                            {t('Marks are out of 20.')}{' '}
                            {open
                                ? t(
                                      ':open marks are open until :window_ends_on, so the average and position can still change. ',
                                      {
                                          open: open.name,
                                          window_ends_on: shortDate(
                                              open.window_ends_on,
                                          ),
                                      },
                                  )
                                : ''}
                            {coming
                                ? t(':coming has not been held yet. ', {
                                      coming: coming.name,
                                  })
                                : ''}
                            {termComplete
                                ? t(
                                      'Every :term assessment is published:average',
                                      {
                                          term: term?.label ?? 'term',
                                          average:
                                              termAverage !== null
                                                  ? `: the term average is ${termAverage.toFixed(2)}.`
                                                  : ', but a mark is missing so there is no term average.',
                                      },
                                  )
                                : t(
                                      'The term average comes once every assessment of the term is published.',
                                  )}
                            {columns.some(
                                (column) =>
                                    column.average !== null && !column.complete,
                            )
                                ? t(
                                      ' * An average so far: a mark is still missing.',
                                  )
                                : ''}
                        </p>
                    </div>

                    <aside className="flex shrink-0 flex-col gap-5 border-solid border-border lg:w-[328px] lg:border-l lg:pl-8">
                        <div className="flex flex-col gap-2 rounded-lg border border-solid border-border bg-surface p-4">
                            <p className={capsLabelClass}>
                                {t('Remark for the grade')}
                            </p>
                            {remark && focus ? (
                                <>
                                    <p className="text-[14px] leading-[21px] text-text">
                                        {t(remark.text)}
                                    </p>
                                    <p className="text-[12px] leading-4 text-text-muted">
                                        {focus.name} · {remark.grade}
                                        {remark.form_master
                                            ? t(' · form master :form_master', {
                                                  form_master:
                                                      remark.form_master,
                                              })
                                            : ''}
                                    </p>
                                </>
                            ) : (
                                <p className="text-[13px] leading-[19px] text-text-muted">
                                    {t(
                                        'A remark shows once there is an average to grade.',
                                    )}
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
                                        <span className="text-text">
                                            {column.name}
                                        </span>
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
                                                    : t(
                                                          'After :published more :are published',
                                                          {
                                                              published:
                                                                  columns.length -
                                                                  published.length,
                                                              are:
                                                                  columns.length -
                                                                      published.length ===
                                                                  1
                                                                      ? 'is'
                                                                      : 'are',
                                                          },
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
                </div>
            )}
        </div>
    );
}

export default withAppShell(Academics);
