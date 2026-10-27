import { Form, Head, Link } from '@inertiajs/react';
import {
    store,
    verify,
    show,
} from '@/actions/App/Http/Controllers/PlatformAuthController';
import {
    ErrorText,
    fieldInputClass,
    solidButtonClass,
} from '@/components/structure/ui';
import { useT } from '@/lib/i18n';

export default function PlatformLogin({
    awaitingCode,
}: {
    awaitingCode: boolean;
}) {
    const t = useT();
    return (
        <main className="flex min-h-screen items-center justify-center bg-surface px-4 font-auth text-text">
            <Head title={t('Platform sign in')} />
            <section className="flex w-full max-w-[420px] flex-col gap-6 rounded-xl border border-border bg-white p-8">
                <p className="font-mono text-xs tracking-[0.06em] text-primary">
                    CAMPUS · PLATFORM
                </p>
                <div className="flex flex-col gap-2">
                    <h1 className="font-display text-[32px] font-extrabold tracking-tight">
                        {t(
                            awaitingCode
                                ? 'Check your email'
                                : 'Platform sign in',
                        )}
                    </h1>
                    <p className="text-[14px] leading-5 text-text-muted">
                        {t(
                            awaitingCode
                                ? 'Enter the six-digit code. It expires in 10 minutes.'
                                : 'For Campus super-admin accounts. Every sign-in requires an email code.',
                        )}
                    </p>
                </div>
                {awaitingCode ? (
                    <Form key="platform-verification" {...verify.form()}>
                        {({ errors, processing }) => (
                            <div className="flex flex-col gap-4">
                                <label className="flex flex-col gap-2 text-[13px] font-medium">
                                    {t('Email code')}
                                    <input
                                        autoFocus
                                        id="platform-code"
                                        name="code"
                                        defaultValue=""
                                        placeholder="123456"
                                        autoComplete="one-time-code"
                                        inputMode="numeric"
                                        pattern="[0-9]{6}"
                                        maxLength={6}
                                        required
                                        className={`${fieldInputClass} font-mono tracking-[0.3em]`}
                                    />
                                </label>
                                <ErrorText message={errors.code} />
                                <button
                                    disabled={processing}
                                    className={solidButtonClass}
                                >
                                    {t('Verify and sign in')}
                                </button>
                                <Link
                                    href={show({ query: { restart: true } })}
                                    className="text-xs text-text-muted"
                                >
                                    {t('Sign in again to request a new code.')}
                                </Link>
                            </div>
                        )}
                    </Form>
                ) : (
                    <Form key="platform-credentials" {...store.form()}>
                        {({ errors, processing }) => (
                            <div className="flex flex-col gap-4">
                                <label className="flex flex-col gap-2 text-[13px] font-medium">
                                    {t('Email')}
                                    <input
                                        name="email"
                                        type="email"
                                        autoComplete="username"
                                        required
                                        className={fieldInputClass}
                                    />
                                </label>
                                <label className="flex flex-col gap-2 text-[13px] font-medium">
                                    {t('Password')}
                                    <input
                                        name="password"
                                        type="password"
                                        autoComplete="current-password"
                                        required
                                        className={fieldInputClass}
                                    />
                                </label>
                                <ErrorText
                                    message={errors.email ?? errors.password}
                                />
                                <button
                                    disabled={processing}
                                    className={solidButtonClass}
                                >
                                    {t('Send sign-in code')}
                                </button>
                            </div>
                        )}
                    </Form>
                )}
            </section>
        </main>
    );
}
