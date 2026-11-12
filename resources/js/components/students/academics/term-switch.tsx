import { Link } from '@inertiajs/react';
import { show } from '@/actions/App/Http/Controllers/StudentAcademicsController';
import { t } from '../../../lib/i18n';
import { type StudentAcademics } from './model';

/** The terms of the year, when there is more than one. */
export function TermSwitch({ academics }: { academics: StudentAcademics }) {
    const { student, terms, term } = academics;

    return (
        <div className="flex flex-wrap gap-2">
            {terms.map((option) => (
                <Link
                    key={option.id}
                    href={show.url(student.id, {
                        query: { term: option.id },
                    })}
                    preserveScroll
                    aria-current={option.id === term?.id ? 'true' : undefined}
                    className={`flex h-[30px] items-center rounded-full border border-solid px-3 text-[13px] leading-4 ${
                        option.id === term?.id
                            ? 'border-primary bg-primary-tint font-semibold text-primary'
                            : 'border-border font-medium text-text hover:bg-surface'
                    }`}
                >
                    {t(option.label)}
                </Link>
            ))}
        </div>
    );
}
