/** Where an installment stands: paid, the one due now, or still ahead. */
export function Marker({
    state,
    current,
}: {
    state: string;
    current: boolean;
}) {
    if (state === 'paid') {
        return (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success">
                <svg width="14" height="14" viewBox="0 0 24 24">
                    <path
                        d="M5 12l5 5 9-10"
                        fill="none"
                        stroke="var(--color-bg)"
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                </svg>
            </span>
        );
    }

    if (current) {
        return (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-solid border-warning">
                <span className="h-[10px] w-[10px] shrink-0 rounded-full bg-warning" />
            </span>
        );
    }

    return (
        <span className="h-7 w-7 shrink-0 rounded-full border-2 border-solid border-border" />
    );
}
