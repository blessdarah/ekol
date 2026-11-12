/**
 * Pick the form of a plural line for a count, the way Laravel's
 * `trans_choice` does: `'{0} No days|{1} :count day|[2,*] :count days'`.
 * A form may carry an exact count (`{1}`) or a range (`[2,*]`, `[*,5]`,
 * `[2,5]`). With no condition matching, the forms are taken in order
 * by the language's plural rule: "one" first, then "other".
 */
export function choosePlural(
    line: string,
    count: number,
    locale: string,
): string {
    const forms = line.split('|');

    for (const form of forms) {
        const chosen = matchCondition(form, count);

        if (chosen !== null) {
            return chosen;
        }
    }

    const plain = forms.map((form) => form.replace(CONDITION, ''));

    return plain[pluralIndex(locale, count)] ?? plain[0];
}

const CONDITION = /^\s*[{[]([^[\]{}]*)[}\]]\s?/;

function matchCondition(form: string, count: number): string | null {
    const found = CONDITION.exec(form);

    if (!found) {
        return null;
    }

    const condition = found[1].trim();
    const value = form.slice(found[0].length);

    if (condition.includes(',')) {
        const [from, to] = condition.split(',', 2).map((part) => part.trim());

        if (to === '*' && count >= Number(from)) {
            return value;
        }

        if (from === '*' && count <= Number(to)) {
            return value;
        }

        return count >= Number(from) && count <= Number(to) ? value : null;
    }

    return condition === String(count) ? value : null;
}

/** French says "0 jour" and "1 jour"; English says "0 days". */
function pluralIndex(locale: string, count: number): number {
    if (locale === 'fr') {
        return count === 0 || count === 1 ? 0 : 1;
    }

    return count === 1 ? 0 : 1;
}
