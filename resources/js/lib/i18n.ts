import { usePage } from '@inertiajs/react';
import { useCallback } from 'react';
import fr from '../../../lang/fr.json';

/**
 * Text is written in English in the code and looked up here by that
 * English text, the way Laravel's JSON translations work. A string
 * with no entry is shown as written, so pages can be translated one
 * at a time.
 */
const DICTIONARIES: Record<string, Record<string, string>> = { fr };

type Replace = Record<string, unknown>;

export type Translate = (text: string, replace?: Replace) => string;

/** The language of the page being rendered; the layouts keep it current. */
let current = 'en';

export function currentLocale(): string {
    return current;
}

export function translate(
    locale: string,
    text: string,
    replace?: Replace,
): string {
    let line = DICTIONARIES[locale]?.[text] ?? text;

    // Longest names first, so ":count" never eats the start of ":count_b".
    for (const key of Object.keys(replace ?? {}).sort(
        (a, b) => b.length - a.length,
    )) {
        line = line.replaceAll(`:${key}`, String(replace?.[key] ?? ''));
    }

    return line;
}

/**
 * Translate a line into the language of the page being rendered:
 * `t('Sign in')`, or `t('Bill :count now', { count })`. Anything that
 * is not text (a missing label, an icon) comes back untouched.
 */
export function t<T>(
    text: T,
    replace?: Replace,
): T extends string ? string : T {
    return (
        typeof text === 'string' ? translate(current, text, replace) : text
    ) as T extends string ? string : T;
}

/** The locale to format numbers in: "60,000" in English, "60 000" in French. */
export function numberLocale(): string {
    return current === 'fr' ? 'fr-FR' : 'en-US';
}

/** "1st", "2nd"; in French "1er", then "2e". */
export function ordinalOf(position: number): string {
    if (current === 'fr') {
        return position === 1 ? '1er' : `${position}e`;
    }

    const tail = position % 100;
    const suffix =
        tail >= 11 && tail <= 13
            ? 'th'
            : (['th', 'st', 'nd', 'rd'][position % 10] ?? 'th');

    return `${position}${suffix}`;
}

/** The language the page is being read in. */
export function useLocale(): string {
    const locale = usePage().props.locale;

    current = typeof locale === 'string' ? locale : 'en';

    return current;
}

/** The same as `t`, for a component that should re-read the language itself. */
export function useT(): Translate {
    const locale = useLocale();

    return useCallback(
        (text, replace) => translate(locale, text, replace),
        [locale],
    );
}
