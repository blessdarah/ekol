import { Link } from '@inertiajs/react';
import { t } from '../../lib/i18n';
import { gutter } from './model';

/** The footer links. */
export function SiteFooter() {
    return (
        <footer
            className={`flex flex-wrap justify-between gap-4 border-t border-solid border-brand-surface pt-7 pb-10 text-[14px] leading-[18px] text-brand-muted ${gutter}`}
        >
            <p>{t('© Campus · school management for Cameroon')}</p>
            <nav aria-label={t('Footer')} className="flex gap-7">
                <a href="#features" className="hover:text-primary-muted">
                    {t('Features')}
                </a>
                <a href="#pricing" className="hover:text-primary-muted">
                    {t('Pricing')}
                </a>
                <Link href="/parents" className="hover:text-primary-muted">
                    {t('Parent services')}
                </Link>
                <Link href="/login" className="hover:text-primary-muted">
                    {t('Sign in')}
                </Link>
            </nav>
        </footer>
    );
}
