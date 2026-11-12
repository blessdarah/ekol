import { Link } from '@inertiajs/react';
import { switchLocale } from '../shell/language-switch';
import { t } from '../../lib/i18n';
import { type LandingModel, gutter } from './model';

/** The brand, section links, language switch and sign-in. */
export function SiteHeader({ landing }: { landing: LandingModel }) {
    const { locale, locales } = landing;

    return (
        <header
            className={`flex h-[68px] items-center justify-between gap-4 border-b border-solid border-brand-surface ${gutter}`}
        >
            <Link href="/" className="flex shrink-0 items-center gap-[10px]">
                <span className="h-[26px] w-[26px] shrink-0 rounded-[7px] bg-brand-accent" />
                <span className="font-display text-[19px] leading-6 font-extrabold text-primary-soft">
                    Campus
                </span>
            </Link>
            <nav
                aria-label={t('Sections')}
                className="hidden gap-7 text-[14px] leading-[18px] text-primary-muted md:flex"
            >
                <a href="#features" className="hover:text-primary-soft">
                    {t('Features')}
                </a>
                <a href="#compare" className="hover:text-primary-soft">
                    {t('Compare')}
                </a>
                <a href="#pricing" className="hover:text-primary-soft">
                    {t('Pricing')}
                </a>
                <a href="#faq" className="hover:text-primary-soft">
                    {t('FAQ')}
                </a>
            </nav>
            <div className="flex items-center gap-[10px]">
                <div
                    role="group"
                    aria-label={t('Language')}
                    className="flex items-center gap-1"
                >
                    {Object.entries(locales).map(([code, name]) => (
                        <button
                            key={code}
                            type="button"
                            lang={code}
                            title={name}
                            aria-pressed={code === locale}
                            onClick={() =>
                                code !== locale && switchLocale(code)
                            }
                            className={`flex h-7 min-w-8 items-center justify-center rounded-md px-[6px] font-mono text-[12px] leading-4 uppercase ${
                                code === locale
                                    ? 'bg-brand-highlight text-brand-accent'
                                    : 'text-primary-muted hover:text-primary-soft'
                            }`}
                        >
                            {code}
                        </button>
                    ))}
                </div>
                <Link
                    href="/parents"
                    className="hidden px-[10px] text-[14px] leading-[18px] text-primary-soft hover:underline sm:block"
                >
                    {t('Parents')}
                </Link>
                <Link
                    href="/login"
                    className="hidden px-[10px] text-[14px] leading-[18px] text-primary-soft hover:underline sm:block"
                >
                    {t('Sign in')}
                </Link>
                <a
                    href="#demo"
                    className="flex h-9 shrink-0 items-center rounded-md bg-brand-accent px-4 text-[14px] leading-[18px] font-semibold text-brand-bg hover:bg-success-on-dark"
                >
                    {t('Book a demo')}
                </a>
            </div>
        </header>
    );
}
