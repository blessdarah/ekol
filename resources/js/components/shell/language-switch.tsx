import { router, usePage } from '@inertiajs/react';
import { update } from '@/actions/App/Http/Controllers/LocaleController';
import { useLocale, useT } from '../../lib/i18n';

/** Send the reader's choice of language and reload the page in it. */
export function switchLocale(locale: string) {
    router.post(update.url(), { locale }, { preserveState: true, preserveScroll: true });
}

/**
 * A pair of small buttons, one per language the app can be read in.
 */
export default function LanguageSwitch({ className = '' }: { className?: string }) {
    const t = useT();
    const current = useLocale();
    const locales = (usePage().props.locales ?? {}) as Record<string, string>;

    return (
        <div role="group" aria-label={t('Language')} className={`flex items-center gap-1 ${className}`}>
            {Object.entries(locales).map(([code, name]) => (
                <button
                    key={code}
                    type="button"
                    lang={code}
                    title={name}
                    aria-pressed={code === current}
                    onClick={() => code !== current && switchLocale(code)}
                    className={`flex h-7 min-w-9 items-center justify-center rounded-md border border-solid px-2 font-mono text-[12px] leading-4 uppercase ${
                        code === current
                            ? 'border-primary bg-primary-tint font-medium text-primary'
                            : 'border-border bg-white text-text-muted hover:text-text'
                    }`}
                >
                    {code}
                </button>
            ))}
        </div>
    );
}
