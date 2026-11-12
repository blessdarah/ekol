import { type ReactNode } from 'react';

/** One labelled line of the record. */
export function Row({
    label,
    children,
    last = false,
}: {
    label: string;
    children: ReactNode;
    last?: boolean;
}) {
    return (
        <div
            className={`flex items-baseline gap-4 border-t border-solid border-border py-3 ${last ? 'border-b' : ''}`}
        >
            <dt className="w-[184px] shrink-0 text-[13px] leading-[1.35] text-text-muted">
                {label}
            </dt>
            <dd className="min-w-0 text-[14px] leading-[1.35] text-text">
                {children}
            </dd>
        </div>
    );
}
