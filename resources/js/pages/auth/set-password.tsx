import { useT } from '../../lib/i18n';
import { Head, Link, useForm } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import { store } from '@/actions/App/Http/Controllers/Auth/StaffInvitationController';
import { FlowSteps } from '../../components/staff/ui';
import { LogoMark } from '../../layouts/auth-layout';

interface SetPasswordProps {
    token: string;
    schoolName: string;
    member: {
        formal_name: string;
        role_label: string;
        subjects: string[];
    } | null;
}

const MIN_LENGTH = 10;

function generatePassword(): string {
    const letters = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
    const digits = '23456789';
    const values = crypto.getRandomValues(new Uint32Array(16));

    // Three digits at fixed spots guarantee the "one number" rule.
    return Array.from(values, (value, position) => {
        const pool = position % 5 === 4 ? digits : letters;

        return pool[value % pool.length];
    }).join('');
}

function SetPassword({ token, schoolName, member }: SetPasswordProps) {
    const form = useForm({ password: '' });
    const { data, setData, errors, processing } = form;
    const [visible, setVisible] = useState(false);
    const t = useT();
    const longEnough = data.password.length >= MIN_LENGTH;
    const hasNumber = /\d/.test(data.password);
    const valid = longEnough && hasNumber;
    const bars =
        Number(data.password.length >= 6) +
        Number(longEnough) +
        Number(valid) +
        Number(valid && data.password.length >= 14);
    const verdict =
        data.password.length === 0
            ? ''
            : !longEnough
              ? t('Too short')
              : !hasNumber
                ? t('Add a number')
                : t('Long enough');

    function submit(event: FormEvent) {
        event.preventDefault();
        form.post(store.url(token));
    }

    return (
        <div className="font-auth flex min-h-screen bg-bg text-text antialiased">
            <Head title={t('Set your password')} />
            <aside className="hidden w-[440px] shrink-0 flex-col justify-between border-r border-solid border-border bg-surface px-12 py-10 lg:flex">
                <div className="flex flex-col gap-20">
                    <LogoMark />
                    {member && (
                        <div className="flex flex-col gap-3">
                            <p className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-text-muted uppercase">
                                {t('Your record')}
                            </p>
                            <div className="flex flex-col gap-1">
                                <p className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text">
                                    {member.formal_name}
                                </p>
                                <p className="font-mono text-[12px] leading-4 text-text-muted">
                                    {[member.role_label, member.subjects.join(', ')]
                                        .filter(Boolean)
                                        .join(' · ')}
                                </p>
                            </div>
                            <dl className="flex flex-col gap-2 border-t border-solid border-border pt-3">
                                {[
                                    [t('School'), schoolName],
                                    [t('Portal role'), t(member.role_label)],
                                    [t('Subjects'), member.subjects.join(', ') || t('None assigned yet')],
                                ].map(([label, value]) => (
                                    <div key={label} className="flex items-baseline gap-3">
                                        <dt className="w-24 shrink-0 text-[12px] leading-[18px] text-text-muted">
                                            {label}
                                        </dt>
                                        <dd className="text-[13px] leading-[18px] font-medium text-text">
                                            {value}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                    )}
                </div>
                <div className="flex flex-col gap-2">
                    <p className="text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase">
                        {t('Only you know it')}
                    </p>
                    <p className="text-[14px] leading-[21px] text-text">
                        {t('Your password stays on your device. The school sees that you have joined, never what you type.')}
                    </p>
                </div>
            </aside>

            <main className="flex flex-1 flex-col gap-12 px-6 pt-10 pb-14 sm:px-24">
                <p className="flex h-5 w-full max-w-[592px] items-center justify-end gap-[6px] text-[14px] leading-[18px] text-text-muted">
                    {t('Already have a password?')}
                    <Link href="/login" className="font-semibold text-primary hover:underline">
                        {t('Sign in')}
                    </Link>
                </p>

                {member ? (
                    <>
                        <div className="w-full max-w-[592px]">
                            <FlowSteps active={2} compact />
                        </div>
                        <form
                            onSubmit={submit}
                            className="flex w-full max-w-[592px] flex-col gap-9"
                        >
                            <div className="flex flex-col gap-3">
                                <p className="text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase">
                                    {schoolName}
                                </p>
                                <h1 className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text sm:text-[40px] sm:leading-[44px]">
                                    {t('Set your password')}
                                </h1>
                                <p className="text-[16px] leading-6 text-text-muted">
                                    {t('Your school has registered you. Choose a password to open your portal account and see your classes.')}
                                </p>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label
                                    htmlFor="password"
                                    className="text-[13px] leading-4 font-medium text-text"
                                >
                                    {t('Password')}
                                </label>
                                <div className="flex h-14 items-center gap-3 rounded-md border border-solid border-border bg-surface px-4 focus-within:border-primary">
                                    <input
                                        id="password"
                                        type={visible ? 'text' : 'password'}
                                        value={data.password}
                                        onChange={(e) => setData('password', e.target.value)}
                                        autoComplete="new-password"
                                        aria-describedby="password-rule"
                                        className={`min-w-0 flex-1 bg-transparent font-mono text-[18px] leading-6 text-text outline-none ${visible ? '' : 'tracking-[0.18em]'}`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setVisible(!visible)}
                                        className="flex shrink-0 items-center gap-[10px] text-[12px] leading-4 font-medium text-primary"
                                    >
                                        {visible ? t('Hide') : t('Show')}
                                        <svg width="16" height="16" viewBox="0 0 24 24">
                                            <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" fill="none" stroke="#56625C" strokeWidth="1.7" strokeLinejoin="round" />
                                            <circle cx="12" cy="12" r="3" fill="none" stroke="#56625C" strokeWidth="1.7" />
                                        </svg>
                                    </button>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex flex-1 gap-1">
                                        {[0, 1, 2, 3].map((bar) => (
                                            <span
                                                key={bar}
                                                className={`h-1 flex-1 rounded-full ${bar < bars ? (valid ? 'bg-success' : 'bg-warning') : 'bg-border'}`}
                                            />
                                        ))}
                                    </div>
                                    <span
                                        aria-live="polite"
                                        className={`min-w-[80px] text-right text-[12px] leading-4 font-medium ${valid ? 'text-success' : 'text-text-muted'}`}
                                    >
                                        {verdict}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <p
                                        id="password-rule"
                                        className="text-[12px] leading-[18px] text-text-muted"
                                    >
                                        {t('At least :count characters, with one number.', { count: MIN_LENGTH })}
                                    </p>
                                    <span className="flex-1" />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setData('password', generatePassword());
                                            setVisible(true);
                                        }}
                                        className="text-[12px] leading-[18px] font-medium text-primary hover:underline"
                                    >
                                        {t('Generate a strong one')}
                                    </button>
                                </div>
                                {errors.password && (
                                    <p role="alert" className="text-[13px] leading-4 text-danger">
                                        {errors.password}
                                    </p>
                                )}
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                <button
                                    type="submit"
                                    disabled={processing || !valid}
                                    className="flex h-9 w-[252px] shrink-0 items-center rounded-md bg-primary px-4 text-[14px] leading-[18px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
                                >
                                    {t('Set my password')}
                                </button>
                                <p className="text-[13px] leading-[18px] text-text-muted">
                                    {t('You can change it later in your profile.')}
                                </p>
                            </div>

                            <div className="flex flex-col gap-[6px] border-t border-solid border-border pt-6">
                                <p className="text-[13px] leading-[18px] font-semibold text-text">
                                    {t('Why we ask')}
                                </p>
                                <p className="text-[13px] leading-5 text-text-muted">
                                    {t('This is the only step where you choose a password. From here on you sign in with it instead of a code.')}
                                </p>
                            </div>
                        </form>
                    </>
                ) : (
                    <div className="flex w-full max-w-[592px] flex-col gap-3">
                        <p className="text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase">
                            {schoolName}
                        </p>
                        <h1 className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text sm:text-[40px] sm:leading-[44px]">
                            {t('This link is no longer open')}
                        </h1>
                        <p className="text-[16px] leading-6 text-text-muted">
                            {t('Invitation links work for seven days and only once. Ask your school to send it again, or sign in if you have already chosen a password.')}
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
}

export default SetPassword;
