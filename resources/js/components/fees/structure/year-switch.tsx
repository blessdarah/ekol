import { structure } from '@/actions/App/Http/Controllers/FeeStructureController';
import { Link } from '@inertiajs/react';
import { t } from '../../../lib/i18n';
import { type FeeStructure } from './model';

/** The years whose fees can still change. */
export function YearSwitch({ fees }: { fees: FeeStructure }) {
    const { years, year } = fees;

    return (
        <div className="flex flex-wrap gap-2">
            {years.map((option) => (
                <Link
                    key={option.id}
                    href={structure.url({ query: { year: option.id } })}
                    aria-current={option.id === year.id ? 'page' : undefined}
                    className={`flex h-8 items-center gap-[6px] rounded-full border border-solid px-[14px] text-[13px] leading-4 ${
                        option.id === year.id
                            ? 'border-primary bg-primary-tint font-semibold text-primary'
                            : 'border-border font-medium text-text hover:bg-surface'
                    }`}
                >
                    {t(option.label)}
                    <span className="text-[12px] font-normal text-text-muted">
                        {option.current ? t('this year') : t('planned')}
                    </span>
                </Link>
            ))}
        </div>
    );
}
