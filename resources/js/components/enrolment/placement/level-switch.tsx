import { Link } from '@inertiajs/react';
import { placement } from '@/actions/App/Http/Controllers/StudentPlacementController';
import { count } from '../ui';
import { type ClassPlacement, type PlacementLevel } from './model';

/** The levels with students to place, flagged when over capacity. */
export function LevelSwitch({
    classPlacement,
    level,
}: {
    classPlacement: ClassPlacement;
    level: PlacementLevel;
}) {
    const { levels } = classPlacement;

    return (
        <div className="flex flex-wrap gap-2">
            {levels.map((option) => {
                const active = option.id === level.id;

                return (
                    <Link
                        key={option.id}
                        href={placement.url({
                            query: { level: option.id },
                        })}
                        aria-current={active ? 'page' : undefined}
                        className={`flex h-8 items-center gap-[6px] rounded-full border border-solid px-[14px] text-[13px] leading-4 ${
                            active
                                ? 'border-primary bg-primary-tint font-semibold text-primary'
                                : 'border-border font-medium text-text hover:bg-surface'
                        }`}
                    >
                        {option.over && (
                            <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-danger" />
                        )}
                        {option.name}
                        {!option.over && option.waiting > 0 && (
                            <span className="font-mono text-[11px] text-text-muted">
                                {count(option.waiting)}
                            </span>
                        )}
                    </Link>
                );
            })}
        </div>
    );
}
