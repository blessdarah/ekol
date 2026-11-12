import { Head } from '@inertiajs/react';
import { Comparison } from '../components/landing/comparison';
import { Faq } from '../components/landing/faq';
import { Features } from '../components/landing/features';
import { FreeTerm } from '../components/landing/free-term';
import { Hero } from '../components/landing/hero';
import {
    type LandingProps,
    gutter,
    useLanding,
} from '../components/landing/model';
import { Pricing } from '../components/landing/pricing';
import { SiteFooter } from '../components/landing/site-footer';
import { SiteHeader } from '../components/landing/site-header';
import Toasts from '../components/shell/toasts';
import { t } from '../lib/i18n';

export default function Landing({ roles, sizes, dialCode }: LandingProps) {
    const landing = useLanding();

    return (
        <div className="min-h-screen bg-[oklab(19.1%_-0.020_0.005)] font-auth text-primary-soft antialiased">
            <Head title={t('School management for Cameroon')} />
            <Toasts />

            <SiteHeader landing={landing} />

            <main>
                <Hero roles={roles} sizes={sizes} dialCode={dialCode} />

                <Features />

                <Comparison />

                <section
                    className={`flex flex-col gap-14 border-t border-solid border-brand-surface py-16 lg:flex-row lg:py-24 ${gutter}`}
                >
                    <Pricing />
                    <Faq landing={landing} />
                </section>

                <FreeTerm />
            </main>

            <SiteFooter />
        </div>
    );
}
