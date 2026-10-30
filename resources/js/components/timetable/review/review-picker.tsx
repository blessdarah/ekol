import { Link } from '@inertiajs/react';
import { amberText, plural } from '../ui';
import { t } from '../../../lib/i18n';
import { type TimetableReviewModel, VIEWS } from './model';
export function ReviewPicker({
    view,
    picker,
    current,
    search,
    setSearch,
    noun,
    listed,
    url,
}: Pick<
    TimetableReviewModel,
    | 'view'
    | 'picker'
    | 'current'
    | 'search'
    | 'setSearch'
    | 'noun'
    | 'listed'
    | 'url'
>) {
    return (
        <div className="flex shrink-0 flex-col gap-[10px] xl:w-[220px]">
            <div className="flex rounded-md bg-surface p-[3px]">
                {VIEWS.map((option) => (
                    <Link
                        key={option.key}
                        href={url({ view: option.key })}
                        aria-current={option.key === view ? 'page' : undefined}
                        className={`flex h-7 flex-1 items-center justify-center rounded-[6px] text-[12px] leading-4 ${
                            option.key === view
                                ? 'bg-white font-semibold text-text'
                                : 'font-medium text-text-muted hover:text-text'
                        }`}
                    >
                        {t(option.label)}
                    </Link>
                ))}
            </div>
            <input
                type="search"
                aria-label={t('Find a :noun', { noun })}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('Find a :noun', { noun })}
                className="h-[34px] shrink-0 rounded-md border border-solid border-border px-[10px] text-[13px] leading-4 text-text outline-none placeholder:text-text-muted focus:border-primary"
            />
            <div className="flex max-h-[420px] flex-col gap-1 overflow-y-auto">
                {listed.map((row) => {
                    const on = row.id === current?.id;

                    return (
                        <Link
                            key={row.id}
                            href={url({ id: row.id })}
                            preserveScroll
                            aria-current={on ? 'true' : undefined}
                            className={`flex h-[34px] shrink-0 items-center justify-between gap-2 rounded-md border border-solid px-[10px] ${
                                on
                                    ? 'border-primary bg-primary-tint'
                                    : 'border-transparent hover:bg-surface'
                            }`}
                        >
                            <span
                                className={`min-w-0 truncate text-[13px] leading-4 ${on ? 'font-semibold text-primary' : 'font-medium text-text'}`}
                            >
                                {row.name}
                            </span>
                            {row.meta !== null ? (
                                <span
                                    className={`shrink-0 font-mono text-[11px] leading-[14px] ${row.clash ? 'text-danger' : row.note ? amberText : 'text-text-muted'}`}
                                >
                                    {row.meta}
                                    {row.note && ` · ${row.note}`}
                                </span>
                            ) : row.issues > 0 ? (
                                <span
                                    className={`flex h-[18px] shrink-0 items-center rounded-full px-[6px] font-mono text-[11px] leading-[14px] ${
                                        row.clash
                                            ? 'bg-danger-tint text-danger'
                                            : `bg-warning-tint ${amberText}`
                                    }`}
                                >
                                    {row.issues}
                                </span>
                            ) : (
                                <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-success" />
                            )}
                        </Link>
                    );
                })}
                {listed.length === 0 && (
                    <p className="px-[10px] py-2 text-[13px] leading-4 text-text-muted">
                        {t('No :noun matches.', { noun })}
                    </p>
                )}
            </div>
            <p className="text-[12px] leading-[17px] text-text-muted">
                {view === 'class'
                    ? t(
                          'Number = things to fix. A dot means the class is clean. :classes in all.',
                          {
                              classes: plural(
                                  picker.length,
                                  'class',
                                  'classes',
                              ),
                          },
                      )
                    : view === 'teacher'
                      ? t(
                            'Periods placed out of the most each teacher can teach. :teacher in all.',
                            {
                                teacher: plural(picker.length, 'teacher'),
                            },
                        )
                      : t('Slots used a week. :room in all.', {
                            room: plural(picker.length, 'room'),
                        })}
            </p>
        </div>
    );
}
