import { t } from '../../../lib/i18n';
import { capsLabelClass } from '../../structure/ui';
import { tableRowClass } from '../../table/ui';
import { mark, short, type StudentAcademics } from './model';

/** The student's marks, subject by subject, for each assessment. */
export function MarksTable({ academics }: { academics: StudentAcademics }) {
    const { columns, subjects, coefficients, readable, coming } = academics;

    return (
        <>
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
                            <span className="flex-1">{t('Subject')}</span>
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
                                className={`flex h-[52px] shrink-0 items-center gap-4 border-b border-solid border-border px-4 ${tableRowClass({ index: position })}`}
                            >
                                <span className="flex min-w-0 flex-1 items-center gap-[10px]">
                                    <span className="truncate text-[15px] leading-5 text-text">
                                        {subject.subject}
                                    </span>
                                    {subject.kind && (
                                        <span
                                            className={`flex h-5 shrink-0 items-center rounded-sm border px-[6px] font-mono text-[10px] leading-3 font-semibold tracking-[0.06em] uppercase ${
                                                subject.kind === 'core'
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
                                    {subject.teacher ?? t('No teacher')}
                                </span>
                                <span className="w-12 shrink-0 text-right font-mono text-[13px] leading-4 text-text">
                                    {subject.coefficient}
                                </span>
                                {columns.map((column) => (
                                    <span
                                        key={column.id}
                                        className={`w-[76px] shrink-0 text-right font-mono text-[14px] leading-[18px] ${readable(column) && subject.marks[column.id] != null ? 'text-text' : 'text-text-muted'}`}
                                    >
                                        {mark(subject.marks[column.id])}
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
        </>
    );
}
