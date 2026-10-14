import { ChipPicker, RemoveIcon, fieldLabelClass } from '../structure/ui';
import { t } from '../../lib/i18n';

export interface LevelOption {
    id: string;
    name: string;
    code: string | null;
}

export interface ClassOption {
    id: string;
    name: string;
    level_id: string;
    students: number;
}

export interface StaffOption {
    id: string;
    name: string;
}

/** Ticked classes only, keyed by class id. */
export type Assignments = Record<
    string,
    { staff_id: string; weekly_periods: string }
>;

export function toRows(assignments: Assignments) {
    return Object.entries(assignments).map(([classId, row]) => ({
        class_id: classId,
        staff_id: row.staff_id || null,
        weekly_periods: Number(row.weekly_periods) || 0,
    }));
}

export function totalPeriods(assignments: Assignments): number {
    return Object.values(assignments).reduce(
        (sum, row) => sum + (Number(row.weekly_periods) || 0),
        0,
    );
}

export function unstaffedCount(assignments: Assignments): number {
    return Object.values(assignments).filter((row) => !row.staff_id).length;
}

export function LevelPicker({
    levels,
    value,
    onChange,
}: {
    levels: LevelOption[];
    value: string[];
    onChange: (next: string[]) => void;
}) {
    return (
        <div className="flex flex-col gap-2">
            <span className={fieldLabelClass}>{t('Levels')}</span>
            <ChipPicker
                label={t('Add a level')}
                addLabel={t('Add a level')}
                chosen={value.length}
                summary={t(':value of :levels levels', {
                    value: value.length,
                    levels: levels.length,
                })}
                options={levels.filter((level) => !value.includes(level.id))}
                onAdd={(id) => onChange([...value, id])}
            >
                {levels
                    .filter((level) => value.includes(level.id))
                    .map((level) => (
                        <span
                            key={level.id}
                            className="flex h-6 items-center gap-[6px] rounded-sm bg-primary-tint pr-2 pl-[10px] text-[13px] leading-4 font-medium text-primary"
                        >
                            {level.name}
                            <button
                                type="button"
                                aria-label={t('Remove :level', {
                                    level: level.name,
                                })}
                                onClick={() =>
                                    onChange(
                                        value.filter((id) => id !== level.id),
                                    )
                                }
                            >
                                <RemoveIcon tone="#0E4D3A" />
                            </button>
                        </span>
                    ))}
            </ChipPicker>
        </div>
    );
}

const cellInputClass =
    'h-[30px] rounded-md border border-solid border-border bg-white px-[10px] text-[14px] leading-[18px] text-text outline-none focus:border-primary';

export function ClassTable({
    classes,
    staff,
    value,
    defaultPeriods,
    onChange,
}: {
    classes: ClassOption[];
    staff: StaffOption[];
    value: Assignments;
    defaultPeriods: number;
    onChange: (next: Assignments) => void;
}) {
    const selected = classes.filter((option) => value[option.id]);

    function toggle(classId: string) {
        const next = { ...value };

        if (next[classId]) {
            delete next[classId];
        } else {
            next[classId] = {
                staff_id: '',
                weekly_periods: String(defaultPeriods),
            };
        }

        onChange(next);
    }

    function patch(
        classId: string,
        change: Partial<{ staff_id: string; weekly_periods: string }>,
    ) {
        onChange({ ...value, [classId]: { ...value[classId], ...change } });
    }

    if (classes.length === 0) {
        return (
            <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                {t(
                    'Pick at least one level that has classes. Classes are added under Levels.',
                )}
            </p>
        );
    }

    return (
        <div className="flex flex-col overflow-clip rounded-md border border-solid border-border">
            <div className="flex h-8 shrink-0 items-center gap-3 bg-surface px-3 text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase">
                <span className="w-[18px] shrink-0" />
                <span className="w-[190px] shrink-0">{t('Class')}</span>
                <span className="flex-1">{t('Teacher')}</span>
                <span className="w-32 shrink-0">{t('Weekly periods')}</span>
            </div>
            {classes.map((option) => {
                const row = value[option.id];

                return (
                    <div
                        key={option.id}
                        className={`flex h-10 shrink-0 items-center gap-3 border-t border-solid border-border px-3 ${row ? '' : 'bg-row-alt'}`}
                    >
                        <input
                            type="checkbox"
                            aria-label={t(':option takes this subject', {
                                option: option.name,
                            })}
                            checked={!!row}
                            onChange={() => toggle(option.id)}
                            className="h-[18px] w-[18px] shrink-0 accent-primary"
                        />
                        <span className="flex w-[190px] shrink-0 items-baseline gap-2">
                            <span
                                className={`truncate text-[14px] leading-[18px] font-medium ${row ? 'text-text' : 'text-text-muted'}`}
                            >
                                {option.name}
                            </span>
                            <span className="font-mono text-[12px] leading-4 text-text-muted">
                                {option.students}
                            </span>
                        </span>
                        {row ? (
                            <>
                                <select
                                    aria-label={t('Teacher for :option', {
                                        option: option.name,
                                    })}
                                    value={row.staff_id}
                                    onChange={(e) =>
                                        patch(option.id, {
                                            staff_id: e.target.value,
                                        })
                                    }
                                    className={`${cellInputClass} min-w-0 flex-1 ${
                                        row.staff_id
                                            ? ''
                                            : 'border-warning bg-warning-tint text-[#8A5A12]'
                                    }`}
                                >
                                    <option value="">
                                        {t('Select a teacher')}
                                    </option>
                                    {staff.map((member) => (
                                        <option
                                            key={member.id}
                                            value={member.id}
                                        >
                                            {member.name}
                                        </option>
                                    ))}
                                </select>
                                <label
                                    className={`${cellInputClass} flex w-32 shrink-0 items-center justify-between focus-within:border-primary`}
                                >
                                    <input
                                        type="number"
                                        min={1}
                                        max={20}
                                        aria-label={t(
                                            'Weekly periods for :option',
                                            { option: option.name },
                                        )}
                                        value={row.weekly_periods}
                                        onChange={(e) =>
                                            patch(option.id, {
                                                weekly_periods: e.target.value,
                                            })
                                        }
                                        className="w-10 bg-transparent font-mono outline-none"
                                    />
                                    <span className="text-[12px] leading-4 text-text-muted">
                                        {t('per week')}
                                    </span>
                                </label>
                            </>
                        ) : (
                            <>
                                <span
                                    className={`${cellInputClass} flex min-w-0 flex-1 items-center text-text-muted opacity-[0.64]`}
                                >
                                    {t('Not offered in this class')}
                                </span>
                                <span
                                    className={`${cellInputClass} flex w-32 shrink-0 items-center font-mono text-text-muted opacity-[0.64]`}
                                >
                                    0
                                </span>
                            </>
                        )}
                    </div>
                );
            })}
            <div className="flex h-9 shrink-0 items-center justify-between border-t border-solid border-border bg-surface px-3">
                <span className="flex items-center gap-[6px] text-[13px] leading-4 text-text-muted">
                    {unstaffedCount(value) > 0 && (
                        <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-warning" />
                    )}
                    {unstaffedCount(value) > 0
                        ? t(':value :need a teacher', {
                              value: unstaffedCount(value),
                              need:
                                  unstaffedCount(value) === 1
                                      ? 'class needs'
                                      : 'classes need',
                          })
                        : t(':selected of :classes classes selected', {
                              selected: selected.length,
                              classes: classes.length,
                          })}
                </span>
                <span className="flex items-baseline gap-[6px]">
                    <span className="font-mono text-[13px] leading-4 text-text">
                        {t(':value periods', { value: totalPeriods(value) })}
                    </span>
                    <span className="text-[13px] leading-4 text-text-muted">
                        {t('per week in total')}
                    </span>
                </span>
            </div>
        </div>
    );
}
