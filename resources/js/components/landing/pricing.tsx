import { t } from '../../lib/i18n';
import { PLANS } from './model';

/** The plans and what each costs a term. */
export function Pricing() {
    return (
        <div
            id="pricing"
            className="flex shrink-0 scroll-mt-6 flex-col gap-4 lg:w-[560px]"
        >
            <h2 className="font-display text-[32px] leading-9 font-extrabold tracking-[-0.03em] text-primary-soft lg:text-[40px] lg:leading-[44px]">
                {t('Simple pricing, per term')}
            </h2>
            <p className="text-[16px] leading-5 text-primary-muted">
                {t('First term free. No card needed to start.')}
            </p>
            {PLANS.map((plan) => (
                <div
                    key={plan.name}
                    className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[14px] border border-solid px-[22px] py-5 ${
                        plan.featured
                            ? 'border-brand-accent bg-brand-highlight'
                            : 'border-brand-border bg-brand-raised'
                    }`}
                >
                    <div className="flex flex-col gap-1">
                        <p
                            className={`text-[17px] leading-[22px] font-bold ${plan.featured ? 'text-brand-accent' : 'text-primary-soft'}`}
                        >
                            {t(plan.name)}
                        </p>
                        <p className="text-[13px] leading-4 text-primary-muted">
                            {t(plan.detail)}
                        </p>
                    </div>
                    <p
                        className={`font-display text-[24px] leading-[30px] font-extrabold ${plan.quote ? 'text-primary-soft' : 'text-primary-muted'}`}
                    >
                        {t(plan.price)}
                    </p>
                </div>
            ))}
            <p className="text-[12px] leading-4 text-brand-muted">
                {t('Sample prices for the design.')}
            </p>
        </div>
    );
}
