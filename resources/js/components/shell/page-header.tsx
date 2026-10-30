import type { ReactNode } from 'react';
import Breadcrumbs, { type Crumb } from './breadcrumbs';

interface PageHeaderProps {
    root: Crumb;
    trail?: Crumb[];
    title: string;
    tag?: ReactNode;
    meta?: ReactNode;
    badge?: ReactNode;
    sub?: ReactNode;
    action?: ReactNode;
}

export default function PageHeader({
    root,
    trail = [],
    title,
    tag,
    meta,
    badge,
    sub,
    action,
}: PageHeaderProps) {
    return (
        <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-[6px]">
                <Breadcrumbs trail={[root, ...trail]} />
                <h1 className="font-display text-[22px] leading-7 font-extrabold tracking-[-0.02em] text-text sm:text-[40px] sm:leading-[44px]">
                    {title}
                </h1>
                {(tag || badge || meta) && (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-4 text-text-muted sm:text-[13px]">
                        {badge}
                        {typeof tag === 'string' ? (
                            <span className="font-mono uppercase">{tag}</span>
                        ) : (
                            tag
                        )}
                        {meta && (
                            <>
                                {(tag || badge) && (
                                    <span aria-hidden="true">·</span>
                                )}
                                {meta}
                            </>
                        )}
                    </div>
                )}
                {sub && (
                    <div className="max-w-[720px] text-[13px] leading-[19px] text-text-muted">
                        {sub}
                    </div>
                )}
            </div>
            {action && (
                <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">
                    {action}
                </div>
            )}
        </div>
    );
}
