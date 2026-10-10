import { Head, Link, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import {
    edit,
    saveAccess,
    show,
} from '@/actions/App/Http/Controllers/StaffController';
import {
    FieldError,
    FlowSteps,
    Note,
    PageHeader,
    SplitLayout,
    capitalise,
    primaryButtonClass,
    pronounsFor,
    quietLinkClass,
    sectionLabelClass,
} from '../../components/staff/ui';
import { withAppShell } from '../../layouts/app-layout';

interface AccessProps {
    yearLabel: string | null;
    member: {
        id: string;
        formal_name: string;
        salutation: string;
        gender: string | null;
        role: string;
        email: string;
        phone: string;
        has_account: boolean;
        channel: string;
    };
    roles: { value: string; label: string; summary: string }[];
    schoolName: string;
    termLabel: string | null;
}

const CHANNELS = [
    { value: 'email', label: 'Email' },
    { value: 'sms', label: 'SMS' },
    { value: 'both', label: 'Both' },
];

const contactInputClass =
    'h-[44px] w-full rounded-md border border-solid border-border bg-white px-[14px] font-mono text-[14px] text-text outline-none focus:border-primary';

function Access({ yearLabel, member, roles, schoolName, termLabel }: AccessProps) {
    const form = useForm({
        role: roles.some((role) => role.value === member.role)
            ? member.role
            : 'teacher',
        email: member.email,
        phone: member.phone,
        channel: member.channel,
        create_now: !member.has_account,
    });
    const { data, setData, errors, processing } = form;
    const they = pronounsFor(member.gender);
    const selectedRole = roles.find((role) => role.value === data.role);

    function submit(event: FormEvent) {
        event.preventDefault();
        form.post(saveAccess.url(member.id));
    }

    return (
        <form
            onSubmit={submit}
            className="flex min-h-[calc(100vh-56px)] flex-col gap-7"
        >
            <Head title="Portal access" />
            <PageHeader
                crumb="Portal access"
                parents={[
                    { label: member.formal_name, href: show.url(member.id) },
                ]}
                title="Portal access"
                tag={`Registration${yearLabel ? ` · ${yearLabel}` : ''}`}
                meta={`${member.formal_name} · ${selectedRole?.label ?? 'Teacher'} · ${member.has_account ? 'portal on' : 'no account yet'}`}
            />
            <FlowSteps active={1} />

            <SplitLayout
                aside={
                    <>
                        <div className="flex flex-col gap-3">
                            <p className={sectionLabelClass}>Access can wait</p>
                            <p className="text-[13px] leading-[1.5] text-text">
                                A staff member does not need an account to
                                exist. Register {they.object}, leave the
                                account off, and {they.subject} {they.sits} on
                                the roster as Not yet until the school is
                                ready.
                            </p>
                            <p className="text-[13px] leading-[1.5] text-text">
                                Nobody is counted as absent, or dropped from a
                                class list, for not having signed in.
                            </p>
                        </div>
                        <Note title="Same account either way">
                            School-paid or government employee, the portal, the
                            roster and the password are identical. Employment
                            type only decides who pays {they.object}.
                        </Note>
                        <div className="flex flex-col gap-2">
                            <p className={sectionLabelClass}>
                                What {they.subject} {they.sees} of{' '}
                                {they.possessive} record
                            </p>
                            <p className="text-[13px] leading-[1.5] text-text-muted">
                                {capitalise(they.possessive)} name, gender,
                                address, email, phone, qualification and
                                subjects. {capitalise(they.possessive)} pay
                                stays with the school and the delegation.
                            </p>
                        </div>
                        <div className="mt-auto flex flex-col gap-2">
                            <FieldError
                                message={
                                    (errors as Record<string, string>).invitation
                                }
                            />
                            <p className="text-[12px] leading-[1.5] text-text-muted">
                                The invitation carries a link, never a
                                password.
                            </p>
                            <div className="flex gap-2">
                                <Link
                                    href={edit.url(member.id)}
                                    className={quietLinkClass}
                                >
                                    Back
                                </Link>
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className={`${primaryButtonClass} flex-1`}
                                >
                                    {member.has_account
                                        ? 'Save access'
                                        : data.create_now
                                          ? 'Create the account & invite'
                                          : 'Save without an account'}
                                </button>
                            </div>
                        </div>
                    </>
                }
            >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="font-display text-[20px] leading-[1.1] font-bold tracking-[-0.02em] text-text">
                        What {they.subject} will be able to do
                    </h2>
                    <p className="text-[13px] text-text-muted">
                        One person, one account
                    </p>
                </div>

                <div className="flex flex-col gap-2 rounded-lg border border-solid border-border p-4">
                    <p className={sectionLabelClass}>Role in the portal</p>
                    <div role="radiogroup" aria-label="Role in the portal" className="flex flex-wrap gap-2">
                        {roles.map((role) => {
                            const selected = data.role === role.value;

                            return (
                                <button
                                    key={role.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={selected}
                                    onClick={() => setData('role', role.value)}
                                    className={`flex h-8 items-center rounded-md border border-solid px-3 text-[13px] ${
                                        selected
                                            ? 'border-primary bg-primary-tint font-semibold text-primary'
                                            : 'border-border bg-surface font-medium text-text hover:bg-primary-tint'
                                    }`}
                                >
                                    {role.label}
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-[12px] leading-[1.5] text-text-muted">
                        {selectedRole?.summary}
                    </p>
                    <FieldError message={errors.role} />
                </div>

                <div className="flex flex-col gap-4 sm:flex-row">
                    <label className={`flex flex-1 flex-col gap-1 ${sectionLabelClass}`}>
                        Email
                        <input
                            type="email"
                            value={data.email}
                            onChange={(e) => setData('email', e.target.value)}
                            className={contactInputClass}
                        />
                        <FieldError message={errors.email} />
                    </label>
                    <label className={`flex flex-col gap-1 sm:w-[200px] ${sectionLabelClass}`}>
                        Phone
                        <input
                            type="tel"
                            value={data.phone}
                            onChange={(e) => setData('phone', e.target.value)}
                            className={contactInputClass}
                        />
                        <FieldError message={errors.phone} />
                    </label>
                </div>

                {member.has_account ? (
                    <p className="rounded-md bg-surface p-4 text-[13px] leading-[1.5] text-text">
                        {capitalise(they.subject)} already {they.has} a portal
                        account and signs in with {they.possessive} own
                        password. Changing the role above takes effect the next
                        time {they.subject} {they.does} so.
                    </p>
                ) : (
                    <>
                        <div className="flex flex-col gap-2 rounded-lg border border-solid border-border p-4">
                            <div className="flex items-center gap-2">
                                <p className={sectionLabelClass}>Invitation</p>
                                <span className="flex-1" />
                                <div
                                    role="radiogroup"
                                    aria-label="Send the invitation by"
                                    className="flex gap-1 rounded-md border border-solid border-border bg-surface p-[3px]"
                                >
                                    {CHANNELS.map((channel) => {
                                        const selected = data.channel === channel.value;

                                        return (
                                            <button
                                                key={channel.value}
                                                type="button"
                                                role="radio"
                                                aria-checked={selected}
                                                onClick={() => setData('channel', channel.value)}
                                                className={`flex h-[26px] items-center justify-center rounded-md px-3 text-[12px] leading-4 ${
                                                    selected
                                                        ? 'bg-primary-tint font-semibold text-primary'
                                                        : 'font-medium text-text-muted hover:text-text'
                                                }`}
                                            >
                                                {channel.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <p className="rounded-md border border-solid border-border bg-surface p-3 text-[13px] leading-[1.5] text-text">
                                Dear {member.salutation}, you have been
                                registered at {schoolName}. Set your portal
                                password to see your classes
                                {termLabel ? ` for ${termLabel}` : ''}.
                            </p>
                            <p className="text-[12px] leading-[1.5] text-text-muted">
                                Your name and the school are added at the end.
                                The link works for seven days and can be sent
                                again.
                            </p>
                            {data.channel !== 'email' && (
                                <p className="text-[12px] leading-[1.5] text-warning">
                                    SMS sending is not connected yet.{' '}
                                    {data.channel === 'both'
                                        ? 'Only the email will go out.'
                                        : 'Nothing will be delivered until it is; choose Email to reach the person now.'}
                                </p>
                            )}
                            <FieldError message={errors.channel} />
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex flex-1 flex-col gap-1">
                                <span
                                    id="create-now-label"
                                    className="text-[14px] leading-[1.35] text-text"
                                >
                                    Create the account now
                                </span>
                                <span className="text-[13px] leading-[1.35] text-text-muted">
                                    Off, {they.subject}{' '}
                                    {they.subject === 'they' ? 'stay' : 'stays'}{' '}
                                    on the roster as “Not yet” until you come
                                    back.
                                </span>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={data.create_now}
                                aria-labelledby="create-now-label"
                                onClick={() => setData('create_now', !data.create_now)}
                                className={`flex h-6 w-11 shrink-0 items-center rounded-full px-[3px] transition-colors ${
                                    data.create_now
                                        ? 'justify-end bg-primary'
                                        : 'justify-start bg-border'
                                }`}
                            >
                                <span className="h-[18px] w-[18px] rounded-full bg-white" />
                            </button>
                        </div>
                    </>
                )}
            </SplitLayout>
        </form>
    );
}

export default withAppShell(Access);
