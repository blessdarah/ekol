import { amberText } from '../ui';
import { t } from '../../../lib/i18n';
import { type MarksProgressModel, headClass, SheetChip } from './model';
export function TeacherProgress({
    teachers,
}: Pick<MarksProgressModel, 'teachers'>) {
    return (
        <div className="-mt-4 overflow-x-auto rounded-xl border border-solid border-border">
            <div className="flex min-w-[820px] flex-col">
                <div
                    className={`flex h-[38px] items-center gap-4 border-b border-solid border-border bg-surface px-5 ${headClass}`}
                >
                    <span className="w-[260px] shrink-0">{t('Teacher')}</span>
                    <span className="w-[90px] shrink-0">{t('Missing')}</span>
                    <span className="flex-1">{t('Sheets')}</span>
                </div>
                {teachers.length === 0 && (
                    <p className="px-5 py-10 text-center text-[13px] text-text-muted">
                        {t('Every sheet is handed in.')}
                    </p>
                )}
                {teachers.map((teacher) => (
                    <div
                        key={teacher.id ?? 'none'}
                        className="flex min-h-[68px] items-center gap-4 border-b border-solid border-border px-5 py-3 last:border-b-0"
                    >
                        <span className="flex w-[260px] shrink-0 items-center gap-3">
                            {teacher.id ? (
                                <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-primary-tint text-[12px] font-semibold text-primary">
                                    {teacher.initials}
                                </span>
                            ) : (
                                <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-warning-line text-[14px] text-warning-text">
                                    +
                                </span>
                            )}
                            <span className="flex min-w-0 flex-col gap-[2px]">
                                <span
                                    className={`truncate text-[15px] leading-5 font-semibold ${teacher.id ? 'text-text' : amberText}`}
                                >
                                    {teacher.name ?? t('No teacher')}
                                </span>
                                {teacher.id ? (
                                    teacher.phone && (
                                        <a
                                            href={`tel:${teacher.phone.replace(/\s+/g, '')}`}
                                            className="font-mono text-[12px] text-text-muted hover:text-text"
                                        >
                                            {teacher.phone}
                                        </a>
                                    )
                                ) : (
                                    <span className="text-[12px] text-text-muted">
                                        {t('assign one to open their sheets')}
                                    </span>
                                )}
                            </span>
                        </span>
                        <span
                            className={`w-[90px] shrink-0 text-[14px] leading-5 font-medium ${teacher.id ? 'text-text' : 'text-text-muted'}`}
                        >
                            {t(':count sheets', {
                                count: teacher.missing.length,
                            })}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-wrap gap-[6px]">
                            {teacher.missing.map((sheet) => (
                                <SheetChip
                                    key={sheet.sheet_id}
                                    sheet={sheet}
                                    label={`${sheet.subject} · ${sheet.class}`}
                                />
                            ))}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
