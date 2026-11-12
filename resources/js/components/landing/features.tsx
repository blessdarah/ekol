import { t } from '../../lib/i18n';
import { FEATURES, gutter, sectionTitle } from './model';

/** What Campus does for a Cameroonian school. */
export function Features() {
    return (
        <section
            id="features"
            className={`flex scroll-mt-6 flex-col gap-4 py-16 lg:py-24 ${gutter}`}
        >
            <div className="flex flex-col gap-4 pb-7 lg:flex-row lg:items-end lg:justify-between">
                <h2 className={`${sectionTitle} max-w-[640px]`}>
                    {t('Built around how a Cameroonian school actually runs')}
                </h2>
                <p className="max-w-[420px] text-[16px] leading-[25px] text-primary-muted">
                    {t(
                        'Not adapted from a European or American product. Sequences, series, installments and WhatsApp come first.',
                    )}
                </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {FEATURES.map((feature) => (
                    <article
                        key={feature.title}
                        className="flex flex-col gap-[10px] rounded-2xl border border-solid border-brand-border bg-brand-raised p-7"
                    >
                        <p className="font-mono text-[14px] leading-[18px] text-brand-accent">
                            {feature.tag === 'Private'
                                ? t('Private')
                                : feature.tag}
                        </p>
                        <h3 className="text-[18px] leading-[22px] font-bold text-primary-soft">
                            {t(feature.title)}
                        </h3>
                        <p className="text-[15px] leading-[23px] text-primary-muted">
                            {t(feature.body)}
                        </p>
                    </article>
                ))}
            </div>
        </section>
    );
}
