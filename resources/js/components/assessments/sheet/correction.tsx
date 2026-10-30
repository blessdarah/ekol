import { useForm } from '@inertiajs/react';
import { store as askCorrection } from '@/actions/App/Http/Controllers/CorrectionController';
import { t } from '../../../lib/i18n';
import { ErrorText } from '../../structure/ui';
import { primaryClass, quietClass } from '../ui';
import type { Row } from './model';

/** Ask the principal to change a published mark, with the reason. */
export function Correction({
    row,
    max,
    onClose,
}: {
    row: Row;
    max: number;
    onClose: () => void;
}) {
    const form = useForm({
        mark_id: row.mark_id ?? '',
        new_score: '',
        reason: '',
    });
    const errors = form.errors as Record<string, string | undefined>;

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                form.transform((data) => ({
                    ...data,
                    new_score: Number(data.new_score),
                }));
                form.post(askCorrection.url(), {
                    preserveScroll: true,
                    onSuccess: onClose,
                });
            }}
            className="flex flex-wrap items-start gap-3 border-b border-solid border-border bg-surface px-4 py-3"
        >
            <label className="flex flex-col gap-[6px] text-[12px] leading-4 font-medium text-text">
                {t('Corrected mark /')} {max}
                <input
                    type="text"
                    inputMode="decimal"
                    autoFocus
                    value={form.data.new_score}
                    onChange={(e) =>
                        form.setData(
                            'new_score',
                            e.target.value.replace(/[^\d.]/g, ''),
                        )
                    }
                    className="h-9 w-[110px] rounded-md border border-solid border-border bg-white px-3 text-right font-mono text-[14px] font-normal text-text outline-none focus:border-primary"
                />
            </label>
            <label className="flex min-w-[240px] flex-1 flex-col gap-[6px] text-[12px] leading-4 font-medium text-text">
                {t('Reason')}
                <input
                    type="text"
                    value={form.data.reason}
                    onChange={(e) => form.setData('reason', e.target.value)}
                    placeholder={t('What was wrong, and how you know')}
                    className="h-9 w-full rounded-md border border-solid border-border bg-white px-3 text-[13px] font-normal text-text outline-none focus:border-primary"
                />
            </label>
            <div className="flex gap-2 pt-[22px]">
                <button
                    type="submit"
                    disabled={form.processing || form.data.new_score === ''}
                    className={primaryClass}
                >
                    {t('Ask the principal')}
                </button>
                <button type="button" onClick={onClose} className={quietClass}>
                    {t('Cancel')}
                </button>
            </div>
            <div className="basis-full">
                <ErrorText
                    message={
                        errors.new_score ?? errors.reason ?? errors.mark_id
                    }
                />
            </div>
        </form>
    );
}
