import { t } from '../../../lib/i18n';
import { type MarksProgressModel, headClass, Tick, SheetChip } from './model';
export function ClassProgress({
    onlyMissing,
    setOnlyMissing,
    complete,
    shownClasses,
}: Pick<
    MarksProgressModel,
    'onlyMissing' | 'setOnlyMissing' | 'complete' | 'shownClasses'
>) {
    return (
        <div className="-mt-4 flex flex-col gap-4">
            <div className="overflow-x-auto rounded-xl border border-solid border-border">
                <div className="flex min-w-[820px] flex-col">
                    <div
                        className={`flex h-[38px] items-center gap-4 border-b border-solid border-border bg-surface px-5 ${headClass}`}
                    >
                        <span className="w-[200px] shrink-0">{t('Class')}</span>
                        <span className="w-[200px] shrink-0">
                            {t('Sheets in')}
                        </span>
                        <span className="flex-1">{t('Still missing')}</span>
                    </div>
                    {shownClasses.length === 0 && (
                        <p className="px-5 py-10 text-center text-[13px] text-text-muted">
                            {t('Every class has handed in every sheet.')}
                        </p>
                    )}
                    {shownClasses.map((row) => {
                        const ratio =
                            row.total > 0 ? row.submitted / row.total : 0;

                        return (
                            <div
                                key={row.id ?? row.name}
                                className="flex min-h-[68px] items-center gap-4 border-b border-solid border-border px-5 py-3 last:border-b-0"
                            >
                                <span className="flex w-[200px] shrink-0 flex-col gap-[2px]">
                                    <span className="truncate text-[15px] leading-5 font-semibold text-text">
                                        {row.name}
                                    </span>
                                    <span className="truncate text-[13px] leading-4 text-text-muted">
                                        {row.form_master
                                            ? t('Form master · :name', {
                                                  name: row.form_master,
                                              })
                                            : t('No form master')}
                                    </span>
                                </span>
                                <span className="flex w-[200px] shrink-0 items-center gap-3">
                                    <span className="flex h-[6px] w-[110px] shrink-0 overflow-hidden rounded-full bg-border">
                                        <span
                                            className={
                                                ratio >= 1
                                                    ? 'bg-success'
                                                    : 'bg-warning'
                                            }
                                            style={{
                                                width: `${Math.round(ratio * 100)}%`,
                                            }}
                                        />
                                    </span>
                                    <span className="font-mono text-[12px] text-text">
                                        {row.submitted}{' '}
                                        <span className="text-text-muted">
                                            {t('of :total', {
                                                total: row.total,
                                            })}
                                        </span>
                                    </span>
                                </span>
                                <span className="flex min-w-0 flex-1 flex-wrap gap-[6px]">
                                    {row.missing.length === 0 ? (
                                        <span className="flex items-center gap-[6px] text-[13px] text-success">
                                            <Tick />
                                            {t('Every sheet is in')}
                                        </span>
                                    ) : (
                                        row.missing.map((sheet) => (
                                            <SheetChip
                                                key={sheet.sheet_id}
                                                sheet={sheet}
                                                label={sheet.subject ?? ''}
                                                withTeacher
                                            />
                                        ))
                                    )}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] leading-[18px] text-text-muted">
                <span className="flex items-center gap-[6px]">
                    {onlyMissing && complete > 0 && (
                        <>
                            <Tick />
                            {complete === 1
                                ? t('1 class has every sheet in ·')
                                : t(':count classes have every sheet in ·', {
                                      count: complete,
                                  })}
                            <button
                                type="button"
                                onClick={() => setOnlyMissing(false)}
                                className="font-medium text-primary hover:underline"
                            >
                                {t('show them')}
                            </button>
                        </>
                    )}
                </span>
                <span>
                    {t(
                        'Chips show marks entered so far · click to open the sheet',
                    )}
                </span>
            </div>
        </div>
    );
}
