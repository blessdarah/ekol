import { t } from '../../lib/i18n';
import { dayMonth } from '../fees/ui';
import type { DashboardProps } from './model';
import { Segmented } from './parts';

/**
 * The greeting, the school in figures, and where the term stands, with
 * the switch between this term and this year.
 */
export function DashboardHeader({
    props,
    hasRanges,
    onRange,
}: {
    props: DashboardProps;
    hasRanges: boolean;
    onRange: (range: 'term' | 'year') => void;
}) {
    const {
        date,
        greeting,
        name,
        schoolName,
        range = 'term',
        term,
        counts,
    } = props;

    return (
        <header className="flex flex-wrap items-end justify-between gap-x-12 gap-y-6 border-b border-solid border-border pb-7">
            <div className="flex min-w-0 flex-col gap-2">
                <p className="text-[13px] leading-4 text-text-muted">{date}</p>
                <h1 className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text sm:text-[32px] sm:leading-9">
                    {t(':greeting, :name', {
                        greeting: t(greeting ?? 'Good morning'),
                        name: name ?? '',
                    })}
                </h1>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] leading-5 text-text-muted">
                    <span className="font-semibold text-text">
                        {schoolName}
                    </span>
                    {[
                        { count: counts?.students ?? 0, label: t('students') },
                        { count: counts?.classes ?? 0, label: t('classes') },
                        { count: counts?.staff ?? 0, label: t('staff') },
                    ].map((fact) => (
                        <span key={fact.label}>
                            <span className="text-text-disabled" aria-hidden>
                                ·{' '}
                            </span>
                            <span className="font-mono text-text">
                                {fact.count}
                            </span>{' '}
                            {fact.label}
                        </span>
                    ))}
                </p>
            </div>
            <div className="flex flex-col gap-3 sm:items-end">
                {term && (
                    <div className="flex flex-col gap-2 sm:items-end">
                        <p className="flex items-baseline gap-2 text-[13px] leading-4">
                            <span className="font-mono tracking-[0.04em] text-text-muted uppercase">
                                {t(term.label)}
                            </span>
                            {term.week && (
                                <span className="font-semibold text-text">
                                    {t('Week :week of :weeks', {
                                        week: term.week,
                                        weeks: term.weeks,
                                    })}
                                </span>
                            )}
                        </p>
                        {term.week && (
                            <span
                                className="flex items-center gap-[3px]"
                                aria-hidden
                            >
                                {Array.from(
                                    { length: term.weeks },
                                    (_, position) => (
                                        <span
                                            key={position}
                                            className={`w-[14px] rounded-[3px] ${position < (term.week ?? 0) ? 'bg-primary' : 'bg-border'} ${position + 1 === term.week ? 'h-[10px]' : 'h-[6px]'}`}
                                        />
                                    ),
                                )}
                            </span>
                        )}
                        <p className="text-[12px] leading-4 text-text-muted">
                            {term.week && term.weeks - term.week > 0
                                ? t(':count weeks to go · ends :date', {
                                      count: term.weeks - term.week,
                                      date: dayMonth(term.ends_on, false),
                                  })
                                : t('ends :date', {
                                      date: dayMonth(term.ends_on, false),
                                  })}
                        </p>
                    </div>
                )}
                {hasRanges && (
                    <Segmented
                        small
                        options={[
                            { value: 'term', label: t('This term') },
                            { value: 'year', label: t('This year') },
                        ]}
                        value={range}
                        onChange={onRange}
                    />
                )}
            </div>
        </header>
    );
}
