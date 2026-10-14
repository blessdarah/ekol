import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { useState, type ReactNode } from 'react';
import { storeDemo } from '@/actions/App/Http/Controllers/LandingController';
import { switchLocale } from '../components/shell/language-switch';
import Toasts from '../components/shell/toasts';
import { t, useLocale } from '../lib/i18n';

interface LandingProps {
    roles: string[];
    sizes: string[];
    dialCode: string;
}

const FEATURES = [
    { tag: '/ 20', title: 'Sequences and coefficients', body: 'Six sequences, term and annual averages, positions and the pass mark you set.' },
    { tag: 'XAF', title: 'Cash and mobile money', body: 'Installments and receipts for MoMo, Orange Money, bank slips and the bursar’s cash box.' },
    { tag: 'S1 · A2', title: 'Series from Form 4', body: 'Science and Arts series, electives and mid-year changes with a parent’s agreement.' },
    { tag: '2G', title: 'Light on data', body: 'Pages built to load on a weak connection, so marks still go in when the network is slow.' },
    { tag: 'EN · FR', title: 'Both official languages', body: 'For anglophone, francophone and bilingual schools, down to the report card.' },
    { tag: 'Private', title: 'Children’s data kept close', body: 'Religion, health and discipline seen only by the people who need them, never on reports.' },
];

const COMPARISON = [
    { what: 'Report cards', today: 'A week of copying marks into Excel', campus: 'Same day, sent to parents on WhatsApp' },
    { what: 'Who still owes fees', today: 'Counting receipt books', campus: 'One screen, with reminders' },
    { what: 'Timetable', today: 'Days on a board, clashes found in class', campus: 'Generated, clashes flagged before it is published' },
    { what: 'New year’s classes', today: 'Lists rewritten by hand', campus: 'Promote, place and confirm in one flow' },
];

const PLANS = [
    { name: 'Starter', detail: 'Up to 300 students', price: '75,000 XAF / term', featured: false, quote: false },
    { name: 'School · most schools', detail: 'Up to 1,500 students, every module', price: '180,000 XAF / term', featured: true, quote: false },
    { name: 'Group', detail: 'Several campuses or a board', price: 'Quote', featured: false, quote: true },
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

const fieldLabel = 'text-[13px] leading-4 text-[#C9D9CF]';

const fieldBox =
    'h-11 w-full rounded-[10px] border border-solid border-[#22382E] bg-[#0B1712] px-[14px] text-[15px] leading-[18px] text-[#EAF2EC] outline-none placeholder:text-[#5F7A6C] focus:border-[#7BD8A6]';

const sectionTitle = 'font-display text-[32px] leading-9 font-extrabold tracking-[-0.03em] text-[#EAF2EC] lg:text-[44px] lg:leading-[48px]';

function Tick({ children }: { children: ReactNode }) {
    return (
        <li className="flex gap-2 text-[15px] leading-[18px] text-[#C9D9CF]">
            <span aria-hidden="true">✓</span>
            {children}
        </li>
    );
}

function DemoForm({ roles, sizes, dialCode }: LandingProps) {
    const form = useForm({ school_name: '', role: roles[0] ?? '', students: sizes[1] ?? sizes[0] ?? '', whatsapp: '' });
    const errors = form.errors;

    function submit(event: { preventDefault(): void }) {
        event.preventDefault();
        form.post(storeDemo.url(), { preserveScroll: true, onSuccess: () => form.reset('school_name', 'whatsapp') });
    }

    return (
        <form
            id="demo"
            onSubmit={submit}
            className="flex w-full shrink-0 scroll-mt-24 flex-col gap-4 rounded-[18px] border border-solid border-[#22382E] bg-[#12221B] p-6 shadow-[0_30px_80px_#00000066] sm:p-8 lg:w-[460px]"
        >
            <h2 className="text-[22px] leading-7 font-bold text-[#EAF2EC]">{t('Get a 20-minute demo')}</h2>
            <p className="-mt-2 text-[14px] leading-[18px] text-[#8FA89A]">{t('We call you on WhatsApp at a time that suits you.')}</p>
            <label className="flex flex-col gap-[6px]">
                <span className={fieldLabel}>{t('School name')}</span>
                <input
                    type="text"
                    value={form.data.school_name}
                    onChange={(e) => form.setData('school_name', e.target.value)}
                    placeholder={t('e.g. Government High School…')}
                    className={fieldBox}
                />
                {errors.school_name && <span className="text-[13px] leading-4 text-[#F2A99F]">{errors.school_name}</span>}
            </label>
            <div className="flex gap-3">
                <label className="flex min-w-0 flex-1 flex-col gap-[6px]">
                    <span className={fieldLabel}>{t('Your role')}</span>
                    <select value={form.data.role} onChange={(e) => form.setData('role', e.target.value)} className={fieldBox}>
                        {roles.map((role) => (
                            <option key={role} value={role}>
                                {t(role)}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="flex w-[140px] shrink-0 flex-col gap-[6px]">
                    <span className={fieldLabel}>{t('Students')}</span>
                    <select value={form.data.students} onChange={(e) => form.setData('students', e.target.value)} className={fieldBox}>
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
                <span className="flex h-11 items-center gap-[10px] rounded-[10px] border border-solid border-[#22382E] bg-[#0B1712] px-[14px] focus-within:border-[#7BD8A6]">
                    <span className="shrink-0 text-[15px] leading-[18px] text-[#EAF2EC]">{dialCode}</span>
                    <input
                        type="tel"
                        inputMode="numeric"
                        value={form.data.whatsapp}
                        onChange={(e) => form.setData('whatsapp', e.target.value.replace(/[^\d ]/g, ''))}
                        placeholder="6 __ __ __ __"
                        className="w-full min-w-0 bg-transparent text-[15px] leading-[18px] text-[#EAF2EC] outline-none placeholder:text-[#5F7A6C]"
                    />
                </span>
                {errors.whatsapp && <span className="text-[13px] leading-4 text-[#F2A99F]">{errors.whatsapp}</span>}
            </label>
            <button
                type="submit"
                disabled={form.processing}
                className="flex h-12 shrink-0 items-center justify-center rounded-[10px] bg-[#7BD8A6] text-[15px] leading-[18px] font-bold text-[#0B1712] hover:bg-[#8FE3B5] disabled:opacity-60"
            >
                {t('Book my demo')}
            </button>
            <p className="text-center text-[12px] leading-[17px] text-[#5F7A6C]">
                {t('Prefer to try it alone?')}{' '}
                <Link href="/register" className="text-[#8FA89A] underline hover:text-[#EAF2EC]">
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
        <div className="font-auth min-h-screen bg-[oklab(19.1%_-0.020_0.005)] text-[#EAF2EC] antialiased">
            <Head title={t('School management for Cameroon')} />
            <Toasts />

            <header className={`flex h-[68px] items-center justify-between gap-4 border-b border-solid border-[#1E3329] ${gutter}`}>
                <Link href="/" className="flex shrink-0 items-center gap-[10px]">
                    <span className="h-[26px] w-[26px] shrink-0 rounded-[7px] bg-[#7BD8A6]" />
                    <span className="font-display text-[19px] leading-6 font-extrabold text-[#EAF2EC]">Campus</span>
                </Link>
                <nav aria-label={t('Sections')} className="hidden gap-7 text-[14px] leading-[18px] text-[#8FA89A] md:flex">
                    <a href="#features" className="hover:text-[#EAF2EC]">
                        {t('Features')}
                    </a>
                    <a href="#compare" className="hover:text-[#EAF2EC]">
                        {t('Compare')}
                    </a>
                    <a href="#pricing" className="hover:text-[#EAF2EC]">
                        {t('Pricing')}
                    </a>
                    <a href="#faq" className="hover:text-[#EAF2EC]">
                        {t('FAQ')}
                    </a>
                </nav>
                <div className="flex items-center gap-[10px]">
                    <div role="group" aria-label={t('Language')} className="flex items-center gap-1">
                        {Object.entries(locales).map(([code, name]) => (
                            <button
                                key={code}
                                type="button"
                                lang={code}
                                title={name}
                                aria-pressed={code === locale}
                                onClick={() => code !== locale && switchLocale(code)}
                                className={`flex h-7 min-w-8 items-center justify-center rounded-md px-[6px] font-mono text-[12px] leading-4 uppercase ${
                                    code === locale ? 'bg-[#163A2C] text-[#7BD8A6]' : 'text-[#8FA89A] hover:text-[#EAF2EC]'
                                }`}
                            >
                                {code}
                            </button>
                        ))}
                    </div>
                    <Link href="/parents" className="hidden px-[10px] text-[14px] leading-[18px] text-[#EAF2EC] hover:underline sm:block">
                        {t('Parents')}
                    </Link>
                    <Link href="/login" className="hidden px-[10px] text-[14px] leading-[18px] text-[#EAF2EC] hover:underline sm:block">
                        {t('Sign in')}
                    </Link>
                    <a href="#demo" className="flex h-9 shrink-0 items-center rounded-md bg-[#7BD8A6] px-4 text-[14px] leading-[18px] font-semibold text-[#0B1712] hover:bg-[#8FE3B5]">
                        {t('Book a demo')}
                    </a>
                </div>
            </header>

            <main>
                <section
                    className={`flex flex-col gap-10 pt-14 pb-16 lg:flex-row lg:items-center lg:gap-16 lg:pt-24 lg:pb-[104px] ${gutter}`}
                    style={{ backgroundImage: 'radial-gradient(circle farthest-corner at 20% 0% in oklab, oklab(31.7% -0.047 0.012) 0%, oklab(19.1% -0.020 0.005) 70%)' }}
                >
                    <div className="flex min-w-0 flex-1 flex-col gap-[26px]">
                        <p className="flex items-center gap-2 font-mono text-[13px] leading-4 text-[#7BD8A6]">
                            <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[#7BD8A6]" />
                            {t('First term free · set up with you in a day')}
                        </p>
                        <h1 className="font-display text-[40px] leading-[44px] font-extrabold tracking-[-0.035em] text-[#EAF2EC] lg:text-[62px] lg:leading-[64px]">
                            {t('Start the new school year without a single register book')}
                        </h1>
                        <p className="max-w-[560px] text-[18px] leading-7 text-[#8FA89A]">
                            {t('Campus moves your students, marks, fees and timetable online in a day. Your first term is free, and we do the setup with you.')}
                        </p>
                        <ul className="flex flex-col gap-3">
                            <Tick>{t('Report cards in an afternoon, not a week')}</Tick>
                            <Tick>{t('Every payment receipted, cash or mobile money')}</Tick>
                            <Tick>{t('Parents reached on WhatsApp, in English or French')}</Tick>
                        </ul>
                    </div>
                    <DemoForm roles={roles} sizes={sizes} dialCode={dialCode} />
                </section>

                <section id="features" className={`flex scroll-mt-6 flex-col gap-4 py-16 lg:py-24 ${gutter}`}>
                    <div className="flex flex-col gap-4 pb-7 lg:flex-row lg:items-end lg:justify-between">
                        <h2 className={`${sectionTitle} max-w-[640px]`}>{t('Built around how a Cameroonian school actually runs')}</h2>
                        <p className="max-w-[420px] text-[16px] leading-[25px] text-[#8FA89A]">
                            {t('Not adapted from a European or American product. Sequences, series, installments and WhatsApp come first.')}
                        </p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {FEATURES.map((feature) => (
                            <article key={feature.title} className="flex flex-col gap-[10px] rounded-2xl border border-solid border-[#22382E] bg-[#12221B] p-7">
                                <p className="font-mono text-[14px] leading-[18px] text-[#7BD8A6]">{feature.tag === 'Private' ? t('Private') : feature.tag}</p>
                                <h3 className="text-[18px] leading-[22px] font-bold text-[#EAF2EC]">{t(feature.title)}</h3>
                                <p className="text-[15px] leading-[23px] text-[#8FA89A]">{t(feature.body)}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section id="compare" className={`flex scroll-mt-6 flex-col gap-7 pb-16 lg:pb-24 ${gutter}`}>
                    <h2 className={sectionTitle}>{t('Notebooks and Excel, or Campus')}</h2>
                    <div className="flex flex-col overflow-clip rounded-2xl border border-solid border-[#22382E]">
                        <div className="hidden bg-[#12221B] px-6 py-4 text-[13px] leading-4 font-semibold tracking-[0.06em] uppercase md:flex">
                            <span className="w-[280px] shrink-0 text-[#8FA89A] lg:w-[360px]">{t('Each term')}</span>
                            <span className="flex-1 text-[#8FA89A]">{t('Today')}</span>
                            <span className="flex-1 text-[#7BD8A6]">{t('With Campus')}</span>
                        </div>
                        {COMPARISON.map((row) => (
                            <div
                                key={row.what}
                                className="flex flex-col gap-2 border-t border-solid border-[#22382E] px-6 py-[18px] text-[15px] leading-[18px] first:border-t-0 md:flex-row md:gap-0 md:first:border-t"
                            >
                                <span className="shrink-0 font-semibold text-[#EAF2EC] md:w-[280px] lg:w-[360px]">{t(row.what)}</span>
                                <span className="flex-1 text-[#8FA89A]">
                                    <span className="mr-2 text-[12px] font-semibold tracking-[0.06em] uppercase md:hidden">{t('Today')}</span>
                                    {t(row.today)}
                                </span>
                                <span className="flex-1 text-[#EAF2EC]">
                                    <span className="mr-2 text-[12px] font-semibold tracking-[0.06em] text-[#7BD8A6] uppercase md:hidden">{t('With Campus')}</span>
                                    {t(row.campus)}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className={`flex flex-col gap-14 border-t border-solid border-[#1E3329] py-16 lg:flex-row lg:py-24 ${gutter}`}>
                    <div id="pricing" className="flex shrink-0 scroll-mt-6 flex-col gap-4 lg:w-[560px]">
                        <h2 className="font-display text-[32px] leading-9 font-extrabold tracking-[-0.03em] text-[#EAF2EC] lg:text-[40px] lg:leading-[44px]">
                            {t('Simple pricing, per term')}
                        </h2>
                        <p className="text-[16px] leading-5 text-[#8FA89A]">{t('First term free. No card needed to start.')}</p>
                        {PLANS.map((plan) => (
                            <div
                                key={plan.name}
                                className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[14px] border border-solid px-[22px] py-5 ${
                                    plan.featured ? 'border-[#7BD8A6] bg-[#163A2C]' : 'border-[#22382E] bg-[#12221B]'
                                }`}
                            >
                                <div className="flex flex-col gap-1">
                                    <p className={`text-[17px] leading-[22px] font-bold ${plan.featured ? 'text-[#7BD8A6]' : 'text-[#EAF2EC]'}`}>{t(plan.name)}</p>
                                    <p className="text-[13px] leading-4 text-[#8FA89A]">{t(plan.detail)}</p>
                                </div>
                                <p className={`font-display text-[24px] leading-[30px] font-extrabold ${plan.quote ? 'text-[#EAF2EC]' : 'text-[#8FA89A]'}`}>{t(plan.price)}</p>
                            </div>
                        ))}
                        <p className="text-[12px] leading-4 text-[#5F7A6C]">{t('Sample prices for the design.')}</p>
                    </div>
                    <div id="faq" className="flex min-w-0 flex-1 scroll-mt-6 flex-col">
                        <h2 className="pb-3 text-[13px] leading-4 font-semibold tracking-[0.08em] text-[#7BD8A6] uppercase">{t('Questions schools ask')}</h2>
                        {QUESTIONS.map((item, position) => (
                            <div key={item.question} className="flex flex-col gap-[10px] border-t border-solid border-[#22382E] py-[22px] last:border-b">
                                <button
                                    type="button"
                                    aria-expanded={open === position}
                                    onClick={() => setOpen(open === position ? -1 : position)}
                                    className="flex justify-between gap-4 text-left text-[17px] leading-[22px] font-semibold text-[#EAF2EC]"
                                >
                                    {t(item.question)}
                                    <span aria-hidden="true" className={open === position ? 'text-[#7BD8A6]' : 'text-[#8FA89A]'}>
                                        {open === position ? '−' : '+'}
                                    </span>
                                </button>
                                {open === position && <p className="text-[15px] leading-[23px] text-[#8FA89A]">{t(item.answer)}</p>}
                            </div>
                        ))}
                    </div>
                </section>

                <section
                    className="mx-5 mb-[72px] flex flex-col gap-6 rounded-[22px] border border-solid border-[#2E5E49] bg-origin-border px-7 py-10 sm:mx-10 md:flex-row md:items-center md:justify-between lg:mx-[72px] lg:px-14 lg:py-12"
                    style={{ backgroundImage: 'linear-gradient(in oklab 120deg, oklab(31.7% -0.047 0.012) 0%, oklab(37.6% -0.068 0.015) 100%)' }}
                >
                    <div className="flex flex-col gap-[10px]">
                        <h2 className="font-display text-[30px] leading-9 font-extrabold tracking-[-0.03em] text-[#EAF2EC] lg:text-[38px] lg:leading-[46px]">
                            {t('Your first term is free')}
                        </h2>
                        <p className="text-[16px] leading-5 text-[#B9D8C9]">{t('Set up in a day. Cancel any time before the second term.')}</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Link href="/register" className="flex h-[50px] items-center rounded-[10px] bg-[#7BD8A6] px-6 text-[15px] leading-[18px] font-bold text-[#0B1712] hover:bg-[#8FE3B5]">
                            {t('Start free term')}
                        </Link>
                        <a href="#demo" className="flex h-[50px] items-center rounded-[10px] border border-solid border-[#7BD8A6] px-6 text-[15px] leading-[18px] font-semibold text-[#EAF2EC] hover:bg-[#163A2C]">
                            {t('Book a demo')}
                        </a>
                    </div>
                </section>
            </main>

            <footer className={`flex flex-wrap justify-between gap-4 border-t border-solid border-[#1E3329] pt-7 pb-10 text-[14px] leading-[18px] text-[#5F7A6C] ${gutter}`}>
                <p>{t('© Campus · school management for Cameroon')}</p>
                <nav aria-label={t('Footer')} className="flex gap-7">
                    <a href="#features" className="hover:text-[#8FA89A]">
                        {t('Features')}
                    </a>
                    <a href="#pricing" className="hover:text-[#8FA89A]">
                        {t('Pricing')}
                    </a>
                    <Link href="/parents" className="hover:text-[#8FA89A]">
                        {t('Parent services')}
                    </Link>
                    <Link href="/login" className="hover:text-[#8FA89A]">
                        {t('Sign in')}
                    </Link>
                </nav>
            </footer>
        </div>
    );
}
