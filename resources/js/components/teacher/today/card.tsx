import type { ReactNode } from 'react';

/** A titled panel on the Today page. */
export function Card({
    title,
    note,
    children,
    className = '',
}: {
    title: string;
    note?: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <section
            className={`flex min-w-0 flex-col overflow-clip rounded-lg border border-solid border-border bg-white ${className}`}
        >
            <header className="flex items-center gap-4 border-b border-solid border-border bg-surface px-4 py-3">
                <h2 className="font-display text-[14px] leading-[18px] font-semibold text-text">
                    {title}
                </h2>
                {note && (
                    <span className="font-mono text-[12px] leading-4 text-text-muted">
                        {note}
                    </span>
                )}
            </header>
            {children}
        </section>
    );
}

/** A section of the design whose feature is not built yet. */
export function Pending({ children }: { children: ReactNode }) {
    return (
        <p className="px-4 py-[14px] text-[13px] leading-[19px] text-text-muted">
            {children}
        </p>
    );
}
