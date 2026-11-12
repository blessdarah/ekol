import { t } from '../../../lib/i18n';
import { GROUPS, type RoomsModel } from './model';

/** The room kinds to filter the list by, with how many of each. */
export function RoomFilters({ rooms: model }: { rooms: RoomsModel }) {
    const { rooms, group, setGroup } = model;

    return (
        <div className="flex flex-wrap gap-2">
            {GROUPS.map((option) => {
                const total = rooms.filter((room) =>
                    option.test(room.kind),
                ).length;
                const active = option.key === group;

                return (
                    <button
                        key={option.key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setGroup(option.key)}
                        className={`flex h-[30px] items-center rounded-full border border-solid px-3 text-[13px] leading-4 ${
                            active
                                ? 'border-primary bg-primary-tint font-semibold text-primary'
                                : 'border-border font-medium text-text hover:bg-surface'
                        }`}
                    >
                        {t(option.label)} · {total}
                    </button>
                );
            })}
        </div>
    );
}
