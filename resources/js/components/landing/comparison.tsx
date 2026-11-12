import { t } from '../../lib/i18n';
import { COMPARISON, gutter, sectionTitle } from './model';

/** Each term today, against each term with Campus. */
export function Comparison() {
    return (
        <section
            id="compare"
            className={`flex scroll-mt-6 flex-col gap-7 pb-16 lg:pb-24 ${gutter}`}
        >
            <h2 className={sectionTitle}>
                {t('Notebooks and Excel, or Campus')}
            </h2>
            <div className="flex flex-col overflow-clip rounded-2xl border border-solid border-brand-border">
                <div className="hidden bg-brand-raised px-6 py-4 text-[13px] leading-4 font-semibold tracking-[0.06em] uppercase md:flex">
                    <span className="w-[280px] shrink-0 text-primary-muted lg:w-[360px]">
                        {t('Each term')}
                    </span>
                    <span className="flex-1 text-primary-muted">
                        {t('Today')}
                    </span>
                    <span className="flex-1 text-brand-accent">
                        {t('With Campus')}
                    </span>
                </div>
                {COMPARISON.map((row) => (
                    <div
                        key={row.what}
                        className="flex flex-col gap-2 border-t border-solid border-brand-border px-6 py-[18px] text-[15px] leading-[18px] first:border-t-0 md:flex-row md:gap-0 md:first:border-t"
                    >
                        <span className="shrink-0 font-semibold text-primary-soft md:w-[280px] lg:w-[360px]">
                            {t(row.what)}
                        </span>
                        <span className="flex-1 text-primary-muted">
                            <span className="mr-2 text-[12px] font-semibold tracking-[0.06em] uppercase md:hidden">
                                {t('Today')}
                            </span>
                            {t(row.today)}
                        </span>
                        <span className="flex-1 text-primary-soft">
                            <span className="mr-2 text-[12px] font-semibold tracking-[0.06em] text-brand-accent uppercase md:hidden">
                                {t('With Campus')}
                            </span>
                            {t(row.campus)}
                        </span>
                    </div>
                ))}
            </div>
        </section>
    );
}
