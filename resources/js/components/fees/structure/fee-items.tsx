import { t } from '../../../lib/i18n';
import { capsLabelClass, ErrorText, PlusIcon } from '../../structure/ui';
import { figure } from '../ui';
import { type FeeStructure, linkClass, selectClass, moveClass } from './model';

/** What the school charges: each item, spread or up front, and for whom. */
export function FeeItems({ fees }: { fees: FeeStructure }) {
    const { year, items, errors, drafts, payers, setItems, change, move, add } =
        fees;

    return (
        <section className="flex flex-col gap-3">
            <p className={capsLabelClass}>
                {t('What the school charges · :label', {
                    label: year.label,
                })}
            </p>
            <div className="flex flex-col rounded-lg border border-solid border-border">
                {drafts.length === 0 && (
                    <p className="p-4 text-[13px] leading-[19px] text-text">
                        {t(
                            'Nothing is charged for :label yet. Add school fees first, then anything else parents pay: the PTA contribution, registration, exam fees.',
                            { label: year.label },
                        )}
                    </p>
                )}
                {drafts.map((item, position) => {
                    const before = items.find((row) => row.id === item.id);
                    const error = errors[`items.${position}.name`];

                    return (
                        <div
                            key={item.key}
                            className="flex flex-col gap-1 border-b border-solid border-border px-3 py-[10px]"
                        >
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="flex shrink-0 flex-col">
                                    <button
                                        type="button"
                                        aria-label={t('Move :item up', {
                                            item: item.name || 'item',
                                        })}
                                        disabled={position === 0}
                                        onClick={() => move(position, -1)}
                                        className={moveClass}
                                    >
                                        ▲
                                    </button>
                                    <button
                                        type="button"
                                        aria-label={t('Move :item down', {
                                            item: item.name || 'item',
                                        })}
                                        disabled={
                                            position === drafts.length - 1
                                        }
                                        onClick={() => move(position, 1)}
                                        className={moveClass}
                                    >
                                        ▼
                                    </button>
                                </span>
                                <span className="w-5 shrink-0 text-center font-mono text-[12px] leading-4 text-text-muted">
                                    {position + 1}
                                </span>
                                <input
                                    type="text"
                                    aria-label={t('Name of item :position', {
                                        position: position + 1,
                                    })}
                                    value={item.name}
                                    maxLength={40}
                                    onChange={(e) =>
                                        change(item.key, {
                                            name: e.target.value,
                                        })
                                    }
                                    placeholder={t('e.g. PTA contribution')}
                                    className={`h-9 min-w-[160px] flex-1 rounded-md border border-solid bg-white px-[10px] text-[14px] leading-[18px] font-medium text-text outline-none placeholder:font-normal placeholder:text-text-muted focus:border-primary ${error ? 'border-danger' : 'border-border'}`}
                                />
                                <select
                                    aria-label={t('How :item is paid', {
                                        item: item.name || 'the item',
                                    })}
                                    value={item.spread ? 'spread' : 'upfront'}
                                    onChange={(e) =>
                                        change(item.key, {
                                            spread: e.target.value === 'spread',
                                        })
                                    }
                                    className={selectClass}
                                >
                                    <option value="spread">
                                        {t('Spread over the installments')}
                                    </option>
                                    <option value="upfront">
                                        {t('In full with the 1st installment')}
                                    </option>
                                </select>
                                <select
                                    aria-label={t('Who pays :item', {
                                        item: item.name || 'the item',
                                    })}
                                    value={item.new_only ? 'new' : 'all'}
                                    onChange={(e) =>
                                        change(item.key, {
                                            new_only: e.target.value === 'new',
                                        })
                                    }
                                    className={selectClass}
                                >
                                    <option value="all">
                                        {t('Every student')}
                                    </option>
                                    <option value="new">
                                        {t('New students only')}
                                    </option>
                                </select>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setItems(
                                            drafts.filter(
                                                (other) =>
                                                    other.key !== item.key,
                                            ),
                                        )
                                    }
                                    className={`${linkClass} shrink-0 px-1`}
                                >
                                    {t('Remove')}
                                </button>
                            </div>
                            <ErrorText message={error} />
                            {payers(item) && (
                                <p className="pl-[58px] text-[12px] leading-4 text-text-muted">
                                    {payers(item)}
                                </p>
                            )}
                            {before && before.billed > 0 && (
                                <p className="pl-[58px] font-mono text-[12px] leading-4 text-text-muted">
                                    {t(
                                        ':collected collected of :billed billed',
                                        {
                                            collected: figure(before.collected),
                                            billed: figure(before.billed),
                                        },
                                    )}
                                </p>
                            )}
                        </div>
                    );
                })}
                <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-[10px]">
                    <button
                        type="button"
                        onClick={add}
                        disabled={drafts.length >= 12}
                        className={`flex items-center gap-[6px] ${linkClass} disabled:opacity-40`}
                    >
                        <PlusIcon />
                        {t('Add an item')}
                    </button>
                    {drafts.length > 1 && (
                        <span className="text-[12px] leading-[17px] text-text-muted">
                            {t(
                                'A parent’s money goes to item 1 first, then item 2, and so on.',
                            )}
                        </span>
                    )}
                </div>
            </div>
            <ErrorText message={errors.items} />
        </section>
    );
}
