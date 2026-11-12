import { t } from '../../../lib/i18n';
import { ErrorText, capsLabelClass } from '../../structure/ui';
import { amberText, count } from '../ui';
import { type ClassPlacement, KINDS, type PlacementLevel } from './model';

/** The students waiting for a class, and the control to place them. */
export function WaitingList({
    classPlacement,
    level,
}: {
    classPlacement: ClassPlacement;
    level: PlacementLevel;
}) {
    const {
        waiting,
        classes,
        errors,
        selected,
        kind,
        setKind,
        setTarget,
        shown,
        targetId,
        targetClass,
        allShown,
        toggle,
        toggleAll,
        placeSelected,
    } = classPlacement;

    return (
        <div className="flex shrink-0 flex-col gap-3 lg:w-[400px]">
            <div className="flex items-baseline justify-between">
                <p className={capsLabelClass}>
                    {t('Waiting for a class · :waiting', {
                        waiting: count(waiting.length),
                    })}
                </p>
                <p className="text-[13px] leading-4 text-text-muted">
                    {t(':selected selected', {
                        selected: selected.length,
                    })}
                </p>
            </div>
            <div className="flex flex-wrap gap-[6px]">
                {[{ key: 'all' as const, label: t('All') }, ...KINDS].map(
                    (option) => {
                        const active = kind === option.key;
                        const total =
                            option.key === 'all'
                                ? null
                                : waiting.filter(
                                      (row) => row.kind === option.key,
                                  ).length;

                        return (
                            <button
                                key={option.key}
                                type="button"
                                aria-pressed={active}
                                onClick={() => setKind(option.key)}
                                className={`flex h-[26px] items-center rounded-full border border-solid px-[10px] text-[12px] leading-4 ${
                                    active
                                        ? 'border-primary bg-primary-tint font-semibold text-primary'
                                        : 'border-border text-text hover:bg-surface'
                                }`}
                            >
                                {t(option.label)}
                                {total !== null && ` · ${count(total)}`}
                            </button>
                        );
                    },
                )}
            </div>
            <div className="flex max-h-[440px] flex-col overflow-y-auto rounded-lg border border-solid border-border">
                {shown.length === 0 ? (
                    <p className="px-3 py-4 text-[13px] leading-[19px] text-text-muted">
                        {waiting.length === 0
                            ? t('Every :level student has a class.', {
                                  level: level.name,
                              })
                            : t('Nobody of this kind is waiting.')}
                    </p>
                ) : (
                    <>
                        <label className="flex h-9 shrink-0 cursor-pointer items-center gap-[10px] border-b border-solid border-border bg-surface px-3 text-[12px] leading-4 text-text-muted">
                            <input
                                type="checkbox"
                                checked={allShown}
                                onChange={toggleAll}
                                className="h-[18px] w-[18px] shrink-0 accent-primary"
                            />
                            {t('Select all')} {count(shown.length)}
                        </label>
                        {shown.map((row) => {
                            const on = selected.includes(row.id);

                            return (
                                <label
                                    key={row.id}
                                    className={`flex h-11 shrink-0 cursor-pointer items-center gap-[10px] border-b border-solid border-border px-3 last:border-b-0 ${on ? 'bg-primary-tint' : 'hover:bg-surface'}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={on}
                                        onChange={() => toggle(row.id)}
                                        className="h-[18px] w-[18px] shrink-0 accent-primary"
                                    />
                                    <span className="min-w-0 flex-1 truncate text-[14px] leading-[18px] font-medium text-text">
                                        {row.name}
                                    </span>
                                    {row.kind === 'promoted' ? (
                                        <span className="shrink-0 text-[12px] leading-4 text-text-muted">
                                            {t('From :from', {
                                                from: row.from,
                                            })}
                                        </span>
                                    ) : (
                                        <span
                                            className={`flex h-5 shrink-0 items-center rounded-sm px-[6px] text-[11px] leading-[14px] font-medium ${
                                                row.kind === 'repeating'
                                                    ? `bg-warning-tint ${amberText}`
                                                    : 'bg-science-tint text-science'
                                            }`}
                                        >
                                            {row.kind === 'repeating'
                                                ? t('Repeating :level', {
                                                      level: level.name,
                                                  })
                                                : t('New student')}
                                        </span>
                                    )}
                                </label>
                            );
                        })}
                    </>
                )}
            </div>
            <div className="flex items-center gap-2">
                <select
                    aria-label={t('Class to place in')}
                    value={targetId}
                    onChange={(e) => setTarget(e.target.value)}
                    disabled={classes.length === 0}
                    className="h-9 min-w-0 flex-1 rounded-md border border-solid border-border bg-white px-3 text-[14px] leading-[18px] text-text outline-none focus:border-primary disabled:opacity-50"
                >
                    {classes.length === 0 && (
                        <option value="">{t('No classes yet')}</option>
                    )}
                    {classes.map((option) => (
                        <option key={option.id} value={option.id}>
                            {option.name} · {option.placed} / {option.capacity}
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    disabled={selected.length === 0 || !targetClass}
                    onClick={placeSelected}
                    className="flex h-9 shrink-0 items-center rounded-md border border-solid border-primary bg-white px-4 text-[13px] leading-4 font-semibold text-primary hover:bg-primary-tint disabled:opacity-50"
                >
                    {t('Place')}{' '}
                    {selected.length > 0 ? count(selected.length) : ''}{' '}
                    {t('in class')}
                </button>
            </div>
            <ErrorText
                message={
                    errors.class_id ??
                    errors.enrolment_ids ??
                    errors.level_id ??
                    errors.class
                }
            />
        </div>
    );
}
