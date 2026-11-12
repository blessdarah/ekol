import { useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { storeDemo } from '@/actions/App/Http/Controllers/LandingController';
import { useLocale } from '../../lib/i18n';

export interface LandingProps {
    roles: string[];
    sizes: string[];
    dialCode: string;
}

export const FEATURES = [
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

export const COMPARISON = [
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

export const PLANS = [
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

export const QUESTIONS = [
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

export const gutter = 'px-5 sm:px-10 lg:px-[72px]';

export const fieldLabel = 'text-[13px] leading-4 text-brand-text';

export const fieldBox =
    'h-11 w-full rounded-[10px] border border-solid border-brand-border bg-brand-bg px-[14px] text-[15px] leading-[18px] text-primary-soft outline-none placeholder:text-brand-muted focus:border-brand-accent';

export const sectionTitle =
    'font-display text-[32px] leading-9 font-extrabold tracking-[-0.03em] text-primary-soft lg:text-[44px] lg:leading-[48px]';

/** The language in use and the open question. */
export function useLanding() {
    const locale = useLocale();
    const locales = (usePage().props.locales ?? {}) as Record<string, string>;
    const [open, setOpen] = useState(0);

    return { locale, locales, open, setOpen };
}

export type LandingModel = ReturnType<typeof useLanding>;

/** The demo request, or the booking already made and a way to change it. */
export function useDemoForm({ roles, sizes }: LandingProps) {
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

    return { form, errors, demoBooking, editing, setEditing, submit };
}

export type DemoFormModel = ReturnType<typeof useDemoForm>;
