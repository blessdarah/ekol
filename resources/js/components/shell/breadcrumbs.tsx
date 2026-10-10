import { Link } from '@inertiajs/react';
import { Fragment } from 'react';

export interface Crumb {
    label: string;
    /** Omit for the page you are on. */
    href?: string;
}

/** The trail to the current page; every step but the last is a link. */
export default function Breadcrumbs({ trail }: { trail: Crumb[] }) {
    return (
        <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-x-[6px] text-[13px] leading-4 text-text-muted">
                {trail.map((crumb, position) => {
                    const last = position === trail.length - 1;

                    return (
                        <Fragment key={`${crumb.label}-${position}`}>
                            <li>
                                {crumb.href && !last ? (
                                    <Link
                                        href={crumb.href}
                                        className="rounded-sm font-medium text-primary hover:text-primary-hover hover:underline"
                                    >
                                        {crumb.label}
                                    </Link>
                                ) : (
                                    <span aria-current={last ? 'page' : undefined}>
                                        {crumb.label}
                                    </span>
                                )}
                            </li>
                            {!last && <li aria-hidden="true">/</li>}
                        </Fragment>
                    );
                })}
            </ol>
        </nav>
    );
}
