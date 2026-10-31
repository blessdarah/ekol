import { Head, Link, useForm } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import { index } from '@/actions/App/Http/Controllers/StaffRosterController';
import {
    show,
    store,
    update,
} from '@/actions/App/Http/Controllers/StaffController';
import {
    Avatar,
    FieldError,
    FlowSteps,
    Note,
    PageHeader,
    SplitLayout,
    choiceClass,
    fieldLabelClass,
    primaryButtonClass,
    pronounsFor,
    quietLinkClass,
    sectionLabelClass,
    textInputClass,
} from '../../components/staff/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface MemberProp {
    id: string;
    photo_url: string | null;
    given_name: string;
    family_name: string;
    gender: string | null;
    email: string;
    phone: string;
    address: string | null;
    qualification: string | null;
    employment_type: string | null;
}

const QUALIFICATIONS = [
    'GCE Advanced Level',
    'Baccalauréat',
    'Higher National Diploma',
    'DIPES I',
    'DIPES II',
    'Bachelor of Arts',
    'Bachelor of Science',
    'Bachelor of Education',
    'Master of Arts',
    'Master of Science',
    'Master of Education',
    'Doctorate',
];

function Check({ done }: { done: boolean }) {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" className="shrink-0">
            <circle
                cx="12"
                cy="12"
                r="9"
                fill="none"
                stroke={done ? 'var(--color-success)' : 'var(--color-border)'}
                strokeWidth="2"
            />
            {done && (
                <path
                    d="M8 12.5l2.8 2.8L16 9.5"
                    fill="none"
                    stroke="var(--color-success)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            )}
        </svg>
    );
}

function Register({
    yearLabel,
    member,
}: {
    yearLabel: string | null;
    member: MemberProp | null;
}) {
    const form = useForm({
        given_name: member?.given_name ?? '',
        family_name: member?.family_name ?? '',
        gender: member?.gender ?? '',
        email: member?.email ?? '',
        phone: member?.phone ?? '',
        address: member?.address ?? '',
        qualification: member?.qualification ?? '',
        employment_type: member?.employment_type ?? '',
        photo: null as File | null,
    });
    const { data, setData, errors, processing } = form;
    const [preview, setPreview] = useState<string | null>(null);
    const [photoError, setPhotoError] = useState<string | null>(null);
    const they = pronounsFor(data.gender);
    const initials = (
        data.given_name.trim().charAt(0) + data.family_name.trim().charAt(0)
    ).toUpperCase();

    const checklist = [
        {
            label: t('Full name'),
            done: !!data.given_name.trim() && !!data.family_name.trim(),
        },
        { label: t('Gender'), done: !!data.gender },
        { label: t('Address'), done: !!data.address.trim() },
        { label: t('Email'), done: !!data.email.trim() },
        { label: t('Phone'), done: !!data.phone.trim() },
        {
            label: t('Highest qualification'),
            done: !!data.qualification.trim(),
        },
        {
            label: t('Photo, or an avatar we generate'),
            done: !!preview || !!member?.photo_url || initials.length === 2,
        },
    ];

    function choosePhoto(file: File) {
        if (file.size > 2 * 1024 * 1024) {
            setPhotoError(t('Photo must be smaller than 2 MB.'));

            return;
        }

        setPhotoError(null);
        setPreview(URL.createObjectURL(file));
        setData('photo', file);
    }

    function submit(event: FormEvent) {
        event.preventDefault();

        if (member) {
            // Multipart bodies only parse on POST, so the PATCH is spoofed.
            form.transform((values) => ({ ...values, _method: 'patch' }));
            form.post(update.url(member.id));
        } else {
            form.post(store.url());
        }
    }

    return (
        <form
            onSubmit={submit}
            className="flex flex-col gap-7 lg:min-h-[calc(100vh-56px)]"
        >
            <Head
                title={
                    member
                        ? t('Edit a staff record')
                        : t('Register a staff member')
                }
            />
            <PageHeader
                crumb={member ? 'Edit' : 'Register'}
                parents={
                    member
                        ? [
                              {
                                  label: `${member.given_name} ${member.family_name}`.trim(),
                                  href: show.url(member.id),
                              },
                          ]
                        : []
                }
                title={
                    member
                        ? t('Edit a staff record')
                        : t('Register a staff member')
                }
                tag={`${member ? t('Record') : t('Registration')}${yearLabel ? ` · ${yearLabel}` : ''}`}
                meta={
                    member
                        ? t(
                              'corrections are normal, and every change is kept in the log',
                          )
                        : t(
                              'seven fields are required before :subject can be saved',
                              { subject: they.subject },
                          )
                }
            />
            {!member && <FlowSteps active={0} />}

            <SplitLayout
                aside={
                    <>
                        <div className="flex flex-col gap-3">
                            <p className={sectionLabelClass}>
                                {t('Seven required fields')}
                            </p>
                            <ul className="flex flex-col gap-2">
                                {checklist.map((item) => (
                                    <li
                                        key={item.label}
                                        className="flex items-center gap-2 text-[13px] leading-[1.35] text-text"
                                    >
                                        <Check done={item.done} />
                                        {t(item.label)}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <Note title={t('We do not verify with anyone')}>
                            {t(
                                'Nothing here is checked against a government database. The school records what it knows on the person, and corrects it later if it was wrong.',
                            )}
                        </Note>
                        <div className="mt-auto flex flex-col gap-2">
                            <button
                                type="submit"
                                disabled={processing}
                                className={`${primaryButtonClass} w-full`}
                            >
                                {member
                                    ? t('Save corrections')
                                    : t('Save and continue')}
                            </button>
                            <Link
                                href={
                                    member ? show.url(member.id) : index.url()
                                }
                                className={`${quietLinkClass} justify-center`}
                            >
                                {member
                                    ? t('Back to the record')
                                    : t('Back to roster')}
                            </Link>
                        </div>
                    </>
                }
            >
                <section className="flex flex-col gap-3">
                    <p className={sectionLabelClass}>{t('1 · The person')}</p>
                    <div className="flex flex-col gap-4 sm:flex-row">
                        <div className="flex w-[180px] shrink-0 flex-col gap-2">
                            <Avatar
                                initials={initials}
                                photoUrl={preview ?? member?.photo_url}
                                size={72}
                                bordered
                            />
                            <label className="flex h-8 cursor-pointer items-center rounded-md border border-solid border-border px-3 text-[13px] font-medium text-primary hover:bg-surface">
                                {preview || member?.photo_url
                                    ? t('Change the photo')
                                    : t('Add a photo')}
                                <input
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            choosePhoto(file);
                                        }
                                        e.target.value = '';
                                    }}
                                />
                            </label>
                            <p className="text-[12px] leading-[1.5] text-text-muted">
                                {t(
                                    'No photo? We generate an avatar from :possessive initials.',
                                    { possessive: they.possessive },
                                )}
                            </p>
                            <FieldError message={photoError ?? errors.photo} />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col gap-3">
                            <div className="flex flex-col gap-3 sm:flex-row">
                                <label
                                    className={`flex flex-1 flex-col gap-1 ${fieldLabelClass}`}
                                >
                                    {t('Given name')}
                                    <input
                                        type="text"
                                        value={data.given_name}
                                        onChange={(e) =>
                                            setData(
                                                'given_name',
                                                e.target.value,
                                            )
                                        }
                                        autoComplete="off"
                                        className={textInputClass}
                                    />
                                    <FieldError message={errors.given_name} />
                                </label>
                                <label
                                    className={`flex flex-1 flex-col gap-1 ${fieldLabelClass}`}
                                >
                                    {t('Family name')}
                                    <input
                                        type="text"
                                        value={data.family_name}
                                        onChange={(e) =>
                                            setData(
                                                'family_name',
                                                e.target.value,
                                            )
                                        }
                                        autoComplete="off"
                                        className={textInputClass}
                                    />
                                    <FieldError message={errors.family_name} />
                                </label>
                            </div>
                            <div
                                role="radiogroup"
                                aria-label={t('Gender')}
                                className="flex flex-col gap-2"
                            >
                                <span className={fieldLabelClass}>
                                    {t('Gender')}
                                </span>
                                <div className="flex gap-2">
                                    {[
                                        { value: 'female', label: t('Female') },
                                        { value: 'male', label: t('Male') },
                                    ].map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            role="radio"
                                            aria-checked={
                                                data.gender === option.value
                                            }
                                            onClick={() =>
                                                setData('gender', option.value)
                                            }
                                            className={choiceClass(
                                                data.gender === option.value,
                                            )}
                                        >
                                            {t(option.label)}
                                        </button>
                                    ))}
                                </div>
                                <FieldError message={errors.gender} />
                            </div>
                        </div>
                    </div>
                </section>

                <section className="flex flex-col gap-3">
                    <p className={sectionLabelClass}>
                        {t('2 · How to reach :object', { object: they.object })}
                    </p>
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <label
                            className={`flex flex-1 flex-col gap-1 ${fieldLabelClass}`}
                        >
                            {t('Email')}
                            <input
                                type="email"
                                value={data.email}
                                onChange={(e) =>
                                    setData('email', e.target.value)
                                }
                                autoComplete="off"
                                className={textInputClass}
                            />
                            <FieldError message={errors.email} />
                        </label>
                        <label
                            className={`flex flex-col gap-1 sm:w-[220px] ${fieldLabelClass}`}
                        >
                            {t('Phone')}
                            <input
                                type="tel"
                                value={data.phone}
                                onChange={(e) =>
                                    setData('phone', e.target.value)
                                }
                                autoComplete="off"
                                className={textInputClass}
                            />
                            <FieldError message={errors.phone} />
                        </label>
                    </div>
                    <label className={`flex flex-col gap-1 ${fieldLabelClass}`}>
                        {t('Address')}
                        <input
                            type="text"
                            value={data.address}
                            onChange={(e) => setData('address', e.target.value)}
                            autoComplete="off"
                            className={textInputClass}
                        />
                        <FieldError message={errors.address} />
                    </label>
                </section>

                <section className="flex flex-col gap-3">
                    <p className={sectionLabelClass}>
                        {t('3 · Qualification and work')}
                    </p>
                    <label className={`flex flex-col gap-1 ${fieldLabelClass}`}>
                        {t('Highest qualification')}
                        <input
                            type="text"
                            list="staff-qualifications"
                            placeholder={t('Master of Science · Physics')}
                            value={data.qualification}
                            onChange={(e) =>
                                setData('qualification', e.target.value)
                            }
                            className={textInputClass}
                        />
                        <datalist id="staff-qualifications">
                            {QUALIFICATIONS.map((option) => (
                                <option key={option} value={option} />
                            ))}
                        </datalist>
                        <FieldError message={errors.qualification} />
                    </label>
                    <div
                        role="radiogroup"
                        aria-label={t('Employment type')}
                        className="flex flex-col gap-2"
                    >
                        <span className={fieldLabelClass}>
                            {t('Employment type')}
                        </span>
                        <div className="flex flex-wrap gap-2">
                            {[
                                {
                                    value: 'school_paid',
                                    label: t('School-paid'),
                                },
                                {
                                    value: 'government',
                                    label: t('Government employee'),
                                },
                            ].map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={
                                        data.employment_type === option.value
                                    }
                                    onClick={() =>
                                        setData('employment_type', option.value)
                                    }
                                    className={choiceClass(
                                        data.employment_type === option.value,
                                    )}
                                >
                                    {t(option.label)}
                                </button>
                            ))}
                        </div>
                        <FieldError message={errors.employment_type} />
                    </div>
                </section>
            </SplitLayout>
        </form>
    );
}

export default withAppShell(Register);
