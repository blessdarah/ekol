import { Form, Head } from '@inertiajs/react';
import { useState } from 'react';
import AuthLayout, { TopBar } from '../../layouts/auth-layout';
import Segmented from '../../components/auth/segmented';
import {
    Eyebrow,
    Field,
    Heading,
    PrimaryButton,
    inputClass,
    submitOnEnter,
} from '../../components/auth/field';
import { useHttp } from '@inertiajs/react';
import { switchLocale } from '../../components/shell/language-switch';
import { useLocale, useT } from '../../lib/i18n';

const STEPS = [
    { title: 'School', sub: 'Name, location and type' },
    { title: 'Administrator', sub: 'Who will manage the school' },
    { title: 'Verify', sub: 'Confirm your email address' },
];

export default function RegisterSchool({
    parentDomain,
    ownershipOptions,
    subsystemOptions,
    regions,
    locales,
}: {
    parentDomain: string;
    ownershipOptions: string[];
    subsystemOptions: string[];
    regions: string[];
    locales: Record<string, string>;
}) {
    const t = useT();
    const locale = useLocale();
    const [ownership, setOwnership] = useState(ownershipOptions[0] ?? '');
    const [subsystem, setSubsystem] = useState(subsystemOptions[0] ?? '');
    const [slug, setSlug] = useState('');
    const { get, data } = useHttp<{ available?: boolean }>({});

    function check(value: string) {
        const clean = value.toLowerCase();
        setSlug(clean);
        if (clean.length >= 3) {
            get(`/register/slug-check?slug=${encodeURIComponent(clean)}`);
        }
    }

    const availability =
        slug.length >= 3 && data.available !== undefined ? (
            <span
                className={
                    data.available ? 'text-success' : 'text-danger'
                }
            >
                {data.available ? (
                    <>
                        <span className="mr-1 inline-block h-[6px] w-[6px] rounded-full bg-success align-middle" />
                        {t('Available. This is where your staff will sign in.')}
                    </>
                ) : (
                    t('This address is taken.')
                )}
            </span>
        ) : null;

    return (
        <AuthLayout
            middle={{ variant: 'stepper', steps: STEPS, active: 0 }}
            topbar={
                <TopBar
                    text={t('Already registered?')}
                    linkText={t('Sign in')}
                    href="/login"
                />
            }
        >
            <Head title={t('Register your school')} />
            <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                    <Eyebrow>{t('Step :step of :total', { step: 1, total: 3 })}</Eyebrow>
                    <Heading
                        title={t('Register your school')}
                        sub={t('Create a private workspace for your school. You will be its first administrator.')}
                    />
                </div>
                <Form action="/register/school" method="post" onKeyDown={submitOnEnter}>
                    {({ errors, processing }) => (
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-[6px] text-[13px] font-medium text-text">
                                {t('Language')}
                                <Segmented
                                    name="locale"
                                    value={locale}
                                    onChange={switchLocale}
                                    options={Object.entries(locales).map(([value, label]) => ({ value, label }))}
                                />
                                <span className="text-[12px] font-normal text-text-muted">
                                    {t('The language your school works in. Each person can still choose their own.')}
                                </span>
                                {errors.locale && <span className="font-normal text-danger">{errors.locale}</span>}
                            </div>
                            <Field label={t('School name')} error={errors.name}>
                                <input
                                    type="text"
                                    name="name"
                                    placeholder={t('Government Bilingual High School, Bamenda')}
                                    className={inputClass}
                                />
                            </Field>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[200px_1fr]">
                                <Field
                                    label={t('Short name')}
                                    error={errors.code}
                                    hint={
                                        <span className="text-[12px] font-normal text-text-muted">
                                            {t('Prefix for student IDs')}
                                        </span>
                                    }
                                >
                                    <input
                                        type="text"
                                        name="code"
                                        placeholder={t('GBHS')}
                                        className={inputClass}
                                    />
                                </Field>
                                <Field
                                    label={t('Workspace address')}
                                    error={errors.slug}
                                    hint={availability}
                                >
                                    <span className="flex items-center gap-0">
                                        <input
                                            type="text"
                                            name="slug"
                                            value={slug}
                                            onChange={(e) =>
                                                check(e.target.value)
                                            }
                                            placeholder={t('gbhs-bamenda')}
                                            className={`${inputClass} rounded-r-none border-r-0 font-mono`}
                                        />
                                        <span className="flex h-9 shrink-0 items-center rounded-r-lg border border-solid border-border bg-surface px-3 font-mono text-[13px] text-text-muted">
                                            .{parentDomain}
                                        </span>
                                    </span>
                                </Field>
                            </div>
                            <div className="flex flex-col gap-[6px] text-[13px] font-medium text-text">
                                {t('School type')}
                                <Segmented
                                    name="ownership"
                                    value={ownership}
                                    onChange={setOwnership}
                                    options={ownershipOptions.map(
                                        (option) => ({
                                            value: option,
                                            label: t(option.charAt(0).toUpperCase() + option.slice(1)),
                                        }),
                                    )}
                                />
                                {errors.ownership && (
                                    <span className="font-normal text-danger">
                                        {errors.ownership}
                                    </span>
                                )}
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Field label={t('Region')} error={errors.region}>
                                    <select
                                        name="region"
                                        defaultValue=""
                                        className={`${inputClass} bg-white`}
                                    >
                                        <option value="" disabled>
                                            {t('Select region')}
                                        </option>
                                        {regions.map((region) => (
                                            <option
                                                key={region}
                                                value={region}
                                            >
                                                {t(region)}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                                <Field label={t('Town')} error={errors.town}>
                                    <input
                                        type="text"
                                        name="town"
                                        placeholder={t('Bamenda')}
                                        className={inputClass}
                                    />
                                </Field>
                            </div>
                            <div className="flex flex-col gap-[6px] text-[13px] font-medium text-text">
                                {t('Education subsystem')}
                                <Segmented
                                    name="subsystem"
                                    value={subsystem}
                                    onChange={setSubsystem}
                                    options={subsystemOptions.map(
                                        (option) => ({
                                            value: option,
                                            label: t(option === 'anglophone' ? 'Anglophone (GCE)' : option.charAt(0).toUpperCase() + option.slice(1)),
                                        }),
                                    )}
                                />
                                {errors.subsystem && (
                                    <span className="font-normal text-danger">
                                        {errors.subsystem}
                                    </span>
                                )}
                            </div>
                            {/* Cycle (primary/secondary/high) is captured
                                in School Setup, not on this screen. */}
                            <div className="flex items-center gap-4 pt-2">
                                <PrimaryButton disabled={processing}>
                                    {t('Continue')}
                                </PrimaryButton>
                                <span className="text-[13px] text-text-muted">
                                    {t('You can change all of this later in School Setup.')}
                                </span>
                            </div>
                        </div>
                    )}
                </Form>
            </div>
        </AuthLayout>
    );
}
