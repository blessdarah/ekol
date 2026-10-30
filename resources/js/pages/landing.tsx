import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { useState, type ReactNode } from 'react';
import { storeDemo } from '@/actions/App/Http/Controllers/LandingController';
import { showSchoolStep } from '@/actions/App/Http/Controllers/Auth/RegistrationController';
import { switchLocale } from '../components/shell/language-switch';
import Toasts from '../components/shell/toasts';
import { t, useLocale } from '../lib/i18n';

interface LandingProps {
    roles: string[];
    sizes: string[];
    dialCode: string;
}

const FEATURES = [
    {
        tag: '/ 20',
        title: 'Sequences and coefficients',
        body: 'Six sequences, term and annual averages, positions and the pass mark you set.',
    },
    {
        tag: 'XAF',
        title: 'Cash and mobile money',
        body: 'Installments and receipts for MoMo, Orange Money, bank slips and the bursar’s cash box.',
    },
    {
        tag: 'S1 · A2',
        title: 'Series from Form 4',
        body: 'Science and Arts series, electives and mid-year changes with a parent’s agreement.',
    },
    {
        tag: '2G',
        title: 'Light on data',
        body: 'Pages built to load on a weak connection, so marks still go in when the network is slow.',
    },
    {
        tag: 'EN · FR',
        title: 'Both official languages',
        body: 'For anglophone, francophone and bilingual schools, down to the report card.',
    },
    {
        tag: 'Private',
        title: 'Children’s data kept close',
        body: 'Religion, health and discipline seen only by the people who need them, never on reports.',
    },
];

const COMPARISON = [
    {
        what: 'Report cards',
        today: 'A week of copying marks into Excel',
        campus: 'Same day, sent to parents on WhatsApp',
    },
    {
        what: 'Who still owes fees',
        today: 'Counting receipt books',
        campus: 'One screen, with reminders',
    },
    {
        what: 'Timetable',
        today: 'Days on a board, clashes found in class',
        campus: 'Generated, clashes flagged before it is published',
    },
    {
        what: 'New year’s classes',
        today: 'Lists rewritten by hand',
        campus: 'Promote, place and confirm in one flow',
    },
];

const PLANS = [
    {
        name: 'Starter',
        detail: 'Up to 300 students',
        price: '75,000 XAF / term',
        featured: false,
        quote: false,
    },
    {
        name: 'School · most schools',
        detail: 'Up to 1,500 students, every module',
        price: '180,000 XAF / term',
        featured: true,
        quote: false,
    },
    {
        name: 'Group',
        detail: 'Several campuses or a board',
        price: 'Quote',
        featured: false,
        quote: true,
    },
];

const QUESTIONS = [
    {
        question: 'We already have students in Excel. Do we start again?',
        answer: 'No. Send the file and we import it with you, including classes, parents’ numbers and fee balances.',
    },
    {
        question: 'Do teachers need a computer?',
        answer: 'A phone is enough for attendance and marks. A computer is more comfortable for the timetable and for printing report cards.',
    },
    {
        question: 'What happens when the internet is down?',
        answer: 'A register a teacher is marking is kept on the phone and saved once the connection is back. Other pages need a connection, and are built to load on a slow one.',
    },
    {
        question: 'How do we pay for the subscription?',
        answer: 'Once a term, by mobile money or bank transfer. The first term costs nothing and needs no card.',
    },
    {
        question: 'Who can see a student’s private details?',
        answer: 'Only the principal and the administrator see religion and disability. They never appear on report cards or receipts.',
    },
];

const gutter = 'px-5 sm:px-10 lg:px-[72px]';

const fieldLabel = 'text-[13px] leading-4 text-brand-text';

const fieldBox =
    'h-11 w-full rounded-[10px] border border-solid border-brand-border bg-brand-bg px-[14px] text-[15px] leading-[18px] text-primary-soft outline-none placeholder:text-brand-muted focus:border-brand-accent';

const sectionTitle =
    'font-display text-[32px] leading-9 font-extrabold tracking-[-0.03em] text-primary-soft lg:text-[44px] lg:leading-[48px]';

function Tick({ children }: { children: ReactNode }) {
    return (
        <li className="flex gap-2 text-[15px] leading-[18px] text-brand-text">
            <span aria-hidden="true">✓</span>
            {children}
        </li>
    );
}

function DemoForm({ roles, sizes, dialCode }: LandingProps) {
    const form = useForm({
        contact_name: '',
        email: '',
        school_name: '',
        role: roles[0] ?? '',
        students: sizes[1] ?? sizes[0] ?? '',
        whatsapp: '',
    });
    const errors = form.errors;
    const { demoBooking } = usePage<{
        demoBooking: {
            contact_name: string | null;
            school_name: string;
            whatsapp: string;
        } | null;
    }>().props;
    const [editing, setEditing] = useState(false);

    if (demoBooking && !editing) {
        return (
            <section
                id="demo"
                className="flex w-full shrink-0 scroll-mt-24 flex-col gap-5 rounded-[18px] border border-solid border-brand-border bg-brand-raised p-6 sm:p-8 lg:w-[460px]"
            >
                <h2 className="text-[22px] font-bold text-primary-soft">
                    {t('Thank you')}
                    {demoBooking.contact_name
                        ? `, ${demoBooking.contact_name.split(' ')[0]}`
                        : ''}
                </h2>
                <p className="text-[14px] leading-5 text-primary-muted">
                    {t('Your demo request for :school is in.', {
                        school: demoBooking.school_name,
                    })}
                </p>
                <ol className="flex flex-col gap-5 text-[14px] leading-5">
                    <li>
                        {t('Request received')}
                        <p className="text-primary-muted">
                            {demoBooking.whatsapp}
                        </p>
                    </li>
                    <li>
                        {t(
                            'We message you on WhatsApp within one working day to arrange a 20-minute call.',
                        )}
                    </li>
                    <li>
                        {t(
                            'After the call, you get your own demo school to try for 14 days.',
                        )}
                    </li>
                </ol>
                <button
                    type="button"
                    onClick={() => {
                        form.setData({
                            ...form.data,
                            contact_name: demoBooking.contact_name ?? '',
                            school_name: demoBooking.school_name,
                            whatsapp: demoBooking.whatsapp.replace(
                                /^\+237/,
                                '',
                            ),
                        });
                        setEditing(true);
                    }}
                    className="text-left text-[13px] text-primary-muted underline"
                >
                    {t('Wrong number? Change it')}
                </button>
                <Link
                    href={showSchoolStep()}
                    className="text-[13px] text-primary-muted underline"
                >
                    {t('Start your free term')}
                </Link>
            </section>
        );
    }

    function submit(event: { preventDefault(): void }) {
        event.preventDefault();
        form.post(storeDemo.url(), {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setEditing(false);
            },
        });
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

export default function Landing({ roles, sizes, dialCode }: LandingProps) {
    const locale = useLocale();
    const locales = (usePage().props.locales ?? {}) as Record<string, string>;
    const [open, setOpen] = useState(0);

    return (
        <div className="min-h-screen bg-[oklab(19.1%_-0.020_0.005)] font-auth text-primary-soft antialiased">
            <Head title={t('School management for Cameroon')} />
            <Toasts />

            <header
                className={`flex h-[68px] items-center justify-between gap-4 border-b border-solid border-brand-surface ${gutter}`}
            >
                <Link
                    href="/"
                    className="flex shrink-0 items-center gap-[10px]"
                >
                    <span className="h-[26px] w-[26px] shrink-0 rounded-[7px] bg-brand-accent" />
                    <span className="font-display text-[19px] leading-6 font-extrabold text-primary-soft">
                        Campus
                    </span>
                </Link>
                <nav
                    aria-label={t('Sections')}
                    className="hidden gap-7 text-[14px] leading-[18px] text-primary-muted md:flex"
                >
                    <a href="#features" className="hover:text-primary-soft">
                        {t('Features')}
                    </a>
                    <a href="#compare" className="hover:text-primary-soft">
                        {t('Compare')}
                    </a>
                    <a href="#pricing" className="hover:text-primary-soft">
                        {t('Pricing')}
                    </a>
                    <a href="#faq" className="hover:text-primary-soft">
                        {t('FAQ')}
                    </a>
                </nav>
                <div className="flex items-center gap-[10px]">
                    <div
                        role="group"
                        aria-label={t('Language')}
                        className="flex items-center gap-1"
                    >
                        {Object.entries(locales).map(([code, name]) => (
                            <button
                                key={code}
                                type="button"
                                lang={code}
                                title={name}
                                aria-pressed={code === locale}
                                onClick={() =>
                                    code !== locale && switchLocale(code)
                                }
                                className={`flex h-7 min-w-8 items-center justify-center rounded-md px-[6px] font-mono text-[12px] leading-4 uppercase ${
                                    code === locale
                                        ? 'bg-brand-highlight text-brand-accent'
                                        : 'text-primary-muted hover:text-primary-soft'
                                }`}
                            >
                                {code}
                            </button>
                        ))}
                    </div>
                    <Link
                        href="/parents"
                        className="hidden px-[10px] text-[14px] leading-[18px] text-primary-soft hover:underline sm:block"
                    >
                        {t('Parents')}
                    </Link>
                    <Link
                        href="/login"
                        className="hidden px-[10px] text-[14px] leading-[18px] text-primary-soft hover:underline sm:block"
                    >
                        {t('Sign in')}
                    </Link>
                    <a
                        href="#demo"
                        className="flex h-9 shrink-0 items-center rounded-md bg-brand-accent px-4 text-[14px] leading-[18px] font-semibold text-brand-bg hover:bg-success-on-dark"
                    >
                        {t('Book a demo')}
                    </a>
                </div>
            </header>

            <main>
                <section
                    className={`flex flex-col gap-10 pt-14 pb-16 lg:flex-row lg:items-center lg:gap-16 lg:pt-24 lg:pb-[104px] ${gutter}`}
                    style={{
                        backgroundImage:
                            'radial-gradient(circle farthest-corner at 20% 0% in oklab, oklab(31.7% -0.047 0.012) 0%, oklab(19.1% -0.020 0.005) 70%)',
                    }}
                >
                    <div className="flex min-w-0 flex-1 flex-col gap-[26px]">
                        <p className="flex items-center gap-2 font-mono text-[13px] leading-4 text-brand-accent">
                            <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-brand-accent" />
                            {t('First term free · set up with you in a day')}
                        </p>
                        <h1 className="font-display text-[40px] leading-[44px] font-extrabold tracking-[-0.035em] text-primary-soft lg:text-[62px] lg:leading-[64px]">
                            {t(
                                'Start the new school year without a single register book',
                            )}
                        </h1>
                        <p className="max-w-[560px] text-[18px] leading-7 text-primary-muted">
                            {t(
                                'Campus moves your students, marks, fees and timetable online in a day. Your first term is free, and we do the setup with you.',
                            )}
                        </p>
                        <ul className="flex flex-col gap-3">
                            <Tick>
                                {t('Report cards in an afternoon, not a week')}
                            </Tick>
                            <Tick>
                                {t(
                                    'Every payment receipted, cash or mobile money',
                                )}
                            </Tick>
                            <Tick>
                                {t(
                                    'Parents reached on WhatsApp, in English or French',
                                )}
                            </Tick>
                        </ul>
                    </div>
                    <DemoForm roles={roles} sizes={sizes} dialCode={dialCode} />
                </section>

                <section
                    id="features"
                    className={`flex scroll-mt-6 flex-col gap-4 py-16 lg:py-24 ${gutter}`}
                >
                    <div className="flex flex-col gap-4 pb-7 lg:flex-row lg:items-end lg:justify-between">
                        <h2 className={`${sectionTitle} max-w-[640px]`}>
                            {t(
                                'Built around how a Cameroonian school actually runs',
                            )}
                        </h2>
                        <p className="max-w-[420px] text-[16px] leading-[25px] text-primary-muted">
                            {t(
                                'Not adapted from a European or American product. Sequences, series, installments and WhatsApp come first.',
                            )}
                        </p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {FEATURES.map((feature) => (
                            <article
                                key={feature.title}
                                className="flex flex-col gap-[10px] rounded-2xl border border-solid border-brand-border bg-brand-raised p-7"
                            >
                                <p className="font-mono text-[14px] leading-[18px] text-brand-accent">
                                    {feature.tag === 'Private'
                                        ? t('Private')
                                        : feature.tag}
                                </p>
                                <h3 className="text-[18px] leading-[22px] font-bold text-primary-soft">
                                    {t(feature.title)}
                                </h3>
                                <p className="text-[15px] leading-[23px] text-primary-muted">
                                    {t(feature.body)}
                                </p>
                            </article>
                        ))}
                    </div>
                </section>

                <section
                    id="compare"
                    className={`flex scroll-mt-6 flex-col gap-7 pb-16 lg:pb-24 ${gutter}`}
                >
                    <h2 className={sectionTitle}>
                        {t('Notebooks and Excel, or Campus')}
                    </h2>
                    <div className="flex flex-col overflow-clip rounded-2xl border border-solid border-brand-border">
                        <div className="hidden bg-brand-raised px-6 py-4 text-[13px] leading-4 font-semibold tracking-[0.06em] uppercase md:flex">
                            <span className="w-[280px] shrink-0 text-primary-muted lg:w-[360px]">
                                {t('Each term')}
                            </span>
                            <span className="flex-1 text-primary-muted">
                                {t('Today')}
                            </span>
                            <span className="flex-1 text-brand-accent">
                                {t('With Campus')}
                            </span>
                        </div>
                        {COMPARISON.map((row) => (
                            <div
                                key={row.what}
                                className="flex flex-col gap-2 border-t border-solid border-brand-border px-6 py-[18px] text-[15px] leading-[18px] first:border-t-0 md:flex-row md:gap-0 md:first:border-t"
                            >
                                <span className="shrink-0 font-semibold text-primary-soft md:w-[280px] lg:w-[360px]">
                                    {t(row.what)}
                                </span>
                                <span className="flex-1 text-primary-muted">
                                    <span className="mr-2 text-[12px] font-semibold tracking-[0.06em] uppercase md:hidden">
                                        {t('Today')}
                                    </span>
                                    {t(row.today)}
                                </span>
                                <span className="flex-1 text-primary-soft">
                                    <span className="mr-2 text-[12px] font-semibold tracking-[0.06em] text-brand-accent uppercase md:hidden">
                                        {t('With Campus')}
                                    </span>
                                    {t(row.campus)}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>

                <section
                    className={`flex flex-col gap-14 border-t border-solid border-brand-surface py-16 lg:flex-row lg:py-24 ${gutter}`}
                >
                    <div
                        id="pricing"
                        className="flex shrink-0 scroll-mt-6 flex-col gap-4 lg:w-[560px]"
                    >
                        <h2 className="font-display text-[32px] leading-9 font-extrabold tracking-[-0.03em] text-primary-soft lg:text-[40px] lg:leading-[44px]">
                            {t('Simple pricing, per term')}
                        </h2>
                        <p className="text-[16px] leading-5 text-primary-muted">
                            {t('First term free. No card needed to start.')}
                        </p>
                        {PLANS.map((plan) => (
                            <div
                                key={plan.name}
                                className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[14px] border border-solid px-[22px] py-5 ${
                                    plan.featured
                                        ? 'border-brand-accent bg-brand-highlight'
                                        : 'border-brand-border bg-brand-raised'
                                }`}
                            >
                                <div className="flex flex-col gap-1">
                                    <p
                                        className={`text-[17px] leading-[22px] font-bold ${plan.featured ? 'text-brand-accent' : 'text-primary-soft'}`}
                                    >
                                        {t(plan.name)}
                                    </p>
                                    <p className="text-[13px] leading-4 text-primary-muted">
                                        {t(plan.detail)}
                                    </p>
                                </div>
                                <p
                                    className={`font-display text-[24px] leading-[30px] font-extrabold ${plan.quote ? 'text-primary-soft' : 'text-primary-muted'}`}
                                >
                                    {t(plan.price)}
                                </p>
                            </div>
                        ))}
                        <p className="text-[12px] leading-4 text-brand-muted">
                            {t('Sample prices for the design.')}
                        </p>
                    </div>
                    <div
                        id="faq"
                        className="flex min-w-0 flex-1 scroll-mt-6 flex-col"
                    >
                        <h2 className="pb-3 text-[13px] leading-4 font-semibold tracking-[0.08em] text-brand-accent uppercase">
                            {t('Questions schools ask')}
                        </h2>
                        {QUESTIONS.map((item, position) => (
                            <div
                                key={item.question}
                                className="flex flex-col gap-[10px] border-t border-solid border-brand-border py-[22px] last:border-b"
                            >
                                <button
                                    type="button"
                                    aria-expanded={open === position}
                                    onClick={() =>
                                        setOpen(
                                            open === position ? -1 : position,
                                        )
                                    }
                                    className="flex justify-between gap-4 text-left text-[17px] leading-[22px] font-semibold text-primary-soft"
                                >
                                    {t(item.question)}
                                    <span
                                        aria-hidden="true"
                                        className={
                                            open === position
                                                ? 'text-brand-accent'
                                                : 'text-primary-muted'
                                        }
                                    >
                                        {open === position ? '−' : '+'}
                                    </span>
                                </button>
                                {open === position && (
                                    <p className="text-[15px] leading-[23px] text-primary-muted">
                                        {t(item.answer)}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </section>

                <section
                    className="mx-5 mb-[72px] flex flex-col gap-6 rounded-[22px] border border-solid border-brand-active bg-origin-border px-7 py-10 sm:mx-10 md:flex-row md:items-center md:justify-between lg:mx-[72px] lg:px-14 lg:py-12"
                    style={{
                        backgroundImage:
                            'linear-gradient(in oklab 120deg, oklab(31.7% -0.047 0.012) 0%, oklab(37.6% -0.068 0.015) 100%)',
                    }}
                >
                    <div className="flex flex-col gap-[10px]">
                        <h2 className="font-display text-[30px] leading-9 font-extrabold tracking-[-0.03em] text-primary-soft lg:text-[38px] lg:leading-[46px]">
                            {t('Your first term is free')}
                        </h2>
                        <p className="text-[16px] leading-5 text-brand-detail">
                            {t(
                                'Set up in a day. Cancel any time before the second term.',
                            )}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Link
                            href="/register"
                            className="flex h-[50px] items-center rounded-[10px] bg-brand-accent px-6 text-[15px] leading-[18px] font-bold text-brand-bg hover:bg-success-on-dark"
                        >
                            {t('Start free term')}
                        </Link>
                        <a
                            href="#demo"
                            className="flex h-[50px] items-center rounded-[10px] border border-solid border-brand-accent px-6 text-[15px] leading-[18px] font-semibold text-primary-soft hover:bg-brand-highlight"
                        >
                            {t('Book a demo')}
                        </a>
                    </div>
                </section>
            </main>

            <footer
                className={`flex flex-wrap justify-between gap-4 border-t border-solid border-brand-surface pt-7 pb-10 text-[14px] leading-[18px] text-brand-muted ${gutter}`}
            >
                <p>{t('© Campus · school management for Cameroon')}</p>
                <nav aria-label={t('Footer')} className="flex gap-7">
                    <a href="#features" className="hover:text-primary-muted">
                        {t('Features')}
                    </a>
                    <a href="#pricing" className="hover:text-primary-muted">
                        {t('Pricing')}
                    </a>
                    <Link href="/parents" className="hover:text-primary-muted">
                        {t('Parent services')}
                    </Link>
                    <Link href="/login" className="hover:text-primary-muted">
                        {t('Sign in')}
                    </Link>
                </nav>
            </footer>
        </div>
    );
}
