import { Head, Link, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { index, store } from '@/actions/App/Http/Controllers/ApplicationController';
import { EnrolmentHeader, type EnrolmentProgress } from '../../components/enrolment/ui';
import {
    ErrorText,
    capsLabelClass,
    fieldInputClass,
    fieldLabelClass,
    outlineButtonClass,
    segmentClass,
    solidButtonClass,
} from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';

type Relation = 'father' | 'mother' | 'guardian';

interface GuardianForm {
    name: string;
    phone: string;
    occupation: string;
}

interface NewApplicationProps {
    enrolment: EnrolmentProgress;
    levels: { id: string; name: string }[];
    religions: string[];
    documents: Record<string, string>;
    canSeePrivate: boolean;
}

const RELATIONS: { key: Relation; title: string }[] = [
    { key: 'father', title: 'Father' },
    { key: 'mother', title: 'Mother' },
    { key: 'guardian', title: 'Guardian' },
];

const smallInputClass =
    'h-9 w-full rounded-md border border-solid border-border bg-white px-3 text-[14px] leading-[18px] text-text outline-none focus:border-primary';

const blank: GuardianForm = { name: '', phone: '', occupation: '' };

function NewApplication({ enrolment, levels, religions, documents, canSeePrivate }: NewApplicationProps) {
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
    const guardianError = Object.entries(errors).find(([key]) => key.startsWith('guardians'))?.[1];
    const asked = Object.entries(documents).filter(([key]) => data.transferred || key !== 'transfer_certificate');

    function setGuardian(relation: Relation, patch: Partial<GuardianForm>) {
        setGuardians({ ...guardians, [relation]: { ...guardians[relation], ...patch } });
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
            documents: values.documents.filter((key) => values.transferred || key !== 'transfer_certificate'),
            guardians: RELATIONS.filter(({ key }) => guardians[key].name.trim() !== '').map(({ key }) => ({
                relation: key,
                name: guardians[key].name,
                phone: guardians[key].phone || null,
                occupation: guardians[key].occupation || null,
            })),
        }));
        form.post(store.url());
    }

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                submit();
            }}
            className="flex flex-col gap-5"
        >
            <Head title="Add an application" />
            <EnrolmentHeader
                active="applications"
                progress={enrolment}
                trail={[{ label: 'Applications', href: index.url() }, { label: 'Add an application' }]}
                title="Add an application"
                meta="it gets a reference and waits under To review"
            />

            <div className="flex flex-col gap-8 lg:flex-row">
                <div className="flex min-w-0 flex-1 flex-col gap-7">
                    <section className="flex flex-col gap-[14px]">
                        <p className={capsLabelClass}>Applicant</p>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <label className={`flex flex-col gap-[6px] ${fieldLabelClass}`}>
                                Surname
                                <input
                                    type="text"
                                    value={data.surname}
                                    onChange={(e) => setData('surname', e.target.value)}
                                    className={fieldInputClass}
                                />
                                <ErrorText message={errors.surname} />
                            </label>
                            <label className={`flex flex-col gap-[6px] ${fieldLabelClass}`}>
                                Given names
                                <input
                                    type="text"
                                    value={data.given_names}
                                    onChange={(e) => setData('given_names', e.target.value)}
                                    className={fieldInputClass}
                                />
                                <ErrorText message={errors.given_names} />
                            </label>
                            <label className={`flex flex-col gap-[6px] ${fieldLabelClass}`}>
                                Date of birth
                                <input
                                    type="date"
                                    value={data.date_of_birth}
                                    onChange={(e) => setData('date_of_birth', e.target.value)}
                                    className={fieldInputClass}
                                />
                                <ErrorText message={errors.date_of_birth} />
                            </label>
                            <label className={`flex flex-col gap-[6px] ${fieldLabelClass}`}>
                                Place of birth
                                <input
                                    type="text"
                                    value={data.place_of_birth}
                                    onChange={(e) => setData('place_of_birth', e.target.value)}
                                    className={fieldInputClass}
                                />
                                <ErrorText message={errors.place_of_birth} />
                            </label>
                            <div className="flex flex-col gap-[6px]">
                                <span className={fieldLabelClass}>Gender</span>
                                <div role="radiogroup" aria-label="Gender" className="flex gap-2">
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
                            <label className={`flex flex-col gap-[6px] ${fieldLabelClass}`}>
                                Applying to
                                <select
                                    value={data.level_id}
                                    onChange={(e) => setData('level_id', e.target.value)}
                                    className={fieldInputClass}
                                >
                                    <option value="">Choose a level</option>
                                    {levels.map((level) => (
                                        <option key={level.id} value={level.id}>
                                            {level.name}
                                        </option>
                                    ))}
                                </select>
                                <ErrorText message={errors.level_id} />
                            </label>
                            {canSeePrivate && (
                                <>
                                    <label className={`flex flex-col gap-[6px] ${fieldLabelClass}`}>
                                        Religion
                                        <select
                                            value={data.religion}
                                            onChange={(e) => setData('religion', e.target.value)}
                                            className={fieldInputClass}
                                        >
                                            <option value="">Not given</option>
                                            {religions.map((religion) => (
                                                <option key={religion} value={religion}>
                                                    {religion}
                                                </option>
                                            ))}
                                        </select>
                                        <ErrorText message={errors.religion} />
                                    </label>
                                    <label className={`flex flex-col gap-[6px] ${fieldLabelClass}`}>
                                        Disability or support needed
                                        <input
                                            type="text"
                                            value={data.disability}
                                            onChange={(e) => setData('disability', e.target.value)}
                                            placeholder="Leave empty for none"
                                            className={fieldInputClass}
                                        />
                                        <ErrorText message={errors.disability} />
                                    </label>
                                </>
                            )}
                        </div>
                    </section>

                    <section className="flex flex-col gap-[14px]">
                        <p className={capsLabelClass}>Coming from</p>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <span className={fieldLabelClass}>Transferring from another secondary school?</span>
                            <div role="radiogroup" aria-label="Transferring" className="flex w-[200px] shrink-0 gap-2">
                                {[false, true].map((option) => (
                                    <button
                                        key={String(option)}
                                        type="button"
                                        role="radio"
                                        aria-checked={data.transferred === option}
                                        onClick={() => setData('transferred', option)}
                                        className={`${segmentClass(data.transferred === option)} h-[34px]`}
                                    >
                                        {option ? 'Yes' : 'No'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <label className={`flex flex-col gap-[6px] ${fieldLabelClass}`}>
                                {data.transferred ? 'School transferring from' : 'Last school attended'}
                                <input
                                    type="text"
                                    value={data.previous_school}
                                    onChange={(e) => setData('previous_school', e.target.value)}
                                    className={fieldInputClass}
                                />
                                <ErrorText message={errors.previous_school} />
                            </label>
                            <label className={`flex flex-col gap-[6px] ${fieldLabelClass}`}>
                                Class there
                                <input
                                    type="text"
                                    value={data.previous_class}
                                    onChange={(e) => setData('previous_class', e.target.value)}
                                    className={fieldInputClass}
                                />
                                <ErrorText message={errors.previous_class} />
                            </label>
                            <label className={`flex flex-col gap-[6px] sm:col-span-2 ${fieldLabelClass}`}>
                                Reason for applying
                                <input
                                    type="text"
                                    value={data.reason}
                                    onChange={(e) => setData('reason', e.target.value)}
                                    className={fieldInputClass}
                                />
                                <ErrorText message={errors.reason} />
                            </label>
                        </div>
                    </section>

                    <section className="flex flex-col gap-[14px]">
                        <p className={capsLabelClass}>Parents and guardian</p>
                        <div className="flex flex-col gap-4 md:flex-row">
                            {RELATIONS.map(({ key, title }) => (
                                <fieldset
                                    key={key}
                                    className="flex min-w-0 flex-1 flex-col gap-3 rounded-md border border-solid border-border p-[14px]"
                                >
                                    <div className="flex items-center justify-between">
                                        <legend className="float-left text-[14px] leading-[18px] font-semibold text-text">
                                            {title}
                                        </legend>
                                        {data.main_contact === key ? (
                                            <span className="flex h-[22px] items-center rounded-full bg-primary-tint px-2 text-[12px] leading-4 font-medium text-primary">
                                                Main contact
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => setData('main_contact', key)}
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
                                            value={guardians[key].name}
                                            onChange={(e) => setGuardian(key, { name: e.target.value })}
                                            className={smallInputClass}
                                        />
                                    </label>
                                    <label className={`flex flex-col gap-[6px] ${fieldLabelClass}`}>
                                        Phone
                                        <input
                                            type="tel"
                                            value={guardians[key].phone}
                                            onChange={(e) => setGuardian(key, { phone: e.target.value })}
                                            className={`${smallInputClass} font-mono`}
                                        />
                                    </label>
                                    <label className={`flex flex-col gap-[6px] ${fieldLabelClass}`}>
                                        Occupation
                                        <input
                                            type="text"
                                            value={guardians[key].occupation}
                                            onChange={(e) => setGuardian(key, { occupation: e.target.value })}
                                            className={smallInputClass}
                                        />
                                    </label>
                                </fieldset>
                            ))}
                        </div>
                        <ErrorText message={errors.main_contact ?? errors.guardians ?? guardianError} />
                    </section>
                </div>

                <aside className="flex shrink-0 flex-col gap-5 border-solid border-border lg:w-[328px] lg:border-l lg:pl-8">
                    <div className="flex flex-col gap-[14px] rounded-lg border border-solid border-border bg-surface p-4">
                        <p className={capsLabelClass}>Documents received</p>
                        <div className="flex flex-col gap-[10px]">
                            {asked.map(([key, label]) => (
                                <label key={key} className="flex cursor-pointer items-center gap-[10px] text-[13px] leading-[18px] text-text">
                                    <input
                                        type="checkbox"
                                        checked={data.documents.includes(key)}
                                        onChange={() => toggleDocument(key)}
                                        className="h-[18px] w-[18px] shrink-0 accent-primary"
                                    />
                                    {label}
                                </label>
                            ))}
                        </div>
                        <p className="text-[13px] leading-[18px] text-text-muted">
                            Tick what the family has handed in. The rest shows
                            as missing and can be ticked later.
                        </p>
                        <div className="flex flex-col gap-2">
                            <button type="submit" disabled={processing} className={`${solidButtonClass} h-10 text-[14px]`}>
                                Save application
                            </button>
                            <Link href={index.url()} className={outlineButtonClass}>
                                Cancel
                            </Link>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border bg-white p-4">
                        <p className="text-[13px] leading-4 font-semibold text-text">Not a student yet</p>
                        <p className="text-[13px] leading-[19px] text-text-muted">
                            Saving creates no student and no matricule. That
                            happens when the application is admitted.
                        </p>
                    </div>
                </aside>
            </div>
        </form>
    );
}

export default withAppShell(NewApplication);
