import { type ReactNode } from 'react';

/** One ticked selling point. */
export function Tick({ children }: { children: ReactNode }) {
    return (
        <li className="flex gap-2 text-[15px] leading-[18px] text-brand-text">
            <span aria-hidden="true">✓</span>
            {children}
        </li>
    );
}
