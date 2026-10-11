import { useState, type KeyboardEvent, type ReactNode } from 'react';

export function Eyebrow({ children }: { children: ReactNode }) {
    return (
        <p className="text-xs font-semibold tracking-[0.06em] text-text-muted uppercase">
            {children}
        </p>
    );
}

export function Heading({
    title,
    sub,
}: {
    title: string;
    sub?: string;
}) {
    return (
        <div className="flex flex-col gap-2">
            <h1 className="font-display text-[40px] leading-[44px] font-extrabold tracking-[-0.02em] text-text">
                {title}
            </h1>
            {sub && (
                <p className="text-[16px] leading-[1.5] text-text-muted">
                    {sub}
                </p>
            )}
        </div>
    );
}

export function Field({
    label,
    error,
    hint,
    children,
}: {
    label: string;
    error?: string;
    hint?: ReactNode;
    children: ReactNode;
}) {
    return (
        <label className="flex flex-col gap-[6px] text-[13px] font-medium text-text">
            {label}
            {children}
            {hint}
            {error && <span className="font-normal text-danger">{error}</span>}
        </label>
    );
}

export const inputClass =
    'h-9 rounded-lg border border-solid border-border bg-white px-3 text-[14px] font-normal text-text outline-none focus:border-primary';

/**
 * Submit a form when Enter is pressed in one of its text fields.
 * Browsers normally do this themselves, but Safari's password
 * suggestions can swallow the key, so the forms ask for it outright.
 */
export function submitOnEnter(event: KeyboardEvent<HTMLFormElement>) {
    const target = event.target;

    if (
        event.key !== 'Enter' ||
        event.nativeEvent.isComposing ||
        !(target instanceof HTMLInputElement) ||
        ['checkbox', 'radio', 'button', 'submit', 'file'].includes(target.type)
    ) {
        return;
    }

    event.preventDefault();
    event.currentTarget.requestSubmit();
}

export function PrimaryButton({
    children,
    disabled,
}: {
    children: ReactNode;
    disabled?: boolean;
}) {
    return (
        <button
            type="submit"
            tabIndex={0}
            disabled={disabled}
            className="inline-flex h-9 items-center gap-2 self-start rounded-lg bg-primary px-4 text-[14px] font-medium text-white hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
        >
            {children}
            <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                className="shrink-0"
            >
                <path
                    d="M5 12h14M13 6l6 6-6 6"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        </button>
    );
}

const METER_LABELS = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];

export function PasswordField({
    name = 'password',
    label = 'Password',
    error,
    meter = false,
    autoComplete = 'new-password',
}: {
    name?: string;
    label?: string;
    error?: string;
    meter?: boolean;
    autoComplete?: string;
}) {
    const [value, setValue] = useState('');
    const [show, setShow] = useState(false);

    let score = 0;
    if (value.length >= 8) {
        score += 1;
    }
    if (value.length >= 12) {
        score += 1;
    }
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) {
        score += 1;
    }
    if (/\d/.test(value) || /[^A-Za-z0-9]/.test(value)) {
        score += 1;
    }
    if (value.length > 0 && value.length < 8) {
        score = 0;
    }

    return (
        <Field label={label} error={error}>
            <span className="relative flex">
                <input
                    type={show ? 'text' : 'password'}
                    name={name}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    autoComplete={autoComplete}
                    className={`${inputClass} w-full pr-16`}
                />
                <button
                    type="button"
                    onClick={() => setShow(!show)}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-[13px] font-medium text-text-muted hover:text-text"
                >
                    {show ? 'Hide' : 'Show'}
                </button>
            </span>
            {meter && value.length > 0 && (
                <span className="flex items-center gap-2">
                    <span className="flex gap-1">
                        {[0, 1, 2, 3].map((bar) => (
                            <span
                                key={bar}
                                className={`h-1 w-8 rounded-full ${
                                    bar < score
                                        ? score >= 3
                                            ? 'bg-success'
                                            : 'bg-warning'
                                        : 'bg-border'
                                }`}
                            />
                        ))}
                    </span>
                    <span className="text-[12px] text-text-muted">
                        {METER_LABELS[score]}
                    </span>
                </span>
            )}
        </Field>
    );
}

export function ErrorBanner({
    title,
    body,
}: {
    title: string;
    body?: string;
}) {
    return (
        <div className="flex items-start gap-3 rounded-lg border border-solid border-danger bg-danger-tint px-[14px] py-3">
            <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                className="mt-[1px] shrink-0"
            >
                <circle
                    cx="12"
                    cy="12"
                    r="9"
                    fill="none"
                    stroke="#B42318"
                    strokeWidth="2"
                />
                <path
                    d="M12 7.5v5.5M12 16.5v.5"
                    fill="none"
                    stroke="#B42318"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                />
            </svg>
            <span className="flex flex-col gap-[2px]">
                <span className="text-base leading-[18px] font-semibold text-danger">
                    {title}
                </span>
                {body && (
                    <span className="text-sm leading-[19px] text-text">
                        {body}
                    </span>
                )}
            </span>
        </div>
    );
}
