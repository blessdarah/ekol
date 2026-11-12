import { count } from '../ui';

/** A count with its label under it. */
export function Stat({
    value,
    label,
    tone = 'text-text',
}: {
    value: number;
    label: string;
    tone?: string;
}) {
    return (
        <div className="flex flex-col gap-[2px]">
            <span className={`font-mono text-[16px] leading-5 ${tone}`}>
                {count(value)}
            </span>
            <span className="text-[12px] leading-4 text-text-muted">
                {label}
            </span>
        </div>
    );
}

/** A bar split in proportion to its parts; empty parts take no room. */
export function SplitBar({
    parts,
}: {
    parts: { value: number; tone: string }[];
}) {
    const shown = parts.filter((part) => part.value > 0);

    return (
        <div className="flex h-2 shrink-0 gap-[2px] overflow-clip rounded-full">
            {shown.length === 0 ? (
                <span className="flex-1 bg-border" />
            ) : (
                shown.map((part) => (
                    <span
                        key={part.tone}
                        className={part.tone}
                        style={{ flexGrow: part.value, flexBasis: 0 }}
                    />
                ))
            )}
        </div>
    );
}

/** A card's headline count. */
export function BigNumber({ value, label }: { value: number; label: string }) {
    return (
        <div className="flex items-baseline gap-2">
            <span className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text sm:text-[40px] sm:leading-[44px]">
                {count(value)}
            </span>
            <span className="text-[14px] leading-[18px] text-text-muted">
                {label}
            </span>
        </div>
    );
}
