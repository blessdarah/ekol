import type { ReactNode } from 'react';

export const capsClass =
    'text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase';

/** A two- or three-way switch. */
export function Segmented<T extends string>({
    options,
    value,
    onChange,
    small = false,
}: {
    options: { value: T; label: string }[];
    value: T;
    onChange: (value: T) => void;
    small?: boolean;
}) {
    return (
        <div
            className={`flex rounded-[9px] bg-surface p-[3px] ${small ? 'text-[12px]' : 'text-[13px]'} leading-4`}
        >
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    aria-pressed={option.value === value}
                    onClick={() => onChange(option.value)}
                    className={`flex items-center rounded-[7px] ${small ? 'h-[26px] px-[10px]' : 'h-[30px] px-[14px]'} ${
                        option.value === value
                            ? 'bg-white font-semibold text-text shadow-[0_1px_2px_color-mix(in_srgb,var(--color-text)_12%,transparent)]'
                            : 'text-text-muted hover:text-text'
                    }`}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

/** A titled band of the dashboard. */
export function Section({
    title,
    sub,
    action,
    children,
}: {
    title: string;
    sub?: string;
    action?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <h2 className="font-display text-[20px] leading-6 font-bold text-text">
                        {title}
                    </h2>
                    {sub && (
                        <p className="text-[13px] leading-[18px] text-text-muted">
                            {sub}
                        </p>
                    )}
                </div>
                {action}
            </div>
            {children}
        </section>
    );
}

/** One headline number with its label, a line under it and a small chart. */
export function Headline({
    label,
    value,
    sub,
    children,
}: {
    label: string;
    value: ReactNode;
    sub: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="flex min-w-0 flex-col gap-[6px] border-solid border-border py-6 sm:px-6 lg:first:pl-0 lg:last:pr-0 sm:[&:not(:first-child)]:border-l">
            <span className={capsClass}>{label}</span>
            <span className="font-display text-[34px] leading-[38px] font-extrabold tracking-[-0.02em] text-text">
                {value}
            </span>
            <span className="text-[13px] leading-[18px] text-text-muted">
                {sub}
            </span>
            {children}
        </div>
    );
}

/** "38 / 52", the whole in light grey. */
export function Of({ part, whole }: { part: number; whole: number }) {
    return (
        <>
            {part}
            <span className="font-light text-text-muted"> / {whole}</span>
        </>
    );
}
