import { Link } from '@inertiajs/react';
import { show as sheetPage } from '@/actions/App/Http/Controllers/MarkSheetController';
import { t, tChoice } from '../../../lib/i18n';
import { Card, Pending } from './card';
import { day, outlineButton, type TodayModel } from './model';

/** The mark sheets the teacher owes, open or opening later. */
export function MarksCard({ today }: { today: TodayModel }) {
    const { sheets, openSheets, closesOn, upcoming } = today;

    return (
        <Card
            title={t('Marks to enter')}
            note={
                openSheets > 0
                    ? closesOn
                        ? tChoice(
                              '{1} :count open · closes :day|[2,*] :count open · all close :day',
                              openSheets,
                              { day: day(closesOn) },
                          )
                        : tChoice(
                              '{1} :count open|[2,*] :count open',
                              openSheets,
                          )
                    : undefined
            }
            className="xl:flex-[1.75]"
        >
            {sheets.length === 0 ? (
                <Pending>
                    {t(
                        'Nothing to enter. A sheet appears here when an assessment is scheduled for a class you teach.',
                    )}
                </Pending>
            ) : (
                sheets.map((sheet, position) => {
                    const share =
                        sheet.students > 0
                            ? Math.round((sheet.entered / sheet.students) * 100)
                            : 0;
                    const resume =
                        sheet.open && sheet.entered > 0 && !sheet.submitted;

                    return (
                        <div
                            key={sheet.id}
                            className={`flex flex-wrap items-center gap-4 px-4 py-3 ${position > 0 ? 'border-t border-solid border-border' : ''} ${resume ? 'bg-primary-faint' : ''}`}
                        >
                            <div className="flex w-[240px] shrink-0 flex-col gap-[2px]">
                                <p className="font-display text-[14px] leading-[18px] font-semibold text-text">
                                    {sheet.plan} · {sheet.class}
                                </p>
                                <p className="text-[12px] leading-4 text-text-muted">
                                    {sheet.subject} ·{' '}
                                    {tChoice(
                                        '{1} :count student|[2,*] :count students',
                                        sheet.students,
                                    )}
                                </p>
                            </div>
                            {sheet.open ? (
                                <>
                                    <div className="flex w-[180px] shrink-0 flex-col gap-[6px]">
                                        <p className="font-mono text-[18px] leading-[22px] text-text">
                                            {sheet.entered} / {sheet.students}
                                        </p>
                                        <span
                                            className={`flex h-[6px] rounded-full ${resume ? 'bg-white' : 'bg-surface'}`}
                                        >
                                            <span
                                                className={`h-[6px] rounded-full ${sheet.entered > 0 ? 'bg-primary' : 'bg-neutral-outline'}`}
                                                style={{
                                                    width: `${Math.max(2, share)}%`,
                                                }}
                                            />
                                        </span>
                                    </div>
                                    <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
                                        {sheet.submitted && (
                                            <span className="text-[12px] leading-4 text-success">
                                                {t('Submitted')}
                                            </span>
                                        )}
                                        <Link
                                            href={sheetPage.url(sheet.id)}
                                            className={
                                                resume
                                                    ? 'flex h-[34px] shrink-0 items-center rounded-md bg-primary px-[14px] text-[13px] leading-4 font-medium text-white hover:bg-primary-hover'
                                                    : outlineButton
                                            }
                                        >
                                            {sheet.submitted
                                                ? t('Review')
                                                : resume
                                                  ? t('Resume')
                                                  : t('Start')}
                                        </Link>
                                    </div>
                                </>
                            ) : (
                                <p className="min-w-0 flex-1 text-right text-[13px] leading-4 font-medium text-text-muted opacity-70">
                                    {t('Opens :opens_on', {
                                        opens_on: day(sheet.opens_on),
                                    })}
                                </p>
                            )}
                        </div>
                    );
                })
            )}
            {sheets.length > 0 && (
                <p className="border-t border-solid border-border bg-row-alt px-4 py-3 text-[12px] leading-4 text-text-muted">
                    {openSheets === 0
                        ? t('Nothing is owed right now.')
                        : upcoming.length === 0
                          ? t('Nothing else is coming up.')
                          : tChoice(
                                '{1} :count more sheet opens later.|[2,*] :count more sheets open later.',
                                upcoming.length,
                            )}
                </p>
            )}
        </Card>
    );
}
