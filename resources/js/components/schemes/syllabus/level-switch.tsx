import { Link } from '@inertiajs/react';
import { show } from '@/actions/App/Http/Controllers/SyllabusController';
import { type SyllabusModel } from './model';

/** The levels whose syllabus can be opened. */
export function LevelSwitch({ syllabus }: { syllabus: SyllabusModel }) {
    const { levels, level } = syllabus;

    return (
        <div className="flex flex-wrap gap-2">
            {levels.map((option) => (
                <Link
                    key={option.id}
                    href={show.url({ query: { level: option.id } })}
                    preserveScroll
                    className={`flex h-8 items-center rounded-full border border-solid px-[14px] text-[13px] ${
                        option.id === level?.id
                            ? 'border-primary bg-primary-tint font-semibold text-primary'
                            : 'border-border font-medium text-text hover:bg-surface'
                    }`}
                >
                    {option.name}
                </Link>
            ))}
        </div>
    );
}
