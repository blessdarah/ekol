import { Head, Link, useForm } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import {
    index,
    show,
    siblingCheck,
    store,
    update,
} from '@/actions/App/Http/Controllers/StudentController';
import {
    ErrorText,
    capsLabelClass,
    fieldInputClass,
    fieldLabelClass,
    outlineButtonClass,
    segmentClass,
    solidButtonClass,
} from '../../components/structure/ui';
import { StudentHeader, money, shortDate } from '../../components/students/ui';
import { withAppShell } from '../../layouts/app-layout';

interface GuardianForm {
    name: string;
    phone: string;
    occupation: string;
}

type Relation = 'father' | 'mother' | 'guardian';

interface RegisterProps {
    yearLabel: string | null;
    currency: string;
    matricule: string;
    canSeePrivate: boolean;
    religions: string[];
    disabilityTypes: string[];
    livesWithOptions: string[];
    levels: { id: string; name: string; uses_series: boolean }[];
    classes: { id: string; name: string; level_id: string; capacity: number; students: number }[];
    series: { id: string; code: string; name: string; stream: string; level_id: string }[];
    feePlans: {
        level_id: string;
        amount: number;
        items: { name: string; amount: number }[];
        installments: { seq: number; due_on: string | null; amount: number }[];
    }[];
    student: {
        id: string;
        surname: string;
        given_names: string;
        date_of_birth: string;
        gender: string;
        place_of_birth: string | null;
        religion: string | null;
        has_disability: boolean;
        disability_types: string[];
        disability_support: string | null;
        transferred: boolean;
        previous_school: string | null;
        previous_class: string | null;
        previous_year_left: number | null;
        transfer_certificate_received: boolean;
        last_report_received: boolean;
        on_whatsapp: boolean;
        lives_with: string | null;
        class_id: string | null;
        series_id: string | null;
        guardians: { relation: string; name: string; phone: string | null; occupation: string | null; is_main: boolean }[];
    } | null;
}

interface Sibling {
    id: string;
    name: string;
    matricule: string;
    relation: string;
}

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

const smallInputClass =
    'h-9 w-full rounded-md border border-solid border-border bg-white px-3 text-[14px] leading-[18px] text-text outline-none focus:border-primary';

function YesNo({
    label,
    value,
    onChange,
}: {
    label: string;
    value: boolean;
    onChange: (next: boolean) => void;
}) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <span className={fieldLabelClass}>{label}</span>
            <div role="radiogroup" aria-label={label} className="flex w-[200px] shrink-0 gap-2">
                {[false, true].map((option) => (
                    <button
                        key={String(option)}
                        type="button"
                        role="radio"
                        aria-checked={value === option}
                        onClick={() => onChange(option)}
                        className={`${segmentClass(value === option)} h-[34px]`}
                    >
                        {option ? 'Yes' : 'No'}
                    </button>
                ))}
            </div>
        </div>
    );
}

function Tick({
    checked,
    onChange,
    children,
}: {
    checked: boolean;
    onChange: (next: boolean) => void;
    children: React.ReactNode;
}) {
    return (
        <label className="flex cursor-pointer items-center gap-[10px] text-[13px] leading-[18px] text-text">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="h-[18px] w-[18px] shrink-0 accent-primary"
            />
            {children}
        </label>
    );
}

function Check({ tone, children }: { tone: 'done' | 'todo' | 'warn'; children: React.ReactNode }) {
    const dot = { done: 'bg-success', todo: 'bg-border', warn: 'bg-warning' }[tone];

    return (
        <li className="flex items-start gap-2 text-[13px] leading-[18px] text-text-muted">
            <span className={`mt-[6px] h-[6px] w-[6px] shrink-0 rounded-full ${dot}`} />
            {children}
        </li>
    );
}

function guardianOf(student: RegisterProps['student'], relation: Relation): GuardianForm {
    const found = student?.guardians.find((guardian) => guardian.relation === relation);

    return {
        name: found?.name ?? '',
        phone: found?.phone ?? '',
        occupation: found?.occupation ?? '',
    };
}

function Register(props: RegisterProps) {
    const { student, classes, levels, series, feePlans, currency, canSeePrivate } = props;
    const startClass = classes.find((option) => option.id === student?.class_id);
    const form = useForm({
        surname: student?.surname ?? '',
        given_names: student?.given_names ?? '',
        date_of_birth: student?.date_of_birth ?? '',
        gender: student?.gender ?? '',
        place_of_birth: student?.place_of_birth ?? '',
        religion: student?.religion ?? '',
        has_disability: student?.has_disability ?? false,
        disability_types: student?.disability_types ?? [],
        disability_support: student?.disability_support ?? '',
        transferred: student?.transferred ?? false,
        previous_school: student?.previous_school ?? '',
        previous_class: student?.previous_class ?? '',
        previous_year_left: student?.previous_year_left?.toString() ?? '',
        transfer_certificate_received: student?.transfer_certificate_received ?? false,
        last_report_received: student?.last_report_received ?? false,
        on_whatsapp: student?.on_whatsapp ?? true,
        lives_with: student?.lives_with ?? '',
        class_id: student?.class_id ?? '',
        series_id: student?.series_id ?? '',
        main_contact: (student?.guardians.find((guardian) => guardian.is_main)?.relation ?? 'father') as Relation,
        allow_duplicate: false,
    });
    const { data, setData, processing } = form;
    const errors = form.errors as Record<string, string>;
    const [levelId, setLevelId] = useState(startClass?.level_id ?? '');
    const [guardians, setGuardians] = useState<Record<Relation, GuardianForm>>({
        father: guardianOf(student, 'father'),
        mother: guardianOf(student, 'mother'),
        guardian: guardianOf(student, 'guardian'),
    });
    const [showGuardian, setShowGuardian] = useState(
        !!student?.guardians.some((guardian) => guardian.relation === 'guardian'),
    );
    const [sibling, setSibling] = useState<Sibling | null>(null);
    const [linked, setLinked] = useState<string | null>(null);
    const [dismissed, setDismissed] = useState<string | null>(null);

    const level = levels.find((option) => option.id === levelId);
    const levelClasses = classes.filter((option) => option.level_id === levelId);
    const chosenClass = classes.find((option) => option.id === data.class_id);
    const levelSeries = series.filter((option) => option.level_id === levelId);
    const plan = feePlans.find((option) => option.level_id === levelId);
    const main = guardians[data.main_contact];
    const mainPhone = main.phone.trim();
    const classHasRoom =
        !!chosenClass &&
        (chosenClass.students < chosenClass.capacity || chosenClass.id === student?.class_id);
    const guardianError = Object.entries(errors).find(([key]) => key.startsWith('guardians'))?.[1];

    // Another student whose parent has this phone is probably a sibling.
    useEffect(() => {
        const digits = mainPhone.replace(/\D/g, '');

        if (digits.length < 9) {
            setSibling(null);

            return;
        }

        const controller = new AbortController();
        const timer = setTimeout(() => {
            const query: Record<string, string> = { phone: digits };

            if (student) {
                query.exclude = student.id;
            }

            fetch(siblingCheck.url({ query }), {
                headers: { Accept: 'application/json' },
                signal: controller.signal,
            })
                .then((response) => (response.ok ? response.json() : { sibling: null }))
                .then((body: { sibling: Sibling | null }) => setSibling(body.sibling))
                .catch(() => undefined);
        }, 400);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [mainPhone, student]);

    function setGuardian(relation: Relation, patch: Partial<GuardianForm>) {
        setGuardians({ ...guardians, [relation]: { ...guardians[relation], ...patch } });
    }

    function chooseLevel(id: string) {
        setLevelId(id);
        setData({ ...data, class_id: '', series_id: '' });
    }

    function toggleType(type: string) {
        setData(
            'disability_types',
            data.disability_types.includes(type)
                ? data.disability_types.filter((other) => other !== type)
                : [...data.disability_types, type],
        );
    }

    function submit(another: boolean) {
        form.transform((values) => ({
            ...values,
            religion: values.religion || null,
            previous_year_left: values.previous_year_left || null,
            lives_with: values.lives_with || null,
            series_id: values.series_id || null,
            link_sibling_id: linked,
            another,
            guardians: (['father', 'mother', 'guardian'] as Relation[])
                .filter((relation) => guardians[relation].name.trim() !== '')
                .map((relation) => ({
                    relation,
                    name: guardians[relation].name,
                    phone: guardians[relation].phone || null,
                    occupation: guardians[relation].occupation || null,
                })),
        }));

        if (student) {
            form.patch(update.url(student.id));
        } else {
            form.post(store.url());
        }
    }

    const relations: Relation[] = showGuardian
        ? ['father', 'mother', 'guardian']
        : ['father', 'mother'];

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                submit(false);
            }}
            className="flex flex-col gap-6"
        >
            <Head title={student ? 'Edit a student' : 'Register a student'} />
            <StudentHeader
                trail={
                    student
                        ? [
                              {
                                  label: `${student.surname} ${student.given_names}`.trim(),
                                  href: show.url(student.id),
                              },
                              { label: 'Edit' },
                          ]
                        : [{ label: 'Add student' }]
                }
                title={student ? 'Edit a student' : 'Register a student'}
                tag={`Enrolment${props.yearLabel ? ` · ${props.yearLabel}` : ''}`}
                meta="identity, background, class, parents and fees in one go"
            />

            <div className="flex flex-col gap-8 lg:flex-row">
                <div className="flex min-w-0 flex-1 flex-col gap-7">
                    <section className="flex flex-col gap-[14px]">
                        <p className={capsLabelClass}>Student</p>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <label className={`flex flex-1 flex-col gap-2 ${fieldLabelClass}`}>
                                Surname
                                <input
                                    type="text"
                                    value={data.surname}
                                    onChange={(e) => setData('surname', e.target.value)}
                                    className={fieldInputClass}
                                />
                                <ErrorText message={errors.surname} />
                            </label>
                            <label className={`flex flex-1 flex-col gap-2 ${fieldLabelClass}`}>
                                Name
                                <input
                                    type="text"
                                    value={data.given_names}
                                    onChange={(e) => setData('given_names', e.target.value)}
                                    className={fieldInputClass}
                                />
                                <ErrorText message={errors.given_names} />
                            </label>
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <label className={`flex flex-col gap-2 sm:w-[176px] ${fieldLabelClass}`}>
                                Date of birth
                                <input
                                    type="date"
                                    value={data.date_of_birth}
                                    onChange={(e) => setData('date_of_birth', e.target.value)}
                                    className={`${fieldInputClass} font-mono text-[14px]`}
                                />
                                <ErrorText message={errors.date_of_birth} />
                            </label>
                            <div role="radiogroup" aria-label="Gender" className={`flex flex-col gap-2 sm:w-[160px] ${fieldLabelClass}`}>
                                Gender
                                <div className="flex gap-2">
                                    {[
                                        { value: 'female', label: 'Girl' },
                                        { value: 'male', label: 'Boy' },
                                    ].map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            role="radio"
                                            aria-checked={data.gender === option.value}
                                            onClick={() => setData('gender', option.value)}
                                            className={segmentClass(data.gender === option.value)}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                                <ErrorText message={errors.gender} />
                            </div>
                            <label className={`flex flex-1 flex-col gap-2 ${fieldLabelClass}`}>
                                Place of birth
                                <input
                                    type="text"
                                    value={data.place_of_birth}
                                    onChange={(e) => setData('place_of_birth', e.target.value)}
                                    className={fieldInputClass}
                                />
                            </label>
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            {canSeePrivate && (
                                <label className={`flex flex-1 flex-col gap-2 ${fieldLabelClass}`}>
                                    Religion
                                    <select
                                        value={data.religion}
                                        onChange={(e) => setData('religion', e.target.value)}
                                        className={fieldInputClass}
                                    >
                                        <option value="">Not recorded</option>
                                        {props.religions.map((religion) => (
                                            <option key={religion}>{religion}</option>
                                        ))}
                                    </select>
                                </label>
                            )}
                            <div className={`flex flex-col gap-2 sm:w-[252px] ${fieldLabelClass}`}>
                                Matricule
                                <span className="flex h-10 items-center justify-between rounded-md border border-solid border-border bg-surface px-3">
                                    <span className="font-mono text-[16px] leading-5 font-normal text-text">
                                        {props.matricule}
                                    </span>
                                    <span className="text-[12px] leading-4 font-medium text-text-muted">
                                        {student ? 'Never changes' : 'Automatic'}
                                    </span>
                                </span>
                            </div>
                        </div>
                    </section>

                    <section className="flex flex-col gap-[14px]">
                        <p className={capsLabelClass}>Background</p>
                        {canSeePrivate && (
                            <div className="flex flex-col gap-[10px]">
                                <YesNo
                                    label="Does the student have a disability?"
                                    value={data.has_disability}
                                    onChange={(next) => setData('has_disability', next)}
                                />
                                {data.has_disability && (
                                    <div className="flex flex-col gap-3 rounded-md bg-surface p-[14px] sm:flex-row">
                                        <div className={`flex flex-1 flex-col gap-2 ${fieldLabelClass}`}>
                                            Type
                                            <div className="flex flex-wrap gap-[6px]">
                                                {props.disabilityTypes.map((type) => {
                                                    const on = data.disability_types.includes(type);

                                                    return (
                                                        <button
                                                            key={type}
                                                            type="button"
                                                            aria-pressed={on}
                                                            onClick={() => toggleType(type)}
                                                            className={`flex h-8 items-center rounded-sm border border-solid px-[10px] text-[13px] leading-4 ${
                                                                on
                                                                    ? 'border-primary bg-primary-tint font-medium text-primary'
                                                                    : 'border-border bg-white font-normal text-text'
                                                            }`}
                                                        >
                                                            {type}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <label className={`flex flex-1 flex-col gap-2 ${fieldLabelClass}`}>
                                            Support the school should give
                                            <input
                                                type="text"
                                                placeholder="Sits in the front row"
                                                value={data.disability_support}
                                                onChange={(e) => setData('disability_support', e.target.value)}
                                                className={`${fieldInputClass} text-[14px]`}
                                            />
                                        </label>
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="flex flex-col gap-[10px]">
                            <YesNo
                                label="Transferred from another school?"
                                value={data.transferred}
                                onChange={(next) => setData('transferred', next)}
                            />
                            {data.transferred && (
                                <div className="flex flex-col gap-3 rounded-md bg-surface p-[14px]">
                                    <div className="flex flex-col gap-3 sm:flex-row">
                                        <label className={`flex flex-1 flex-col gap-2 ${fieldLabelClass}`}>
                                            Previous school
                                            <input
                                                type="text"
                                                value={data.previous_school}
                                                onChange={(e) => setData('previous_school', e.target.value)}
                                                className={fieldInputClass}
                                            />
                                        </label>
                                        <label className={`flex flex-col gap-2 sm:w-[150px] ${fieldLabelClass}`}>
                                            Last class
                                            <input
                                                type="text"
                                                placeholder="Form 3"
                                                value={data.previous_class}
                                                onChange={(e) => setData('previous_class', e.target.value)}
                                                className={fieldInputClass}
                                            />
                                        </label>
                                        <label className={`flex flex-col gap-2 sm:w-[110px] ${fieldLabelClass}`}>
                                            Year left
                                            <input
                                                type="number"
                                                min={1990}
                                                value={data.previous_year_left}
                                                onChange={(e) => setData('previous_year_left', e.target.value)}
                                                className={`${fieldInputClass} font-mono`}
                                            />
                                        </label>
                                    </div>
                                    <ErrorText message={errors.previous_school ?? errors.previous_year_left} />
                                    <div className="flex flex-wrap gap-6">
                                        <Tick
                                            checked={data.transfer_certificate_received}
                                            onChange={(next) => setData('transfer_certificate_received', next)}
                                        >
                                            Transfer certificate received
                                        </Tick>
                                        <Tick
                                            checked={data.last_report_received}
                                            onChange={(next) => setData('last_report_received', next)}
                                        >
                                            Last report card received
                                        </Tick>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="flex flex-col gap-[14px]">
                        <p className={capsLabelClass}>Class</p>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <label className={`flex flex-1 flex-col gap-2 ${fieldLabelClass}`}>
                                Level
                                <select
                                    value={levelId}
                                    onChange={(e) => chooseLevel(e.target.value)}
                                    className={fieldInputClass}
                                >
                                    <option value="">Choose a level</option>
                                    {levels.map((option) => (
                                        <option key={option.id} value={option.id}>
                                            {option.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className={`flex flex-1 flex-col gap-2 ${fieldLabelClass}`}>
                                Class
                                <select
                                    value={data.class_id}
                                    disabled={!levelId}
                                    onChange={(e) => setData('class_id', e.target.value)}
                                    className={`${fieldInputClass} disabled:bg-surface`}
                                >
                                    <option value="">
                                        {levelId ? 'Choose a class' : 'Choose a level first'}
                                    </option>
                                    {levelClasses.map((option) => (
                                        <option key={option.id} value={option.id}>
                                            {option.name} · {option.students} of {option.capacity}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <ErrorText message={errors.class_id} />
                        {levels.length === 0 && (
                            <p className="text-[13px] leading-[19px] text-warning">
                                There are no levels or classes yet. Add them
                                under Classes &amp; Subjects first.
                            </p>
                        )}
                        {level?.uses_series && (
                            <div className="flex flex-col gap-2">
                                <p className="flex items-baseline gap-2">
                                    <span className={fieldLabelClass}>Series</span>
                                    <span className="text-[12px] leading-4 text-text-muted">
                                        optional · {level.name} uses series
                                    </span>
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                    {levelSeries.map((option, position) => {
                                        const on = data.series_id === option.id;
                                        const newStream =
                                            position > 0 &&
                                            levelSeries[position - 1].stream !== option.stream;

                                        return (
                                            <span key={option.id} className="flex items-center gap-2">
                                                {newStream && <span className="h-5 w-px shrink-0 bg-border" />}
                                                <button
                                                    type="button"
                                                    aria-pressed={on}
                                                    title={option.name}
                                                    onClick={() => setData('series_id', on ? '' : option.id)}
                                                    className={`flex h-8 min-w-11 shrink-0 items-center justify-center rounded-md border border-solid px-2 font-mono text-[13px] leading-4 ${
                                                        on
                                                            ? 'border-primary bg-primary-tint font-semibold text-primary'
                                                            : 'border-border text-text hover:bg-surface'
                                                    }`}
                                                >
                                                    {option.code}
                                                </button>
                                            </span>
                                        );
                                    })}
                                    <span className="pl-2 text-[13px] leading-4 text-text-muted">
                                        {levelSeries.length > 0
                                            ? 'Leave empty to choose later.'
                                            : 'No series are set up for this level yet.'}
                                    </span>
                                </div>
                                <ErrorText message={errors.series_id} />
                            </div>
                        )}
                    </section>

                    <section className="flex flex-col gap-[14px]">
                        <p className={capsLabelClass}>Parents and guardian</p>
                        <div className="flex flex-col gap-4 md:flex-row">
                            {relations.map((relation) => {
                                const isMain = data.main_contact === relation;
                                const title = { father: 'Father', mother: 'Mother', guardian: 'Guardian' }[relation];

                                return (
                                    <fieldset
                                        key={relation}
                                        className="flex min-w-0 flex-1 flex-col gap-3 rounded-md border border-solid border-border p-[14px]"
                                    >
                                        <div className="flex items-center justify-between">
                                            <legend className="float-left text-[14px] leading-[18px] font-semibold text-text">
                                                {title}
                                            </legend>
                                            {isMain ? (
                                                <span className="flex h-[22px] items-center rounded-full bg-primary-tint px-2 text-[12px] leading-4 font-medium text-primary">
                                                    Main contact
                                                </span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => setData('main_contact', relation)}
                                                    className="text-[13px] leading-4 font-medium text-primary hover:underline"
                                                >
                                                    Make main contact
                                                </button>
                                            )}
                                        </div>
                                        <label className={`flex flex-col gap-[6px] ${fieldLabelClass}`}>
                                            Surname and name
                                            <input
                                                type="text"
                                                value={guardians[relation].name}
                                                onChange={(e) => setGuardian(relation, { name: e.target.value })}
                                                className={smallInputClass}
                                            />
                                        </label>
                                        <label className={`flex flex-col gap-[6px] ${fieldLabelClass}`}>
                                            Phone
                                            <input
                                                type="tel"
                                                value={guardians[relation].phone}
                                                onChange={(e) => setGuardian(relation, { phone: e.target.value })}
                                                className={`${smallInputClass} font-mono`}
                                            />
                                        </label>
                                        <label className={`flex flex-col gap-[6px] ${fieldLabelClass}`}>
                                            Occupation
                                            <input
                                                type="text"
                                                value={guardians[relation].occupation}
                                                onChange={(e) => setGuardian(relation, { occupation: e.target.value })}
                                                className={smallInputClass}
                                            />
                                        </label>
                                    </fieldset>
                                );
                            })}
                        </div>
                        <ErrorText message={errors.main_contact ?? errors.guardians ?? guardianError} />
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <Tick checked={data.on_whatsapp} onChange={(next) => setData('on_whatsapp', next)}>
                                The main contact is also on WhatsApp. Notices
                                go there.
                            </Tick>
                            {!showGuardian && (
                                <button
                                    type="button"
                                    onClick={() => setShowGuardian(true)}
                                    className="text-[13px] leading-4 font-medium text-primary hover:underline"
                                >
                                    Add a guardian who is not a parent
                                </button>
                            )}
                        </div>
                        <label className={`flex flex-col gap-2 sm:w-[252px] ${fieldLabelClass}`}>
                            Lives with
                            <select
                                value={data.lives_with}
                                onChange={(e) => setData('lives_with', e.target.value)}
                                className={fieldInputClass}
                            >
                                <option value="">Not recorded</option>
                                {props.livesWithOptions.map((option) => (
                                    <option key={option}>{option}</option>
                                ))}
                            </select>
                        </label>
                    </section>

                    {!student && (
                        <section className="flex flex-col gap-[14px]">
                            <p className={capsLabelClass}>Fees</p>
                            {plan ? (
                                <div className="flex flex-wrap items-center gap-3 rounded-md bg-surface px-[14px] py-3">
                                    <div className="flex w-[150px] shrink-0 flex-col gap-[2px]">
                                        <span className="text-[13px] leading-4 text-text-muted">
                                            Standard plan
                                        </span>
                                        <span className="font-mono text-[15px] leading-5 text-text">
                                            {money(plan.amount, currency)}
                                        </span>
                                        {plan.items.length > 1 &&
                                            plan.items.map((item) => (
                                                <span key={item.name} className="text-[12px] leading-4 text-text-muted">
                                                    {item.name} · {money(item.amount)}
                                                </span>
                                            ))}
                                    </div>
                                    <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                                        {plan.installments.map((installment) => (
                                            <div
                                                key={installment.seq}
                                                className="flex min-w-[110px] flex-1 flex-col gap-[2px] rounded-md border border-solid border-border bg-white px-[10px] py-[6px]"
                                            >
                                                <span className="text-[12px] leading-4 text-text-muted">
                                                    {ORDINALS[installment.seq - 1] ?? `#${installment.seq}`} ·{' '}
                                                    {shortDate(installment.due_on)}
                                                </span>
                                                <span className="font-mono text-[13px] leading-4 text-text">
                                                    {money(installment.amount)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <p className="rounded-md bg-surface px-[14px] py-3 text-[13px] leading-[19px] text-text-muted">
                                    {levelId
                                        ? `No fee plan is set for ${level?.name} this year, so nothing is billed at admission.`
                                        : 'Choose a level to see its fee plan.'}
                                </p>
                            )}
                        </section>
                    )}

                    {errors.duplicate && (
                        <div role="alert" className="flex flex-col gap-[10px] rounded-lg border border-solid border-warning bg-warning-tint p-4">
                            <p className="text-[14px] leading-[18px] font-semibold text-[#8A5A12]">
                                Possible duplicate
                            </p>
                            <p className="text-[13px] leading-[19px] text-text">{errors.duplicate}</p>
                            <Tick
                                checked={data.allow_duplicate}
                                onChange={(next) => setData('allow_duplicate', next)}
                            >
                                This is a different student. Register anyway.
                            </Tick>
                        </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <p className="text-[13px] leading-4 text-text-muted">
                            Fees come from School Setup.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Link
                                href={student ? show.url(student.id) : index.url()}
                                className={outlineButtonClass}
                            >
                                Cancel
                            </Link>
                            {!student && (
                                <button
                                    type="button"
                                    disabled={processing}
                                    onClick={() => submit(true)}
                                    className={outlineButtonClass}
                                >
                                    Save and add another
                                </button>
                            )}
                            <button type="submit" disabled={processing} className={solidButtonClass}>
                                {student ? 'Save changes' : 'Register student'}
                            </button>
                        </div>
                    </div>
                </div>

                <aside className="flex shrink-0 flex-col gap-5 border-solid border-border lg:w-[328px] lg:border-l lg:pl-8">
                    <div className="flex flex-col gap-2 rounded-lg border border-solid border-border bg-surface p-4">
                        <p className={capsLabelClass}>Matricule</p>
                        <p className="font-mono text-[22px] leading-7 text-text">{props.matricule}</p>
                        <p className="text-[13px] leading-[19px] text-text-muted">
                            School prefix, admission year and the next free
                            number. It never changes.
                        </p>
                    </div>

                    {sibling && linked === sibling.id && (
                        <div className="flex flex-col gap-[10px] rounded-lg border border-solid border-border bg-white p-4">
                            <p className="text-[14px] leading-[18px] font-semibold text-text">
                                Linked as siblings
                            </p>
                            <p className="text-[13px] leading-[19px] text-text-muted">
                                With {sibling.name} ({sibling.matricule}).
                            </p>
                            <button
                                type="button"
                                onClick={() => setLinked(null)}
                                className="self-start text-[13px] leading-4 font-medium text-primary hover:underline"
                            >
                                Undo
                            </button>
                        </div>
                    )}
                    {sibling && linked !== sibling.id && dismissed !== sibling.id && (
                        <div className="flex flex-col gap-[10px] rounded-lg border border-solid border-warning bg-warning-tint p-4">
                            <p className="text-[14px] leading-[18px] font-semibold text-[#8A5A12]">
                                Possible sibling
                            </p>
                            <p className="text-[13px] leading-[19px] text-text">
                                {sibling.name} ({sibling.matricule}) has a{' '}
                                {sibling.relation} with the same phone
                                number.
                            </p>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setLinked(sibling.id)}
                                    className="flex h-[30px] items-center rounded-md border border-solid border-border bg-white px-3 text-[13px] leading-4 font-medium text-text"
                                >
                                    Link as siblings
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDismissed(sibling.id)}
                                    className="flex h-[30px] items-center px-[10px] text-[13px] leading-4 font-medium text-primary hover:underline"
                                >
                                    Not related
                                </button>
                            </div>
                        </div>
                    )}

                    {canSeePrivate && (
                        <div className="flex flex-col gap-2 rounded-lg border border-solid border-border bg-white p-4">
                            <p className="text-[14px] leading-[18px] font-semibold text-text">
                                Private details
                            </p>
                            <p className="text-[13px] leading-[19px] text-text-muted">
                                Religion and disability are visible only to
                                the principal and the administrator. They
                                never appear on report cards or receipts.
                            </p>
                        </div>
                    )}

                    <div className="flex flex-col gap-[10px] rounded-lg border border-solid border-border bg-white p-4">
                        <p className="text-[14px] leading-[18px] font-semibold text-text">
                            Before you register
                        </p>
                        <ul className="flex flex-col gap-[10px]">
                            <Check
                                tone={
                                    data.surname.trim() && data.given_names.trim() && data.date_of_birth
                                        ? 'done'
                                        : 'todo'
                                }
                            >
                                Surname, name and date of birth
                            </Check>
                            <Check tone={!chosenClass ? 'todo' : classHasRoom ? 'done' : 'warn'}>
                                {chosenClass
                                    ? `${chosenClass.name} ${classHasRoom ? 'has room' : 'is full'}: ${chosenClass.students} of ${chosenClass.capacity}`
                                    : 'A class with room'}
                            </Check>
                            <Check tone={main.name.trim() && mainPhone ? 'done' : 'todo'}>
                                A main contact with a phone number
                            </Check>
                            {data.transferred && !data.last_report_received && (
                                <Check tone="warn">
                                    Last report card
                                    {data.previous_school ? ` from ${data.previous_school}` : ''} not
                                    received yet.
                                </Check>
                            )}
                            {level?.uses_series && !data.series_id && (
                                <Check tone="warn">
                                    No series yet. The student shows under
                                    No series until one is chosen.
                                </Check>
                            )}
                        </ul>
                    </div>
                </aside>
            </div>
        </form>
    );
}

export default withAppShell(Register);
