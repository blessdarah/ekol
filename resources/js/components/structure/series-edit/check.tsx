import type { ReactNode } from 'react';

/** One check on the series, passed or still to look at. */
export function Check({
    tone,
    children,
}: {
    tone: 'success' | 'warning';
    children: ReactNode;
}) {
    return (
        <li className="flex items-start gap-2 text-[13px] leading-[18px] text-text-muted">
            <span
                className={`mt-[6px] h-[6px] w-[6px] shrink-0 rounded-full ${tone === 'success' ? 'bg-success' : 'bg-warning'}`}
            />
            {children}
        </li>
    );
}
