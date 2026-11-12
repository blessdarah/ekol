import { Link } from '@inertiajs/react';
import { show } from '@/actions/App/Http/Controllers/ExamScheduleController';
import { type Schedule } from './model';

/** The levels sitting the exam, flagged when one is unfinished. */
export function LevelChips({ schedule }: { schedule: Schedule }) {
    const { levels, level, plan } = schedule;

    return (
        <div className="flex flex-wrap gap-2">
            {levels.map((option) => (
                <Link
                    key={option.id}
                    href={show.url({
                        query: { plan: plan.id, level: option.id },
                    })}
                    preserveScroll
                    aria-current={option.id === level.id ? 'true' : undefined}
                    className={`flex h-[30px] items-center gap-[6px] rounded-full border border-solid px-3 text-[13px] leading-4 ${
                        option.id === level.id
                            ? 'border-primary bg-primary-tint font-semibold text-primary'
                            : 'border-border font-medium text-text hover:bg-surface'
                    }`}
                >
                    {(option.clash || option.missing > 0) && (
                        <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-warning" />
                    )}
                    {option.name}
                </Link>
            ))}
        </div>
    );
}
