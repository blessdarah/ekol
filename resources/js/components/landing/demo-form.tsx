import { Link } from '@inertiajs/react';
import { t } from '../../lib/i18n';
import { DemoThanks } from './demo-thanks';
import { type LandingProps, fieldBox, fieldLabel, useDemoForm } from './model';

/** Book a demo, or the thanks once one is booked. */
export function DemoForm(props: LandingProps) {
    const { roles, sizes, dialCode } = props;
    const demo = useDemoForm(props);
    const { form, errors, demoBooking, editing, submit } = demo;

    if (demoBooking && !editing) {
        return <DemoThanks demo={demo} demoBooking={demoBooking} />;
    }

    return (
        <form
            id="demo"
            onSubmit={submit}
            className="flex w-full shrink-0 scroll-mt-24 flex-col gap-4 rounded-[18px] border border-solid border-brand-border bg-brand-raised p-6 shadow-[0_30px_80px_color-mix(in_srgb,var(--color-overlay)_40%,transparent)] sm:p-8 lg:w-[460px]"
        >
            <h2 className="text-[22px] leading-7 font-bold text-primary-soft">
                {t('Get a 20-minute demo')}
            </h2>
            <p className="-mt-2 text-[14px] leading-[18px] text-primary-muted">
                {t('We call you on WhatsApp at a time that suits you.')}
            </p>
            <label className="flex flex-col gap-[6px]">
                <span className={fieldLabel}>{t('Your name')}</span>
                <input
                    required
                    value={form.data.contact_name}
                    onChange={(e) =>
                        form.setData('contact_name', e.target.value)
                    }
                    autoComplete="name"
                    className={fieldBox}
                />
                {errors.contact_name && (
                    <span
                        role="alert"
                        className="text-[13px] text-danger-on-dark"
                    >
                        {errors.contact_name}
                    </span>
                )}
            </label>
            <label className="flex flex-col gap-[6px]">
                <span className={fieldLabel}>{t('School name')}</span>
                <input
                    type="text"
                    value={form.data.school_name}
                    onChange={(e) =>
                        form.setData('school_name', e.target.value)
                    }
                    placeholder={t('e.g. Government High School…')}
                    className={fieldBox}
                />
                {errors.school_name && (
                    <span className="text-[13px] leading-4 text-danger-on-dark">
                        {errors.school_name}
                    </span>
                )}
            </label>
            <div className="flex gap-3">
                <label className="flex min-w-0 flex-1 flex-col gap-[6px]">
                    <span className={fieldLabel}>{t('Your role')}</span>
                    <select
                        value={form.data.role}
                        onChange={(e) => form.setData('role', e.target.value)}
                        className={fieldBox}
                    >
                        {roles.map((role) => (
                            <option key={role} value={role}>
                                {t(role)}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="flex w-[140px] shrink-0 flex-col gap-[6px]">
                    <span className={fieldLabel}>{t('Students')}</span>
                    <select
                        value={form.data.students}
                        onChange={(e) =>
                            form.setData('students', e.target.value)
                        }
                        className={fieldBox}
                    >
                        {sizes.map((size) => (
                            <option key={size} value={size}>
                                {t(size)}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            <label className="flex flex-col gap-[6px]">
                <span className={fieldLabel}>{t('WhatsApp number')}</span>
                <span className="flex h-11 items-center gap-[10px] rounded-[10px] border border-solid border-brand-border bg-brand-bg px-[14px] focus-within:border-brand-accent">
                    <span className="shrink-0 text-[15px] leading-[18px] text-primary-soft">
                        {dialCode}
                    </span>
                    <input
                        type="tel"
                        inputMode="numeric"
                        value={form.data.whatsapp}
                        onChange={(e) =>
                            form.setData(
                                'whatsapp',
                                e.target.value.replace(/[^\d ]/g, ''),
                            )
                        }
                        placeholder="6 __ __ __ __"
                        className="w-full min-w-0 bg-transparent text-[15px] leading-[18px] text-primary-soft outline-none placeholder:text-brand-muted"
                    />
                </span>
                {errors.whatsapp && (
                    <span className="text-[13px] leading-4 text-danger-on-dark">
                        {errors.whatsapp}
                    </span>
                )}
            </label>
            <label className="flex flex-col gap-[6px]">
                <span className={fieldLabel}>{t('Email (optional)')}</span>
                <input
                    type="email"
                    value={form.data.email}
                    onChange={(e) => form.setData('email', e.target.value)}
                    autoComplete="email"
                    placeholder={t('For a copy of your demo link')}
                    className={fieldBox}
                />
                {errors.email && (
                    <span
                        role="alert"
                        className="text-[13px] text-danger-on-dark"
                    >
                        {errors.email}
                    </span>
                )}
            </label>
            <button
                type="submit"
                disabled={form.processing}
                className="flex h-12 shrink-0 items-center justify-center rounded-[10px] bg-brand-accent text-[15px] leading-[18px] font-bold text-brand-bg hover:bg-success-on-dark disabled:opacity-60"
            >
                {t('Book my demo')}
            </button>
            <p className="text-center text-[12px] leading-[17px] text-brand-muted">
                {t('Prefer to try it alone?')}{' '}
                <Link
                    href="/register"
                    className="text-primary-muted underline hover:text-primary-soft"
                >
                    {t('Start your free term')}
                </Link>
            </p>
        </form>
    );
}
