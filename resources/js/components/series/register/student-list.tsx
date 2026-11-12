import { t } from '../../../lib/i18n';
import { TableToolbar } from '../../table/ui';
import { type RegisterOne } from './model';

/** The level's students to register, by tab, with a search. */
export function StudentList({ registration }: { registration: RegisterOne }) {
    const { level, counts, tab, students, student, table, visit } =
        registration;

    return (
        <aside className="flex shrink-0 flex-col border-solid border-border lg:-my-7 lg:-ml-10 lg:w-[300px] lg:border-r">
            <div className="flex flex-col gap-[14px] border-b border-solid border-border px-5 pt-7 pb-4">
                <div className="flex items-baseline justify-between">
                    <h2 className="font-display text-[20px] leading-6 font-bold tracking-[-0.01em] text-text">
                        {level.name}
                    </h2>
                    <span className="text-[13px] leading-4 text-text-muted">
                        {t(':total students', { total: counts.total })}
                    </span>
                </div>
                <div className="flex rounded-md bg-surface p-[3px]">
                    {[
                        {
                            value: 'unassigned',
                            label: t('Unassigned · :unassigned', {
                                unassigned: counts.unassigned,
                            }),
                        },
                        { value: 'registered', label: t('Registered') },
                    ].map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            aria-pressed={tab === option.value}
                            onClick={() => visit({ tab: option.value })}
                            className={`flex h-7 flex-1 items-center justify-center rounded-[6px] text-[13px] leading-4 ${
                                tab === option.value
                                    ? 'bg-white font-semibold text-text shadow-[0_1px_2px_color-mix(in_srgb,var(--color-text)_8%,transparent)]'
                                    : 'font-medium text-text-muted hover:text-text'
                            }`}
                        >
                            {t(option.label)}
                        </button>
                    ))}
                </div>
                <TableToolbar
                    searchLabel={t('Search students')}
                    searchPlaceholder={t('Search by name or matricule')}
                    search={table.search}
                    onSearch={table.onSearch}
                />
            </div>
            <ul className="flex max-h-[60vh] flex-col gap-[2px] overflow-y-auto p-2 lg:max-h-none lg:flex-1">
                {students.length === 0 && (
                    <li className="px-3 py-4 text-[13px] leading-[19px] text-text-muted">
                        {tab === 'unassigned'
                            ? t('Nobody in :level is waiting for a series.', {
                                  level: level.name,
                              })
                            : t('Nobody is registered yet.')}
                    </li>
                )}
                {students.map((item) => {
                    const selected = item.id === student?.id;

                    return (
                        <li key={item.id}>
                            <button
                                type="button"
                                aria-current={selected ? 'true' : undefined}
                                onClick={() => visit({ student: item.id })}
                                className={`flex w-full items-center gap-[10px] rounded-md px-3 py-[10px] text-left ${selected ? 'bg-primary-tint' : 'hover:bg-surface'}`}
                            >
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span
                                        className={`truncate text-[14px] leading-[18px] text-text ${selected ? 'font-semibold' : 'font-medium'}`}
                                    >
                                        {item.name}
                                    </span>
                                    <span className="font-mono text-[11px] leading-[14px] text-text-muted">
                                        {item.matricule}
                                    </span>
                                </span>
                                {selected && (
                                    <svg
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        className="shrink-0"
                                    >
                                        <path
                                            d="M9 6l6 6-6 6"
                                            fill="none"
                                            stroke="var(--color-primary)"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                )}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </aside>
    );
}
