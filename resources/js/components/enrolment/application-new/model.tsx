import { useForm } from '@inertiajs/react';
import { useState } from 'react';
import { store } from '@/actions/App/Http/Controllers/ApplicationController';
import { type EnrolmentProgress } from '../ui';

export type Relation = 'father' | 'mother' | 'guardian';

export interface GuardianForm {
    name: string;
    phone: string;
    occupation: string;
}

export interface NewApplicationProps {
    enrolment: EnrolmentProgress;
    levels: { id: string; name: string }[];
    religions: string[];
    documents: Record<string, string>;
    canSeePrivate: boolean;
}

export const RELATIONS: { key: Relation; title: string }[] = [
    { key: 'father', title: 'Father' },
    { key: 'mother', title: 'Mother' },
    { key: 'guardian', title: 'Guardian' },
];

export const smallInputClass =
    'h-9 w-full rounded-md border border-solid border-border bg-white px-3 text-[14px] leading-[18px] text-text outline-none focus:border-primary';

const blank: GuardianForm = { name: '', phone: '', occupation: '' };

/**
 * The application as filled in so far, the family's contacts, the
 * documents handed in, and saving it.
 */
export function useNewApplication({
    enrolment,
    levels,
    religions,
    documents,
    canSeePrivate,
}: NewApplicationProps) {
    const form = useForm({
        surname: '',
        given_names: '',
        date_of_birth: '',
        gender: '',
        place_of_birth: '',
        religion: '',
        disability: '',
        level_id: '',
        transferred: false,
        previous_school: '',
        previous_class: '',
        reason: '',
        main_contact: 'father' as Relation,
        documents: [] as string[],
    });
    const { data, setData, processing } = form;
    const errors = form.errors as Record<string, string | undefined>;
    const [guardians, setGuardians] = useState<Record<Relation, GuardianForm>>({
        father: blank,
        mother: blank,
        guardian: blank,
    });
    const guardianError = Object.entries(errors).find(([key]) =>
        key.startsWith('guardians'),
    )?.[1];
    const asked = Object.entries(documents).filter(
        ([key]) => data.transferred || key !== 'transfer_certificate',
    );

    function setGuardian(relation: Relation, patch: Partial<GuardianForm>) {
        setGuardians({
            ...guardians,
            [relation]: { ...guardians[relation], ...patch },
        });
    }

    function toggleDocument(key: string) {
        setData(
            'documents',
            data.documents.includes(key)
                ? data.documents.filter((item) => item !== key)
                : [...data.documents, key],
        );
    }

    function submit() {
        form.transform((values) => ({
            ...values,
            religion: values.religion || null,
            disability: values.disability.trim() || null,
            previous_school: values.previous_school.trim() || null,
            documents: values.documents.filter(
                (key) => values.transferred || key !== 'transfer_certificate',
            ),
            guardians: RELATIONS.filter(
                ({ key }) => guardians[key].name.trim() !== '',
            ).map(({ key }) => ({
                relation: key,
                name: guardians[key].name,
                phone: guardians[key].phone || null,
                occupation: guardians[key].occupation || null,
            })),
        }));
        form.post(store.url());
    }

    return {
        enrolment,
        levels,
        religions,
        canSeePrivate,
        data,
        setData,
        processing,
        errors,
        guardians,
        guardianError,
        asked,
        setGuardian,
        toggleDocument,
        submit,
    };
}

export type NewApplication = ReturnType<typeof useNewApplication>;
