import { t } from '../../lib/i18n';
import { DemoForm } from './demo-form';
import { type LandingProps, gutter } from './model';
import { Tick } from './tick';

/** The pitch, beside the demo form. */
export function Hero({ roles, sizes, dialCode }: LandingProps) {
    return (
        <section
            className={`flex flex-col gap-10 pt-14 pb-16 lg:flex-row lg:items-center lg:gap-16 lg:pt-24 lg:pb-[104px] ${gutter}`}
            style={{
                backgroundImage:
                    'radial-gradient(circle farthest-corner at 20% 0% in oklab, oklab(31.7% -0.047 0.012) 0%, oklab(19.1% -0.020 0.005) 70%)',
            }}
        >
            <div className="flex min-w-0 flex-1 flex-col gap-[26px]">
                <p className="flex items-center gap-2 font-mono text-[13px] leading-4 text-brand-accent">
                    <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-brand-accent" />
                    {t('First term free · set up with you in a day')}
                </p>
                <h1 className="font-display text-[40px] leading-[44px] font-extrabold tracking-[-0.035em] text-primary-soft lg:text-[62px] lg:leading-[64px]">
                    {t(
                        'Start the new school year without a single register book',
                    )}
                </h1>
                <p className="max-w-[560px] text-[18px] leading-7 text-primary-muted">
                    {t(
                        'Campus moves your students, marks, fees and timetable online in a day. Your first term is free, and we do the setup with you.',
                    )}
                </p>
                <ul className="flex flex-col gap-3">
                    <Tick>{t('Report cards in an afternoon, not a week')}</Tick>
                    <Tick>
                        {t('Every payment receipted, cash or mobile money')}
                    </Tick>
                    <Tick>
                        {t('Parents reached on WhatsApp, in English or French')}
                    </Tick>
                </ul>
            </div>
            <DemoForm roles={roles} sizes={sizes} dialCode={dialCode} />
        </section>
    );
}
