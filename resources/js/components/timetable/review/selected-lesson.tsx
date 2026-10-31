import { router } from '@inertiajs/react';
import { destroy as removeSlot } from '@/actions/App/Http/Controllers/TimetableSlotController';
import { capsLabelClass } from '../../structure/ui';
import { TickBox, amberText, linkClass, plural } from '../ui';
import { t } from '../../../lib/i18n';
import { type TimetableReviewModel, Moves, visitOptions } from './model';
export function SelectedLesson({
    selected,
    readOnly,
    change,
    drop,
}: Pick<TimetableReviewModel, 'selected' | 'readOnly' | 'change' | 'drop'>) {
    return (
        <aside className="flex shrink-0 flex-col gap-3 border-solid border-border xl:w-[290px] xl:border-l xl:pl-5">
            <p className={capsLabelClass}>{t('Selected lesson')}</p>
            {!selected ? (
                <p className="text-[13px] leading-[19px] text-text-muted">
                    {t(
                        'Pick a lesson on the grid to see who teaches it, where, and',
                    )}{' '}
                    {readOnly ? t('when') : t('where it can move')}.
                </p>
            ) : selected.type === 'lesson' ? (
                <>
                    <div className="flex flex-col gap-1">
                        <p className="font-display text-[18px] leading-6 font-bold text-text">
                            {t(selected.title)}
                        </p>
                        <p className="font-mono text-[12px] leading-4 text-text-muted uppercase">
                            {plural(selected.count, 'lesson')} {t('not placed')}
                            {selected.teacher ? ` · ${selected.teacher}` : ''}
                        </p>
                    </div>
                    {selected.why && (
                        <div className="flex flex-col gap-[6px] rounded-md bg-warning-tint px-3 py-[10px]">
                            <p
                                className={`text-[13px] leading-4 font-semibold ${amberText}`}
                            >
                                {t('Why it is not placed')}
                            </p>
                            <p className="text-[13px] leading-[18px] text-text">
                                {selected.why}.
                            </p>
                        </div>
                    )}
                    <Moves
                        title={t('Place it in a free slot')}
                        moves={selected.moves}
                        empty={t(
                            'No slot has the class, the teacher and a room all free. Move another lesson first, or change the teacher on the subject.',
                        )}
                        onPick={(move) =>
                            drop(
                                `lesson:${selected.id}`,
                                move.weekday,
                                move.period_id,
                            )
                        }
                    />
                </>
            ) : (
                <>
                    <div className="flex flex-col gap-1">
                        <p className="font-display text-[18px] leading-6 font-bold text-text">
                            {t(selected.title)}
                        </p>
                        <p className="font-mono text-[12px] leading-4 text-text-muted">
                            {selected.when}
                        </p>
                    </div>
                    {selected.problems.map((problem) => (
                        <div
                            key={problem.text}
                            className="flex flex-col gap-[6px] rounded-md bg-danger-tint px-3 py-[10px]"
                        >
                            <p className="text-[13px] leading-4 font-semibold text-danger">
                                {t(problem.title)}
                            </p>
                            <p className="text-[13px] leading-[18px] text-text">
                                {t(problem.text)}
                            </p>
                        </div>
                    ))}
                    <div className="flex flex-col border-t border-solid border-border">
                        <label className="flex items-center justify-between gap-3 border-b border-solid border-border py-[6px]">
                            <span className="text-[13px] leading-4 text-text-muted">
                                {t('Teacher')}
                            </span>
                            {readOnly ? (
                                <span className="py-[6px] text-[13px] leading-4 text-text">
                                    {selected.teacher ?? t('None')}
                                </span>
                            ) : (
                                <select
                                    value={selected.teacher_id ?? ''}
                                    onChange={(e) =>
                                        change(selected.id, {
                                            staff_id: e.target.value || null,
                                        })
                                    }
                                    className="h-7 max-w-[170px] rounded-sm bg-transparent text-right text-[13px] leading-4 text-text outline-none focus:bg-surface"
                                >
                                    {selected.teachers.map((teacher) => (
                                        <option
                                            key={teacher.id}
                                            value={teacher.id}
                                            disabled={
                                                !teacher.free &&
                                                teacher.id !==
                                                    selected.teacher_id
                                            }
                                        >
                                            {teacher.name}
                                            {!teacher.free &&
                                            teacher.id !== selected.teacher_id
                                                ? t(' (busy)')
                                                : ''}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </label>
                        <label className="flex items-center justify-between gap-3 border-b border-solid border-border py-[6px]">
                            <span className="text-[13px] leading-4 text-text-muted">
                                {t('Room')}
                            </span>
                            {readOnly ? (
                                <span className="py-[6px] text-[13px] leading-4 text-text">
                                    {selected.room ?? t('None')}
                                </span>
                            ) : (
                                <select
                                    value={selected.room_id ?? ''}
                                    onChange={(e) =>
                                        change(selected.id, {
                                            room_id: e.target.value || null,
                                        })
                                    }
                                    className="h-7 max-w-[170px] rounded-sm bg-transparent text-right text-[13px] leading-4 text-text outline-none focus:bg-surface"
                                >
                                    <option value="">{t('No room')}</option>
                                    {selected.rooms.map((room) => (
                                        <option key={room.id} value={room.id}>
                                            {room.code}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </label>
                    </div>
                    {!readOnly && (
                        <>
                            <Moves
                                title={t('Move to a free slot')}
                                moves={selected.moves}
                                empty={t(
                                    'No other slot has the class, the teacher and the room all free.',
                                )}
                                onPick={(move) =>
                                    change(selected.id, {
                                        weekday: move.weekday,
                                        period_id: move.period_id,
                                    })
                                }
                            />
                            <TickBox
                                checked={selected.locked}
                                onChange={(next) =>
                                    change(selected.id, {
                                        is_locked: next,
                                    })
                                }
                            >
                                {t(
                                    'Lock this lesson. Generate again keeps it.',
                                )}
                            </TickBox>
                            <button
                                type="button"
                                onClick={() =>
                                    router.delete(
                                        removeSlot.url(selected.id),
                                        visitOptions,
                                    )
                                }
                                className={`self-start ${linkClass}`}
                            >
                                {t('Take it off the timetable')}
                            </button>
                            <p className="text-[12px] leading-[17px] text-text-muted">
                                {t(
                                    'A move is only offered where the class, the teacher and the room are all free.',
                                )}
                            </p>
                        </>
                    )}
                </>
            )}
        </aside>
    );
}
