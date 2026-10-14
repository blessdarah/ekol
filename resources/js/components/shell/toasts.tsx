import { router, usePage } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '../../lib/i18n';

export interface ToastData {
    type: 'success' | 'error' | 'info';
    message: string;
}

interface Toast extends ToastData {
    id: number;
}

/** How long a message stays before it leaves on its own. */
const LIFETIME: Record<ToastData['type'], number> = {
    success: 5000,
    info: 6000,
    error: 9000,
};

const TONES: Record<ToastData['type'], { mark: string; label: string }> = {
    success: { mark: 'bg-success-tint text-success', label: 'Done' },
    info: { mark: 'bg-primary-tint text-primary', label: 'Note' },
    error: { mark: 'bg-danger-tint text-danger', label: 'Problem' },
};

function Mark({ type }: { type: ToastData['type'] }) {
    return (
        <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${TONES[type].mark}`}
        >
            <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                {type === 'success' && <path d="M2.5 6.3l2.3 2.3 4.7-5" />}
                {type === 'info' && <path d="M6 5.4v3.2M6 3.2v.2" />}
                {type === 'error' && <path d="M6 2.8v3.6M6 8.8v.2" />}
            </svg>
        </span>
    );
}

/**
 * The messages that confirm what the user just did, or say why it did
 * not happen. The server flashes one after an action; a failed form,
 * or a request that never reached the server, raises one here.
 */
export default function Toasts() {
    const { flash } = usePage();
    const t = useT();
    const [toasts, setToasts] = useState<Toast[]>([]);
    const nextId = useRef(1);
    const flashed = flash.toast;

    const dismiss = useCallback((id: number) => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
    }, []);

    const push = useCallback(
        (toast: ToastData) => {
            const id = nextId.current++;

            setToasts((current) => [...current.slice(-3), { ...toast, id }]);
            window.setTimeout(
                () => dismiss(id),
                LIFETIME[toast.type] ?? LIFETIME.info,
            );
        },
        [dismiss],
    );

    useEffect(() => {
        if (flashed?.message) {
            push(flashed);
        }
    }, [flashed, push]);

    useEffect(() => {
        const offError = router.on('error', (event) => {
            const messages = Object.values(event.detail.errors)
                .flat()
                .filter(Boolean);

            if (messages.length > 0) {
                push({
                    type: 'error',
                    message:
                        messages.length === 1
                            ? String(messages[0])
                            : `${messages[0]} ${t('And :count more to fix.', { count: messages.length - 1 })}`,
                });
            }
        });
        const offNetwork = router.on('networkError', () => {
            push({
                type: 'error',
                message: t(
                    'The server could not be reached. Check your connection and try again.',
                ),
            });
        });

        return () => {
            offError();
            offNetwork();
        };
    }, [push, t]);

    if (toasts.length === 0) {
        return null;
    }

    return (
        <div className="pointer-events-none fixed top-4 right-4 z-50 flex w-[360px] max-w-[calc(100vw-32px)] flex-col gap-2 print:hidden">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    role={toast.type === 'error' ? 'alert' : 'status'}
                    className="pointer-events-auto flex items-start gap-3 rounded-lg border border-solid border-border bg-white p-3 shadow-[0_8px_24px_rgba(16,25,21,0.12)]"
                >
                    <Mark type={toast.type} />
                    <p className="min-w-0 flex-1 py-[3px] text-[13px] leading-[18px] text-text">
                        <span className="sr-only">
                            {t(TONES[toast.type].label)}:{' '}
                        </span>
                        {toast.message}
                    </p>
                    <button
                        type="button"
                        aria-label={t('Dismiss')}
                        onClick={() => dismiss(toast.id)}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-text-muted hover:bg-surface hover:text-text"
                    >
                        <svg
                            width="10"
                            height="10"
                            viewBox="0 0 10 10"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            aria-hidden="true"
                        >
                            <path d="M2 2l6 6M8 2l-6 6" />
                        </svg>
                    </button>
                </div>
            ))}
        </div>
    );
}
