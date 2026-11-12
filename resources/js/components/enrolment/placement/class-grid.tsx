import { router } from '@inertiajs/react';
import { clearClass } from '@/actions/App/Http/Controllers/StudentPlacementController';
import { t } from '../../../lib/i18n';
import { capsLabelClass } from '../../structure/ui';
import { FillBar, count } from '../ui';
import { type ClassPlacement, type PlacementLevel } from './model';

/** The level's classes with their fill; a card picks the target class. */
export function ClassGrid({
    classPlacement,
    level,
}: {
    classPlacement: ClassPlacement;
    level: PlacementLevel;
}) {
    const { enrolment, classes, selected, setTarget, targetId } =
        classPlacement;

    return (
        <>
            <p className={capsLabelClass}>
                {t(':level classes · :placed of :expected placed', {
                    level: level.name,
                    placed: count(level.placed),
                    expected: count(level.expected),
                })}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {classes.map((option) => {
                    const receiving =
                        option.id === targetId && selected.length > 0;
                    const parts = [
                        option.promoted > 0
                            ? t(':promoted promoted', {
                                  promoted: option.promoted,
                              })
                            : null,
                        option.repeating > 0
                            ? t(':repeating repeating', {
                                  repeating: option.repeating,
                              })
                            : null,
                        option.new > 0
                            ? t(':new new', { new: option.new })
                            : null,
                    ].filter(Boolean);

                    return (
                        <div
                            key={option.id}
                            className={`flex flex-col gap-[10px] rounded-lg border border-solid p-[14px] ${
                                receiving
                                    ? 'border-primary bg-primary-tint'
                                    : 'border-border'
                            }`}
                        >
                            <div className="flex items-baseline justify-between">
                                <button
                                    type="button"
                                    onClick={() => setTarget(option.id)}
                                    className="font-display text-[18px] leading-6 font-bold text-text hover:underline"
                                >
                                    {option.name}
                                </button>
                                <span className="font-mono text-[13px] leading-4 text-text">
                                    {option.placed} / {option.capacity}
                                </span>
                            </div>
                            <FillBar
                                value={option.placed}
                                max={option.capacity}
                                track={receiving ? 'bg-white' : 'bg-border'}
                            />
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-[12px] leading-4 text-text-muted">
                                    {receiving
                                        ? t(
                                              'Receiving the :selected selected',
                                              {
                                                  selected: count(
                                                      selected.length,
                                                  ),
                                              },
                                          )
                                        : parts.length > 0
                                          ? parts.join(' · ')
                                          : t('Empty')}
                                </span>
                                {option.placed > 0 && !enrolment.confirmed && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            router.post(
                                                clearClass.url(),
                                                {
                                                    class_id: option.id,
                                                },
                                                {
                                                    preserveScroll: true,
                                                },
                                            )
                                        }
                                        className="shrink-0 text-[12px] leading-4 font-medium text-primary hover:underline"
                                    >
                                        {t('Send back to waiting')}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </>
    );
}
