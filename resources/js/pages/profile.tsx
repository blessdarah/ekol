import { Head, useForm } from '@inertiajs/react';
import { useState, type FormEvent, type ReactNode } from 'react';
import {
    update,
    updatePassword,
} from '@/actions/App/Http/Controllers/ProfileController';
import { dayMonth } from '../components/fees/ui';
import { switchLocale } from '../components/shell/language-switch';
import {
    fieldInputClass,
    outlineButtonClass,
    solidButtonClass,
} from '../components/structure/ui';
import { withAppShell } from '../layouts/app-layout';
import { t, useLocale } from '../lib/i18n';

interface ProfileProps {
    profile: {
        given_name: string | null;
        family_name: string | null;
        full_name: string;
        initials: string;
        email: string | null;
        phone: string | null;
        photo_url: string | null;
        password_changed_on: string | null;
    };
    schools: {
        name: string;
        code: string;
        role: string;
        current: boolean;
        login_url: string;
    }[];
}

const LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'fr', label: 'Français' },
];

function Zone({
    title,
    desc,
    children,
}: {
    title: string;
    desc: string;
    children: ReactNode;
}) {
    return (
        <section className="flex flex-col gap-4 border-b border-solid border-border pb-6 last:border-b-0 lg:flex-row lg:gap-10">
            <div className="flex shrink-0 flex-col gap-1 lg:w-[220px]">
                <h2 className="text-[14px] leading-[18px] font-semibold text-text">
                    {title}
                </h2>
                <p className="text-[13px] leading-[19px] text-text-muted">
                    {desc}
                </p>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-3">{children}</div>
        </section>
    );
}

function Field({
    label,
    error,
    hint,
    children,
}: {
    label: string;
    error?: string;
    hint?: string;
    children: ReactNode;
}) {
    return (
        <label className="flex min-w-0 flex-1 flex-col gap-[6px] text-[13px] leading-4 font-medium text-text">
            {label}
            {children}
            {hint && (
                <span className="text-[12px] font-normal text-text-muted">
                    {hint}
                </span>
            )}
            {error && <span className="font-normal text-danger">{error}</span>}
        </label>
    );
}

function PasswordForm({ onDone }: { onDone: () => void }) {
    const form = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    function submit(event: FormEvent) {
        event.preventDefault();
        form.put(updatePassword.url(), {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                onDone();
            },
            onError: () => form.reset('password', 'password_confirmation'),
        });
    }

    return (
        <form
            onSubmit={submit}
            className="flex flex-col gap-3 rounded-lg border border-solid border-border p-4"
        >
            <Field
                label={t('Current password')}
                error={form.errors.current_password}
            >
                <input
                    type="password"
                    autoComplete="current-password"
                    value={form.data.current_password}
                    onChange={(e) =>
                        form.setData('current_password', e.target.value)
                    }
                    className={fieldInputClass}
                />
            </Field>
            <div className="flex flex-col gap-3 sm:flex-row">
                <Field label={t('New password')} error={form.errors.password}>
                    <input
                        type="password"
                        autoComplete="new-password"
                        value={form.data.password}
                        onChange={(e) =>
                            form.setData('password', e.target.value)
                        }
                        className={fieldInputClass}
                    />
                </Field>
                <Field label={t('New password again')}>
                    <input
                        type="password"
                        autoComplete="new-password"
                        value={form.data.password_confirmation}
                        onChange={(e) =>
                            form.setData(
                                'password_confirmation',
                                e.target.value,
                            )
                        }
                        className={fieldInputClass}
                    />
                </Field>
            </div>
            <div className="flex gap-2">
                <button
                    type="submit"
                    disabled={form.processing}
                    className={solidButtonClass}
                >
                    {t('Change password')}
                </button>
                <button
                    type="button"
                    onClick={onDone}
                    className={outlineButtonClass}
                >
                    {t('Cancel')}
                </button>
            </div>
        </form>
    );
}

function Profile({ profile, schools }: ProfileProps) {
    const locale = useLocale();
    const [changingPassword, setChangingPassword] = useState(false);
    const [preview, setPreview] = useState<string | null>(profile.photo_url);
    const form = useForm<{
        given_name: string;
        family_name: string;
        phone: string;
        photo: File | null;
    }>({
        given_name: profile.given_name ?? '',
        family_name: profile.family_name ?? '',
        phone: profile.phone ?? '',
        photo: null,
    });

    function submit(event: FormEvent) {
        event.preventDefault();
        form.post(update.url(), {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => form.setData('photo', null),
        });
    }

    return (
        <div className="flex flex-col gap-6">
            <Head title={t('My profile')} />
            <div className="flex flex-col gap-[6px] border-b border-solid border-border pb-5">
                <span className="text-[13px] leading-4 text-text-muted">
                    {t('Account')}
                </span>
                <h1 className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text sm:text-[40px] sm:leading-[44px]">
                    {t('My profile')}
                </h1>
            </div>

            <form onSubmit={submit} className="flex flex-col gap-6">
                <Zone
                    title={t('You')}
                    desc={t(
                        'How your name shows on report cards, receipts and the timetable.',
                    )}
                >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                        <label className="flex shrink-0 cursor-pointer flex-col items-center gap-2">
                            {preview ? (
                                <img
                                    src={preview}
                                    alt=""
                                    className="h-16 w-16 rounded-full object-cover"
                                />
                            ) : (
                                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-tint font-display text-[22px] font-extrabold text-primary">
                                    {profile.initials}
                                </span>
                            )}
                            <span className="text-[13px] font-medium text-primary hover:underline">
                                {t('Change photo')}
                            </span>
                            <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                className="sr-only"
                                onChange={(e) => {
                                    const file = e.target.files?.[0] ?? null;
                                    form.setData('photo', file);
                                    setPreview(
                                        file
                                            ? URL.createObjectURL(file)
                                            : profile.photo_url,
                                    );
                                }}
                            />
                        </label>
                        <Field
                            label={t('Given name')}
                            error={form.errors.given_name}
                        >
                            <input
                                value={form.data.given_name}
                                onChange={(e) =>
                                    form.setData('given_name', e.target.value)
                                }
                                className={fieldInputClass}
                            />
                        </Field>
                        <Field
                            label={t('Family name')}
                            error={form.errors.family_name}
                        >
                            <input
                                value={form.data.family_name}
                                onChange={(e) =>
                                    form.setData('family_name', e.target.value)
                                }
                                className={fieldInputClass}
                            />
                        </Field>
                    </div>
                    {form.errors.photo && (
                        <p className="text-[13px] text-danger">
                            {form.errors.photo}
                        </p>
                    )}
                </Zone>

                <Zone
                    title={t('Signing in')}
                    desc={t(
                        'You sign in with your email or your phone number. Your email is set by the school.',
                    )}
                >
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <Field
                            label={t('Email · set by the school')}
                            hint={t(
                                'To change it, ask your school’s administrator.',
                            )}
                        >
                            <span className="flex h-10 items-center justify-between gap-2 rounded-md border border-solid border-border bg-surface px-3 text-[16px] leading-5 font-normal text-text-muted">
                                <span className="truncate">
                                    {profile.email ?? '—'}
                                </span>
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    className="shrink-0"
                                >
                                    <rect
                                        x="5"
                                        y="11"
                                        width="14"
                                        height="10"
                                        rx="2"
                                    />
                                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                                </svg>
                            </span>
                        </Field>
                        <Field
                            label={t('Phone · WhatsApp')}
                            error={form.errors.phone}
                        >
                            <input
                                type="tel"
                                value={form.data.phone}
                                onChange={(e) =>
                                    form.setData('phone', e.target.value)
                                }
                                className={`${fieldInputClass} font-mono`}
                            />
                        </Field>
                    </div>
                    <div className="flex">
                        <button
                            type="submit"
                            disabled={form.processing || !form.isDirty}
                            className={solidButtonClass}
                        >
                            {t('Save changes')}
                        </button>
                    </div>
                </Zone>
            </form>

            <Zone
                title={t('Password')}
                desc={t(
                    'Use at least 8 characters. You stay signed in on this device after changing it.',
                )}
            >
                {changingPassword ? (
                    <PasswordForm onDone={() => setChangingPassword(false)} />
                ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface px-4 py-3">
                        <span className="flex flex-col gap-[2px]">
                            <span className="text-[14px] font-medium text-text">
                                {t('Password')}
                            </span>
                            <span className="text-[13px] text-text-muted">
                                {profile.password_changed_on
                                    ? t('Last changed :date', {
                                          date: dayMonth(
                                              profile.password_changed_on,
                                          ),
                                      })
                                    : t(
                                          'Not changed since your account was set up',
                                      )}
                            </span>
                        </span>
                        <button
                            type="button"
                            onClick={() => setChangingPassword(true)}
                            className={outlineButtonClass}
                        >
                            {t('Change password')}
                        </button>
                    </div>
                )}
            </Zone>

            <Zone
                title={t('Language')}
                desc={t(
                    'For you only. The school’s own language is set in School Setup.',
                )}
            >
                <div className="flex gap-2">
                    {LANGUAGES.map((option) => (
                        <button
                            key={option.code}
                            type="button"
                            lang={option.code}
                            aria-pressed={locale === option.code}
                            onClick={() =>
                                locale !== option.code &&
                                switchLocale(option.code)
                            }
                            className={`flex h-10 items-center rounded-md border border-solid px-[18px] text-[14px] ${
                                locale === option.code
                                    ? 'border-primary bg-primary-tint font-semibold text-primary'
                                    : 'border-border font-medium text-text hover:bg-surface'
                            }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </Zone>

            {schools.length > 0 && (
                <Zone
                    title={t('Your schools')}
                    desc={t(
                        'Schools on Campus that know you by this email. Each school sets your role.',
                    )}
                >
                    <div className="flex flex-col overflow-hidden rounded-lg border border-solid border-border">
                        {schools.map((school) => (
                            <div
                                key={school.login_url}
                                className="flex min-h-[52px] flex-wrap items-center gap-3 border-b border-solid border-border px-4 py-2 last:border-b-0"
                            >
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-white">
                                    {school.code.slice(0, 2).toUpperCase()}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-text">
                                    {school.name}
                                </span>
                                <span className="w-[160px] shrink-0 truncate text-[13px] text-text-muted">
                                    {t(school.role)}
                                </span>
                                {school.current ? (
                                    <span className="w-[100px] shrink-0 text-right text-[13px] text-text-muted">
                                        {t('You are here')}
                                    </span>
                                ) : (
                                    <a
                                        href={school.login_url}
                                        className="w-[100px] shrink-0 text-right text-[13px] font-medium text-primary hover:underline"
                                    >
                                        {t('Open →')}
                                    </a>
                                )}
                            </div>
                        ))}
                    </div>
                </Zone>
            )}
        </div>
    );
}

export default withAppShell(Profile);
