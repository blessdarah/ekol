import { t } from '../../../lib/i18n';
import { MARKS, type RegisterModel, initials } from './model';

/** One row per student: the mark, and a note when absent or late. */
export function RollList({ register }: { register: RegisterModel }) {
    const { roll, entries, rows, setFocus, focus, locked, full, set } =
        register;

    return (
        <div className="flex flex-col gap-[6px]">
            {roll.map((row, position) => {
                const entry = entries[row.student_id];
                const tone = MARKS.find((mark) => mark.key === entry.status);

                return (
                    <div
                        key={row.student_id}
                        ref={(element) => {
                            rows.current[position] = element;
                        }}
                        onClick={() => setFocus(position)}
                        className={`flex min-h-[50px] items-center gap-3 rounded-lg border border-solid px-4 py-[6px] ${
                            entry.status === 'absent'
                                ? 'border-danger-border bg-danger-faint'
                                : entry.status === 'late'
                                  ? 'border-warning-outline bg-warning-faint'
                                  : 'border-border bg-white'
                        } ${position === focus && !locked ? 'outline outline-2 outline-offset-1 outline-primary' : ''}`}
                    >
                        <span
                            className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[11px] leading-[14px] font-semibold ${tone?.avatar ?? 'bg-surface text-text-muted'}`}
                        >
                            {initials(row.name)}
                        </span>
                        <span
                            className={`min-w-0 truncate text-[14px] leading-[18px] font-semibold text-text ${full ? 'w-[240px] shrink-0' : 'flex-1'}`}
                        >
                            {row.name}
                            {row.status === 'excused' && (
                                <span className="ml-2 text-[12px] font-normal text-text-muted">
                                    {t('excused by the office')}
                                </span>
                            )}
                        </span>
                        {(full ||
                            entry.status === 'absent' ||
                            entry.status === 'late') && (
                            <input
                                type="text"
                                aria-label={t('Note for :row', {
                                    row: row.name,
                                })}
                                value={entry.note}
                                disabled={locked}
                                onChange={(e) =>
                                    set(row.student_id, {
                                        note: e.target.value,
                                    })
                                }
                                placeholder={
                                    entry.status === 'late'
                                        ? t('When they arrived')
                                        : entry.status === 'absent'
                                          ? t('Anything known')
                                          : '—'
                                }
                                className={`h-8 min-w-0 rounded-sm bg-transparent px-2 text-[13px] leading-4 text-text-muted outline-none placeholder:text-text-muted focus:bg-white focus:text-text focus:outline focus:outline-1 focus:outline-primary ${
                                    full ? 'flex-1' : 'w-[220px] shrink-0'
                                }`}
                            />
                        )}
                        <span
                            role="radiogroup"
                            aria-label={t('Mark :row', { row: row.name })}
                            className="flex shrink-0 gap-2"
                        >
                            {MARKS.map((mark) => (
                                <button
                                    key={mark.key}
                                    type="button"
                                    role="radio"
                                    aria-checked={entry.status === mark.key}
                                    aria-label={mark.key}
                                    disabled={locked}
                                    onClick={() =>
                                        set(row.student_id, {
                                            status: mark.key,
                                        })
                                    }
                                    className={`flex h-[30px] w-10 items-center justify-center rounded-md border border-solid text-[12px] leading-4 font-semibold disabled:opacity-50 ${
                                        entry.status === mark.key
                                            ? mark.on
                                            : 'border-border bg-white text-text-muted enabled:hover:bg-surface'
                                    }`}
                                >
                                    {mark.letter}
                                </button>
                            ))}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
