import { useEffect, useId, useRef, type ReactNode } from 'react';

export default function TableRowMenu({
    className = 'w-8',
    label,
    open,
    onToggle,
    onClose,
    children,
}: {
    className?: string;
    label: string;
    open: boolean;
    onToggle: () => void;
    onClose: () => void;
    children: ReactNode;
}) {
    const id = useId();
    const root = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!open) return;
        const outside = (event: MouseEvent) => {
            if (
                event.target instanceof Node &&
                !root.current?.contains(event.target)
            )
                onClose();
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
                trigger.current?.focus();
            }
        };
        document.addEventListener('mousedown', outside);
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('mousedown', outside);
            document.removeEventListener('keydown', escape);
        };
    }, [open, onClose]);

    return (
        <div
            ref={root}
            className={`relative flex shrink-0 justify-center ${className}`}
            onClick={(event) => event.stopPropagation()}
        >
            <button
                ref={trigger}
                type="button"
                aria-label={label}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? id : undefined}
                onClick={onToggle}
                className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:bg-primary-tint focus-visible:outline-2 focus-visible:outline-primary"
            >
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    aria-hidden="true"
                    fill="currentColor"
                >
                    <circle cx="3" cy="8" r="1.2" />
                    <circle cx="8" cy="8" r="1.2" />
                    <circle cx="13" cy="8" r="1.2" />
                </svg>
            </button>
            {open && (
                <div
                    id={id}
                    role="menu"
                    aria-label={label}
                    className="absolute top-full right-0 z-10 mt-1 flex w-[190px] flex-col rounded-md border border-solid border-border bg-white p-1 shadow-lg"
                    onClick={(event) => {
                        event.stopPropagation();
                        if (
                            event.target instanceof Element &&
                            event.target.closest('[role="menuitem"]')
                        )
                            onClose();
                    }}
                >
                    {children}
                </div>
            )}
        </div>
    );
}
