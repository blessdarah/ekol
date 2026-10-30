import type { ReactNode } from 'react';

export default function TableEmptyState({
    title,
    children,
    action,
}: {
    title?: string;
    children?: ReactNode;
    action?: ReactNode;
}) {
    return (
        <div
            role="status"
            className="flex flex-col items-center gap-2 px-4 py-8 text-center text-[13px] text-text-muted"
        >
            {title && <p className="font-medium text-text">{title}</p>}
            {children && <div>{children}</div>}
            {action}
        </div>
    );
}
