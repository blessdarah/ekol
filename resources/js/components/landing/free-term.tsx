import { Link } from '@inertiajs/react';
import { t } from '../../lib/i18n';

/** The closing call to start the free term or book a demo. */
export function FreeTerm() {
    return (
        <section
            className="mx-5 mb-[72px] flex flex-col gap-6 rounded-[22px] border border-solid border-brand-active bg-origin-border px-7 py-10 sm:mx-10 md:flex-row md:items-center md:justify-between lg:mx-[72px] lg:px-14 lg:py-12"
            style={{
                backgroundImage:
                    'linear-gradient(in oklab 120deg, oklab(31.7% -0.047 0.012) 0%, oklab(37.6% -0.068 0.015) 100%)',
            }}
        >
            <div className="flex flex-col gap-[10px]">
                <h2 className="font-display text-[30px] leading-9 font-extrabold tracking-[-0.03em] text-primary-soft lg:text-[38px] lg:leading-[46px]">
                    {t('Your first term is free')}
                </h2>
                <p className="text-[16px] leading-5 text-brand-detail">
                    {t(
                        'Set up in a day. Cancel any time before the second term.',
                    )}
                </p>
            </div>
            <div className="flex flex-wrap gap-3">
                <Link
                    href="/register"
                    className="flex h-[50px] items-center rounded-[10px] bg-brand-accent px-6 text-[15px] leading-[18px] font-bold text-brand-bg hover:bg-success-on-dark"
                >
                    {t('Start free term')}
                </Link>
                <a
                    href="#demo"
                    className="flex h-[50px] items-center rounded-[10px] border border-solid border-brand-accent px-6 text-[15px] leading-[18px] font-semibold text-primary-soft hover:bg-brand-highlight"
                >
                    {t('Book a demo')}
                </a>
            </div>
        </section>
    );
}
