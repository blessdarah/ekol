import { ErrorText, LockIcon } from '../../structure/ui';
import { plural } from '../ui';
import { t } from '../../../lib/i18n';
import { type TimetableReviewModel } from './model';
export function ReviewGrid({
    view,
    current,
    days,
    periods,
    cells,
    closed,
    unplaced,
    clashes,
    errors,
    dragging,
    setDragging,
    readOnly,
    noun,
    select,
    drop,
    onDrop,
    active,
    offered,
}: Pick<
    TimetableReviewModel,
    | 'view'
    | 'current'
    | 'days'
    | 'periods'
    | 'cells'
    | 'closed'
    | 'unplaced'
    | 'clashes'
    | 'errors'
    | 'dragging'
    | 'setDragging'
    | 'readOnly'
    | 'noun'
    | 'select'
    | 'drop'
    | 'onDrop'
    | 'active'
    | 'offered'
>) {
    return (
        <div className="flex min-w-0 flex-1 flex-col gap-3">
            {!current ? (
                <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                    {t('There is no :noun to show yet.', { noun })}
                </p>
            ) : (
                <>
                    <div className="flex flex-wrap items-baseline gap-x-[10px] gap-y-1">
                        <h2 className="font-display text-[22px] leading-7 font-bold text-text">
                            {t(current.title)}
                        </h2>
                        <p className="text-[13px] leading-4 text-text-muted">
                            {current.detail}
                        </p>
                    </div>

                    {unplaced.length > 0 && (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-solid border-warning bg-warning-tint px-3 py-2">
                            <p className="text-[13px] leading-[18px] text-text">
                                {t('Not placed:')}{' '}
                                {unplaced
                                    .map(
                                        (item) =>
                                            `${item.subject}, ${plural(item.count, 'lesson')}`,
                                    )
                                    .join(' · ')}
                                .
                                {readOnly
                                    ? ''
                                    : t(
                                          ' Pick one, then a free slot, or drag it onto the grid.',
                                      )}
                            </p>
                            <div className="flex flex-wrap gap-[6px]">
                                {unplaced.map((item) => (
                                    <button
                                        key={item.lesson_id}
                                        type="button"
                                        draggable={!readOnly}
                                        onDragStart={(event) => {
                                            event.dataTransfer.setData(
                                                'text/plain',
                                                `lesson:${item.lesson_id}`,
                                            );
                                            setDragging(true);
                                        }}
                                        onDragEnd={() => setDragging(false)}
                                        onClick={() =>
                                            select({
                                                lesson: item.lesson_id,
                                            })
                                        }
                                        className={`flex h-[26px] items-center rounded-sm border border-solid px-[10px] text-[12px] leading-4 font-semibold text-text ${
                                            active ===
                                            `lesson:${item.lesson_id}`
                                                ? 'border-primary bg-primary-tint'
                                                : 'border-warning bg-white'
                                        }`}
                                    >
                                        {item.subject}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {clashes.map((clash, position) => (
                        <div
                            key={`${clash.title}-${position}`}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-solid border-danger bg-danger-tint px-3 py-2"
                        >
                            <p className="text-[13px] leading-[18px] text-text">
                                {t('Clash: :title. :detail.', {
                                    title: clash.title,
                                    detail: clash.detail,
                                })}
                            </p>
                            {clash.slot_id && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        select({
                                            slot: clash.slot_id ?? undefined,
                                        })
                                    }
                                    className="text-[13px] leading-4 font-semibold text-danger hover:underline"
                                >
                                    {t('Fix it →')}
                                </button>
                            )}
                        </div>
                    ))}

                    <ErrorText message={errors.move} />

                    <div className="overflow-x-auto">
                        <div className="flex min-w-[520px] flex-col gap-1">
                            <div className="flex gap-1 pl-11">
                                {days.map((day) => (
                                    <span
                                        key={day.index}
                                        className="flex-1 text-center text-[12px] leading-4 font-semibold text-text-muted"
                                    >
                                        {day.short}
                                    </span>
                                ))}
                            </div>
                            {periods.map((period) =>
                                period.is_break ? (
                                    <div
                                        key={period.id}
                                        className="flex h-5 shrink-0 items-center pl-11"
                                    >
                                        <span className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-text-muted uppercase">
                                            {t(period.label)}
                                        </span>
                                    </div>
                                ) : (
                                    <div key={period.id} className="flex gap-1">
                                        <span className="w-10 shrink-0 truncate font-mono text-[11px] leading-[48px] text-text-muted">
                                            {t(period.label)}
                                        </span>
                                        {days.map((day) => {
                                            const key = `${day.index}|${period.id}`;
                                            const here = cells[key] ?? [];

                                            if (here.length === 0) {
                                                if (closed[key]) {
                                                    return (
                                                        <div
                                                            key={key}
                                                            className="flex h-12 min-w-0 flex-1 items-center rounded-[6px] bg-surface px-[7px] text-[11px] leading-[14px] text-text-muted"
                                                        >
                                                            {closed[key]}
                                                        </div>
                                                    );
                                                }

                                                const open = offered.has(key);

                                                return (
                                                    <button
                                                        key={key}
                                                        type="button"
                                                        disabled={
                                                            readOnly ||
                                                            (!active &&
                                                                !dragging)
                                                        }
                                                        onClick={() =>
                                                            active &&
                                                            drop(
                                                                active,
                                                                day.index,
                                                                period.id,
                                                            )
                                                        }
                                                        onDragOver={(event) =>
                                                            !readOnly &&
                                                            event.preventDefault()
                                                        }
                                                        onDrop={(event) =>
                                                            !readOnly &&
                                                            onDrop(
                                                                event,
                                                                day.index,
                                                                period.id,
                                                            )
                                                        }
                                                        className={`flex h-12 min-w-0 flex-1 items-center justify-center rounded-[6px] border border-dashed text-[11px] leading-[14px] ${
                                                            open
                                                                ? 'border-success bg-success-tint font-medium text-success'
                                                                : 'border-border text-text-muted enabled:hover:bg-surface'
                                                        }`}
                                                    >
                                                        {open
                                                            ? t('Move here')
                                                            : t('Free')}
                                                    </button>
                                                );
                                            }

                                            if (here.length > 1) {
                                                return (
                                                    <div
                                                        key={key}
                                                        className="flex h-12 min-w-0 flex-1 flex-col overflow-clip rounded-[6px] border-2 border-solid border-danger bg-danger-tint px-[5px] py-[2px]"
                                                    >
                                                        <span className="text-[10px] leading-3 font-semibold text-danger">
                                                            {t('Clash')}
                                                        </span>
                                                        {here
                                                            .slice(0, 2)
                                                            .map((cell) => (
                                                                <button
                                                                    key={
                                                                        cell.id
                                                                    }
                                                                    type="button"
                                                                    onClick={() =>
                                                                        select({
                                                                            slot: cell.id,
                                                                        })
                                                                    }
                                                                    className={`truncate text-left text-[11px] leading-[14px] text-danger hover:underline ${active === cell.id ? 'font-bold' : 'font-medium'}`}
                                                                >
                                                                    {t(
                                                                        cell.title,
                                                                    )}{' '}
                                                                    ·{' '}
                                                                    {t(
                                                                        cell.sub,
                                                                    )}
                                                                </button>
                                                            ))}
                                                    </div>
                                                );
                                            }

                                            const cell = here[0];
                                            const on = active === cell.id;

                                            return (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    draggable={!readOnly}
                                                    onDragStart={(event) => {
                                                        event.dataTransfer.setData(
                                                            'text/plain',
                                                            cell.id,
                                                        );
                                                        setDragging(true);
                                                    }}
                                                    onDragEnd={() =>
                                                        setDragging(false)
                                                    }
                                                    onClick={() =>
                                                        select({
                                                            slot: cell.id,
                                                        })
                                                    }
                                                    aria-pressed={on}
                                                    className={`relative flex h-12 min-w-0 flex-1 flex-col rounded-[6px] px-[7px] py-[5px] text-left ${
                                                        cell.clash
                                                            ? 'border-2 border-solid border-danger bg-danger-tint'
                                                            : `border-l-[3px] border-solid ${
                                                                  cell.tone ===
                                                                  'science'
                                                                      ? 'border-science bg-science-tint'
                                                                      : 'border-primary bg-primary-tint'
                                                              }`
                                                    } ${on ? 'outline outline-2 outline-offset-1 outline-text' : ''}`}
                                                >
                                                    <span
                                                        className={`w-full truncate text-[12px] leading-[15px] font-semibold ${cell.clash ? 'text-danger' : 'text-text'}`}
                                                    >
                                                        {t(cell.title)}
                                                    </span>
                                                    <span
                                                        className={`w-full truncate text-[11px] leading-[14px] ${cell.clash ? 'text-danger' : 'text-text-muted'}`}
                                                    >
                                                        {cell.clash
                                                            ? t(
                                                                  'Clash · :sub',
                                                                  {
                                                                      sub: cell.sub,
                                                                  },
                                                              )
                                                            : cell.sub}
                                                    </span>
                                                    {cell.locked && (
                                                        <span className="absolute top-[5px] right-[5px]">
                                                            <LockIcon
                                                                size={10}
                                                            />
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ),
                            )}
                        </div>
                    </div>
                    <p className="text-[12px] leading-[17px] text-text-muted">
                        {view === 'class'
                            ? t(
                                  'Each box is the subject, the teacher and the room.',
                              )
                            : view === 'teacher'
                              ? t(
                                    'Each box is the class taught and the room. A grey box is a time this teacher does not work, taken from the staff record.',
                                )
                              : t(
                                    'Each box is the lesson and the class using the room. Grey is a time the room is closed, set on the Rooms screen.',
                                )}
                        {!readOnly &&
                            t(
                                ' Drag a lesson onto a free slot, or pick it and choose where it goes. A padlock marks a locked lesson.',
                            )}
                    </p>
                </>
            )}
        </div>
    );
}
