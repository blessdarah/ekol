import { useForm } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import {
    siblingCheck,
    store,
    update,
} from '@/actions/App/Http/Controllers/StudentRegistrationController';
import { fieldLabelClass, segmentClass } from '../../structure/ui';
import { t } from '../../../lib/i18n';

export interface GuardianForm {
    name: string;
    phone: string;
    occupation: string;
}

export type Relation = 'father' | 'mother' | 'guardian';

export interface RegisterProps {
    yearLabel: string | null;
    currency: string;
    matricule: string;
    canSeePrivate: boolean;
    religions: string[];
    disabilityTypes: string[];
    livesWithOptions: string[];
    levels: { id: string; name: string; uses_series: boolean }[];
    classes: {
        id: string;
        name: string;
        level_id: string;
        capacity: number;
        students: number;
    }[];
    series: {
        id: string;
        code: string;
        name: string;
        stream: string;
        level_id: string;
    }[];
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
        guardians: {
            relation: string;
            name: string;
            phone: string | null;
            occupation: string | null;
            is_main: boolean;
        }[];
    } | null;
}

export interface Sibling {
    id: string;
    name: string;
    matricule: string;
    relation: string;
}

export const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

export const smallInputClass =
    'h-9 w-full rounded-md border border-solid border-border bg-white px-3 text-[14px] leading-[18px] text-text outline-none focus:border-primary';

export function YesNo({
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
            <div
                role="radiogroup"
                aria-label={label}
                className="flex w-[200px] shrink-0 gap-2"
            >
                {[false, true].map((option) => (
                    <button
                        key={String(option)}
                        type="button"
                        role="radio"
                        aria-checked={value === option}
                        onClick={() => onChange(option)}
                        className={`${segmentClass(value === option)} h-[34px]`}
                    >
                        {option ? t('Yes') : t('No')}
                    </button>
                ))}
            </div>
        </div>
    );
}

export function Tick({
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

export function Check({
    tone,
    children,
}: {
    tone: 'done' | 'todo' | 'warn';
    children: React.ReactNode;
}) {
    const dot = { done: 'bg-success', todo: 'bg-border', warn: 'bg-warning' }[
        tone
    ];

    return (
        <li className="flex items-start gap-2 text-[13px] leading-[18px] text-text-muted">
            <span
                className={`mt-[6px] h-[6px] w-[6px] shrink-0 rounded-full ${dot}`}
            />
            {children}
        </li>
    );
}

export function guardianOf(
    student: RegisterProps['student'],
    relation: Relation,
): GuardianForm {
    const found = student?.guardians.find(
        (guardian) => guardian.relation === relation,
    );

    return {
        name: found?.name ?? '',
        phone: found?.phone ?? '',
        occupation: found?.occupation ?? '',
    };
}
export function useStudentRegistration(props: RegisterProps) {
    const {
        student,
        classes,
        levels,
        series,
        feePlans,
        currency,
        canSeePrivate,
    } = props;

    const startClass = classes.find(
        (option) => option.id === student?.class_id,
    );

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
        transfer_certificate_received:
            student?.transfer_certificate_received ?? false,
        last_report_received: student?.last_report_received ?? false,
        on_whatsapp: student?.on_whatsapp ?? true,
        lives_with: student?.lives_with ?? '',
        class_id: student?.class_id ?? '',
        series_id: student?.series_id ?? '',
        main_contact: (student?.guardians.find((guardian) => guardian.is_main)
            ?.relation ?? 'father') as Relation,
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
        !!student?.guardians.some(
            (guardian) => guardian.relation === 'guardian',
        ),
    );

    const [sibling, setSibling] = useState<Sibling | null>(null);

    const [linked, setLinked] = useState<string | null>(null);

    const [dismissed, setDismissed] = useState<string | null>(null);

    const level = levels.find((option) => option.id === levelId);

    const levelClasses = classes.filter(
        (option) => option.level_id === levelId,
    );

    const chosenClass = classes.find((option) => option.id === data.class_id);

    const levelSeries = series.filter((option) => option.level_id === levelId);

    const plan = feePlans.find((option) => option.level_id === levelId);

    const main = guardians[data.main_contact];

    const mainPhone = main.phone.trim();

    const classHasRoom =
        !!chosenClass &&
        (chosenClass.students < chosenClass.capacity ||
            chosenClass.id === student?.class_id);

    const guardianError = Object.entries(errors).find(([key]) =>
        key.startsWith('guardians'),
    )?.[1];

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
                .then((response) =>
                    response.ok ? response.json() : { sibling: null },
                )
                .then((body: { sibling: Sibling | null }) =>
                    setSibling(body.sibling),
                )
                .catch(() => undefined);
        }, 400);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [mainPhone, student]);

    function setGuardian(relation: Relation, patch: Partial<GuardianForm>) {
        setGuardians({
            ...guardians,
            [relation]: { ...guardians[relation], ...patch },
        });
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
    return {
        props,
        student,
        classes,
        levels,
        series,
        feePlans,
        currency,
        canSeePrivate,
        startClass,
        form,
        data,
        setData,
        processing,
        errors,
        levelId,
        setLevelId,
        guardians,
        setGuardians,
        showGuardian,
        setShowGuardian,
        sibling,
        setSibling,
        linked,
        setLinked,
        dismissed,
        setDismissed,
        level,
        levelClasses,
        chosenClass,
        levelSeries,
        plan,
        main,
        mainPhone,
        classHasRoom,
        guardianError,
        setGuardian,
        chooseLevel,
        toggleType,
        submit,
        relations,
    };
}
export type StudentRegistrationModel = ReturnType<
    typeof useStudentRegistration
>;
