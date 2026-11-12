import { router } from '@inertiajs/react';
import { index } from '@/actions/App/Http/Controllers/TimetableChangeController';
import { t } from '../../../lib/i18n';
import { capsLabelClass } from '../../structure/ui';
import { MODES, type TimetableChanges } from './model';

/** The kinds of change: cover, swap or room. */
export function ModeSwitch({ changes }: { changes: TimetableChanges }) {
    const { mode, date } = changes;

    return (
        <>
            <div className="flex flex-wrap gap-2">
                {MODES.map((option) => (
                    <button
                        key={option.key}
                        type="button"
                        aria-pressed={option.key === mode}
                        onClick={() =>
                            router.get(
                                index.url({
                                    query: {
                                        mode: option.key,
                                        date,
                                    },
                                }),
                            )
                        }
                        className={`flex h-8 items-center rounded-full border border-solid px-[14px] text-[13px] leading-4 ${
                            option.key === mode
                                ? 'border-primary bg-primary-tint font-semibold text-primary'
                                : 'border-border font-medium text-text hover:bg-surface'
                        }`}
                    >
                        {t(option.label)}
                    </button>
                ))}
            </div>

            <p className={capsLabelClass}>
                {t(MODES.find((option) => option.key === mode)?.label)}
            </p>
        </>
    );
}
