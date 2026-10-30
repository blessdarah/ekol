import {
    bill,
    updateStructure,
} from '@/actions/App/Http/Controllers/FeeController';
import { router, useForm, usePage } from '@inertiajs/react';
import { t } from '../../../lib/i18n';

export interface ItemRow {
    id: string;
    name: string;
    spread: boolean;
    new_only: boolean;
    amounts: Record<string, number>;
    billed: number;
    collected: number;
}

export interface LevelRow {
    id: string;
    name: string;
    has_fee: boolean;
    students: number;
    billed: number;
}

export interface StructureProps {
    currency: string;
    years?: { id: string; label: string; current: boolean }[];
    year: { id: string; label: string; current: boolean } | null;
    previousLabel?: string | null;
    billingTerm?: string | null;
    installments?: {
        seq: number;
        label: string;
        percent: number;
        due_on: string | null;
    }[];
    items?: ItemRow[];
    previousItems?: ItemRow[];
    levels?: LevelRow[];
}

export interface ItemDraft {
    /** Stable in the browser; the server only knows `id`. */
    key: string;
    id: string | null;
    name: string;
    spread: boolean;
    new_only: boolean;
    amounts: Record<string, string>;
}

export interface StructureForm {
    year_id: string;
    items: ItemDraft[];
}

export const linkClass =
    'text-[13px] leading-4 font-medium text-primary hover:underline';

export const selectClass =
    'h-9 min-w-0 rounded-md border border-solid border-border bg-white px-2 text-[13px] leading-4 text-text outline-none focus:border-primary';

export const moveClass =
    'flex h-[17px] w-6 items-center justify-center rounded-sm text-[10px] leading-none text-text-muted hover:bg-surface hover:text-text disabled:opacity-30 disabled:hover:bg-transparent';

export function draft(item: ItemRow, keepId: boolean): ItemDraft {
    return {
        key: keepId ? item.id : `copy-${item.id}`,
        id: keepId ? item.id : null,
        name: item.name,
        spread: item.spread,
        new_only: item.new_only,
        amounts: Object.fromEntries(
            Object.entries(item.amounts).map(([level, amount]) => [
                level,
                String(amount),
            ]),
        ),
    };
}

/** What the server would see for a draft, to tell whether anything changed. */
export function fingerprint(items: ItemDraft[]): string {
    return JSON.stringify(
        items.map((item) => [
            item.id,
            item.name.trim(),
            item.spread,
            item.new_only,
            Object.entries(item.amounts)
                .filter(([, amount]) => Number(amount) > 0)
                .map(([level, amount]) => [level, Number(amount)])
                .sort(([a], [b]) => String(a).localeCompare(String(b))),
        ]),
    );
}

/** The year whose fees are being set, once there is one. */
export type OpenYear = NonNullable<StructureProps['year']>;

/**
 * The fees as edited so far against what the server holds, what they
 * add up to by level, and saving or billing them.
 */
export function useFeeStructure({
    currency,
    years = [],
    year,
    previousLabel,
    billingTerm,
    installments = [],
    items = [],
    previousItems = [],
    levels = [],
}: StructureProps & { year: OpenYear }) {
    const pageErrors = usePage().props.errors as Record<
        string,
        string | undefined
    >;
    const saved = items.map((item) => draft(item, true));
    const form = useForm<StructureForm>({
        year_id: year?.id ?? '',
        items: saved,
    });
    const errors = form.errors as Record<string, string | undefined>;

    const drafts = form.data.items;
    const dirty = fingerprint(drafts) !== fingerprint(saved);
    const amountOf = (item: ItemDraft, levelId: string): number => {
        const value = Number(item.amounts[levelId] ?? '');

        return Number.isFinite(value) && value > 0 ? value : 0;
    };
    const totalOf = (levelId: string, forNew: boolean): number =>
        drafts.reduce(
            (sum, item) =>
                sum + (item.new_only && !forNew ? 0 : amountOf(item, levelId)),
            0,
        );
    /** Which levels pay an item, when it is not all of them. */
    const payers = (item: ItemDraft): string | null => {
        const paying = levels
            .filter((level) => amountOf(item, level.id) > 0)
            .map((level) => level.name);

        if (levels.length === 0 || paying.length === levels.length) {
            return null;
        }

        return paying.length === 0
            ? t('No level pays this yet. Enter its amounts below.')
            : t('Only :paying :pay this.', {
                  paying:
                      paying.length === 1
                          ? paying[0]
                          : `${paying.slice(0, -1).join(', ')} and ${paying[paying.length - 1]}`,
                  pay: paying.length === 1 ? 'pays' : 'pay',
              });
    };
    const unbilled = levels.reduce(
        (sum, level) =>
            sum + (level.has_fee ? level.students - level.billed : 0),
        0,
    );
    const expected = levels.reduce(
        (sum, level) => sum + totalOf(level.id, false) * level.students,
        0,
    );
    const hasNewOnly = drafts.some((item) => item.new_only);
    const hasUpfront = drafts.some((item) => !item.spread);

    function setItems(next: ItemDraft[]) {
        form.setData('items', next);
    }

    function change(key: string, patch: Partial<ItemDraft>) {
        setItems(
            drafts.map((item) =>
                item.key === key ? { ...item, ...patch } : item,
            ),
        );
    }

    function move(position: number, by: number) {
        const next = [...drafts];
        const [item] = next.splice(position, 1);

        next.splice(position + by, 0, item);
        setItems(next);
    }

    function add() {
        setItems([
            ...drafts,
            {
                key: `new-${Date.now()}`,
                id: null,
                name: drafts.length === 0 ? t('School fees') : '',
                spread: drafts.length === 0,
                new_only: false,
                amounts: {},
            },
        ]);
    }

    function save() {
        form.transform((data) => ({
            year_id: data.year_id,
            items: data.items.map((item) => ({
                id: item.id,
                name: item.name,
                spread: item.spread,
                new_only: item.new_only,
                amounts: Object.fromEntries(
                    Object.entries(item.amounts).map(([level, amount]) => [
                        level,
                        amount.trim() === '' ? null : Number(amount),
                    ]),
                ),
            })),
        }));
        form.patch(updateStructure.url(), { preserveScroll: true });
    }

    function billStudents(levelId?: string) {
        router.post(
            bill.url(),
            { year_id: year?.id, level_id: levelId ?? null },
            { preserveScroll: true },
        );
    }

    return {
        currency,
        years,
        year,
        previousLabel,
        billingTerm,
        installments,
        items,
        previousItems,
        levels,
        pageErrors,
        saved,
        form,
        errors,
        drafts,
        dirty,
        amountOf,
        totalOf,
        payers,
        unbilled,
        expected,
        hasNewOnly,
        hasUpfront,
        setItems,
        change,
        move,
        add,
        save,
        billStudents,
    };
}

export type FeeStructure = ReturnType<typeof useFeeStructure>;
