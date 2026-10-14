import { t } from '../../lib/i18n';
export interface SegmentOption {
    value: string;
    label: string;
}

export default function Segmented({
    name,
    options,
    value,
    onChange,
}: {
    name: string;
    options: SegmentOption[];
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <div className="flex gap-2" role="radiogroup">
            <input type="hidden" name={name} value={value} />
            {options.map((option) => {
                const selected = option.value === value;

                return (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => onChange(option.value)}
                        className={`flex h-9 grow items-center justify-center rounded-lg border border-solid text-base leading-[18px] ${
                            selected
                                ? 'border-primary bg-primary-tint font-semibold text-primary'
                                : 'border-border font-medium text-text'
                        }`}
                    >
                        {t(option.label)}
                    </button>
                );
            })}
        </div>
    );
}
