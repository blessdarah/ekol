import { Head, Link, router, useForm } from '@inertiajs/react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
    access,
    edit,
    index,
    remind,
    updateHours,
} from '@/actions/App/Http/Controllers/StaffController';
import {
    Avatar,
    EMPLOYMENT_LABELS,
    FieldError,
    GENDER_LABELS,
    Note,
    PageHeader,
    SplitLayout,
    StatusDot,
    WEEKDAYS,
    WEEKDAY_NAMES,
    capitalise,
    longDate,
    primaryButtonClass,
    pronounsFor,
    quietLinkClass,
    sectionLabelClass,
} from '../../components/staff/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface UnavailableTime {
    weekday: number;
    from: string;
    to: string;
    reason: string | null;
}

interface MemberProp {
    id: string;
    name: string;
    formal_name: string;
    initials: string;
    photo_url: string | null;
    role_label: string;
    subjects: string[];
    gender: string | null;
    employment_type: string | null;
    email: string;
    phone: string;
    address: string | null;
    qualification: string | null;
    has_account: boolean;
    invited_on: string | null;
    invitation_expired: boolean;
    joined_on: string | null;
    teaching_days: number | null;
    max_periods_week: number | null;
    max_periods_day: number | null;
    unavailable_times: UnavailableTime[];
    periods_taught: number;
}

interface RecordProps {
    yearLabel: string | null;
    member: MemberProp;
    schoolDays: number;
    periods: string[];
    lastEdit: { by: string | null; on: string } | null;
}

const EMPLOYMENT_NOTES: Record<string, string> = {
    government: 'appointed by the regional delegation',
    school_paid: 'on the school’s own contract',
};

function describeTime(time: UnavailableTime, separator = ' '): string {
    const span =
        time.from === time.to
            ? time.from
            : t(':from to :to', { from: time.from, to: time.to });

    return [`${WEEKDAY_NAMES[time.weekday]}${separator}${span}`, time.reason]
        .filter(Boolean)
        .join(' · ');
}

function Row({
    label,
    children,
    last = false,
}: {
    label: string;
    children: ReactNode;
    last?: boolean;
}) {
    return (
        <div
            className={`flex items-baseline gap-4 border-t border-solid border-border py-3 ${last ? 'border-b' : ''}`}
        >
            <dt className="w-[184px] shrink-0 text-[13px] leading-[1.35] text-text-muted">
                {label}
            </dt>
            <dd className="min-w-0 text-[14px] leading-[1.35] text-text">
                {children}
            </dd>
        </div>
    );
}

function HoursDialog({
    member,
    schoolDays,
    periods,
    onClose,
}: {
    member: MemberProp;
    schoolDays: number;
    periods: string[];
    onClose: () => void;
}) {
    const form = useForm({
        teaching_days: member.teaching_days ?? schoolDays,
        max_periods_week: member.max_periods_week?.toString() ?? '',
        max_periods_day: member.max_periods_day?.toString() ?? '',
        unavailable_times: member.unavailable_times,
    });
    const { data, setData, errors, processing } = form;
    const they = pronounsFor(member.gender);
    const firstDay = WEEKDAYS.findIndex(
        (_, i) => (schoolDays & (1 << i)) !== 0,
    );
    const [adding, setAdding] = useState(false);
    const [draft, setDraft] = useState<UnavailableTime>({
        weekday: Math.max(0, firstDay),
        from: periods[0] ?? '',
        to: periods[0] ?? '',
        reason: '',
    });
    const fieldClass =
        'h-10 w-full rounded-md border border-solid border-border bg-white px-3 font-mono text-[15px] leading-5 text-text outline-none focus:border-primary';
    const smallSelectClass =
        'h-9 rounded-md border border-solid border-border bg-white px-2 text-[13px] text-text outline-none focus:border-primary';

    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                onClose();
            }
        }

        document.addEventListener('keydown', onKeyDown);

        return () => document.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    function addTime() {
        const from = periods.indexOf(draft.from);
        const to = periods.indexOf(draft.to);

        setData('unavailable_times', [
            ...data.unavailable_times,
            {
                ...draft,
                // Keep the span in bell order whichever way it was picked.
                from: from > to ? draft.to : draft.from,
                to: from > to ? draft.from : draft.to,
                reason: draft.reason?.trim() || null,
            },
        ]);
        setAdding(false);
        setDraft({ ...draft, reason: '' });
    }

    function submit(event: FormEvent) {
        event.preventDefault();
        form.transform((values) => ({
            ...values,
            max_periods_week: values.max_periods_week || null,
            max_periods_day: values.max_periods_day || null,
        }));
        form.patch(updateHours.url(member.id), {
            preserveScroll: true,
            onSuccess: onClose,
        });
    }

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="hours-title"
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#10191580] p-4"
        >
            <form
                onSubmit={submit}
                className="flex w-full max-w-[540px] flex-col gap-[18px] rounded-lg bg-white p-6 shadow-[0_24px_60px_rgba(16,25,21,0.28)]"
            >
                <div className="flex flex-col gap-1">
                    <h2
                        id="hours-title"
                        className="font-display text-[22px] leading-7 font-bold text-text"
                    >
                        {t('Teaching days and hours')}
                    </h2>
                    <p className="text-[14px] leading-5 text-text-muted">
                        {[member.name, member.subjects.join(', ')]
                            .filter(Boolean)
                            .join(' · ')}
                    </p>
                </div>

                <div className="flex flex-col gap-2">
                    <span className="text-[13px] leading-4 font-medium text-text">
                        {t('Days :subject can teach', {
                            subject: they.subject,
                        })}
                    </span>
                    <div className="flex flex-wrap gap-2">
                        {WEEKDAYS.map((name) => t(name)).map((day, i) => {
                            const bit = 1 << i;

                            if ((schoolDays & bit) === 0) {
                                return null;
                            }

                            const on = (data.teaching_days & bit) !== 0;

                            return (
                                <button
                                    key={day}
                                    type="button"
                                    aria-pressed={on}
                                    onClick={() =>
                                        setData(
                                            'teaching_days',
                                            data.teaching_days ^ bit,
                                        )
                                    }
                                    className={`flex h-9 w-16 shrink-0 items-center justify-center rounded-md border border-solid text-[13px] leading-4 ${
                                        on
                                            ? 'border-primary bg-primary-tint font-semibold text-primary'
                                            : 'border-border font-medium text-text-muted'
                                    }`}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>
                    <FieldError message={errors.teaching_days} />
                </div>

                <div className="flex gap-3">
                    <label className="flex flex-1 flex-col gap-[6px] text-[13px] leading-4 font-medium text-text">
                        {t('Most periods a week')}
                        <input
                            type="number"
                            min={1}
                            max={60}
                            placeholder={t('No limit')}
                            value={data.max_periods_week}
                            onChange={(e) =>
                                setData('max_periods_week', e.target.value)
                            }
                            className={fieldClass}
                        />
                        <FieldError message={errors.max_periods_week} />
                    </label>
                    <label className="flex flex-1 flex-col gap-[6px] text-[13px] leading-4 font-medium text-text">
                        {t('Most periods a day')}
                        <input
                            type="number"
                            min={1}
                            max={12}
                            placeholder="6"
                            value={data.max_periods_day}
                            onChange={(e) =>
                                setData('max_periods_day', e.target.value)
                            }
                            className={fieldClass}
                        />
                        <FieldError message={errors.max_periods_day} />
                    </label>
                </div>

                <div className="flex flex-col gap-2">
                    <span className="text-[13px] leading-4 font-medium text-text">
                        {t('Times :subject cannot teach', {
                            subject: they.subject,
                        })}
                    </span>
                    {data.unavailable_times.map((time, position) => (
                        <div
                            key={`${time.weekday}-${time.from}-${time.to}-${position}`}
                            className="flex items-center gap-[10px] rounded-md bg-surface px-3 py-[10px]"
                        >
                            <span className="flex-1 text-[14px] leading-[18px] text-text">
                                {describeTime(time, ' · ')}
                            </span>
                            <button
                                type="button"
                                onClick={() =>
                                    setData(
                                        'unavailable_times',
                                        data.unavailable_times.filter(
                                            (_, i) => i !== position,
                                        ),
                                    )
                                }
                                className="text-[13px] leading-4 font-medium text-danger hover:underline"
                            >
                                {t('Remove')}
                            </button>
                        </div>
                    ))}
                    {adding ? (
                        <div className="flex flex-wrap items-center gap-2 rounded-md border border-solid border-border p-3">
                            <select
                                aria-label={t('Day')}
                                value={draft.weekday}
                                onChange={(e) =>
                                    setDraft({
                                        ...draft,
                                        weekday: Number(e.target.value),
                                    })
                                }
                                className={smallSelectClass}
                            >
                                {WEEKDAY_NAMES.map((day, i) =>
                                    (schoolDays & (1 << i)) !== 0 ? (
                                        <option key={day} value={i}>
                                            {day}
                                        </option>
                                    ) : null,
                                )}
                            </select>
                            <select
                                aria-label={t('From period')}
                                value={draft.from}
                                onChange={(e) =>
                                    setDraft({ ...draft, from: e.target.value })
                                }
                                className={smallSelectClass}
                            >
                                {periods.map((period) => (
                                    <option key={period}>{period}</option>
                                ))}
                            </select>
                            <span className="text-[13px] text-text-muted">
                                {t('to')}
                            </span>
                            <select
                                aria-label={t('To period')}
                                value={draft.to}
                                onChange={(e) =>
                                    setDraft({ ...draft, to: e.target.value })
                                }
                                className={smallSelectClass}
                            >
                                {periods.map((period) => (
                                    <option key={period}>{period}</option>
                                ))}
                            </select>
                            <input
                                type="text"
                                aria-label={t('Reason')}
                                placeholder={t('Reason, e.g. staff meeting')}
                                maxLength={100}
                                value={draft.reason ?? ''}
                                onChange={(e) =>
                                    setDraft({
                                        ...draft,
                                        reason: e.target.value,
                                    })
                                }
                                className={`${smallSelectClass} min-w-[140px] flex-1`}
                            />
                            <button
                                type="button"
                                onClick={addTime}
                                className="h-9 rounded-md border border-solid border-border px-3 text-[13px] font-medium text-primary hover:bg-surface"
                            >
                                {t('Add')}
                            </button>
                        </div>
                    ) : periods.length > 0 ? (
                        <button
                            type="button"
                            onClick={() => setAdding(true)}
                            className="self-start text-[13px] leading-4 font-medium text-primary hover:underline"
                        >
                            {t('+ Add a time :subject cannot teach', {
                                subject: they.subject,
                            })}
                        </button>
                    ) : (
                        <p className="text-[13px] leading-[18px] text-text-muted">
                            {t(
                                'Add the school’s periods in School Setup to block out times.',
                            )}
                        </p>
                    )}
                    <FieldError message={errors.unavailable_times} />
                </div>

                <p className="rounded-md bg-surface p-3 text-[13px] leading-[18px] text-text-muted">
                    {t(
                        'The live timetable is not touched. New limits apply the next time you generate.',
                    )}
                </p>

                <div className="flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-[38px] items-center rounded-md border border-solid border-border bg-white px-4 text-[14px] font-medium text-text hover:bg-surface"
                    >
                        {t('Cancel')}
                    </button>
                    <button
                        type="submit"
                        disabled={processing || data.teaching_days === 0}
                        className="flex h-[38px] items-center rounded-md bg-primary px-4 text-[14px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
                    >
                        {t('Save hours')}
                    </button>
                </div>
            </form>
        </div>
    );
}

function StaffRecord({
    yearLabel,
    member,
    schoolDays,
    periods,
    lastEdit,
}: RecordProps) {
    const [changingHours, setChangingHours] = useState(false);
    const [reminded, setReminded] = useState(false);
    const [reminderError, setReminderError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const they = pronounsFor(member.gender);
    const Their = capitalise(they.possessive);
    const employment = member.employment_type
        ? EMPLOYMENT_LABELS[member.employment_type]
        : null;
    const teachingDays = member.teaching_days ?? schoolDays;
    const subjects = member.subjects.join(', ');

    function sendReminder() {
        setSending(true);
        router.post(
            remind.url(member.id),
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    setReminded(true);
                    setReminderError(null);
                },
                onError: (failed) =>
                    setReminderError(Object.values(failed)[0] ?? null),
                onFinish: () => setSending(false),
            },
        );
    }

    return (
        <div className="flex flex-col gap-7 lg:min-h-[calc(100vh-56px)]">
            <Head title={member.name} />
            <PageHeader
                crumb={member.name}
                title={t('One staff record')}
                tag={t('Record:year_label', {
                    year_label: yearLabel ? ` · ${yearLabel}` : '',
                })}
                meta={[
                    member.formal_name,
                    member.role_label,
                    employment,
                    member.has_account ? 'portal on' : 'no account yet',
                ]
                    .filter(Boolean)
                    .join(' · ')}
            />

            <SplitLayout
                aside={
                    <>
                        <div className="flex flex-col gap-3">
                            <p className={sectionLabelClass}>
                                {t(':their portal account', { their: Their })}
                            </p>
                            {member.has_account ? (
                                <div className="flex items-center gap-2 text-[13px] leading-[1.5] text-text">
                                    <StatusDot tone="success" />
                                    {capitalise(they.subject)} {they.has}{' '}
                                    {t('set')} {they.possessive}{' '}
                                    {t('password and can sign in.')}
                                </div>
                            ) : (
                                <>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2 text-[13px] leading-[1.5] text-text">
                                            <StatusDot tone="warning" />
                                            {!member.invited_on
                                                ? t(
                                                      'No invitation has been sent yet.',
                                                  )
                                                : member.invitation_expired
                                                  ? t(
                                                        'The invitation sent on :invited_on has expired.',
                                                        {
                                                            invited_on:
                                                                longDate(
                                                                    member.invited_on,
                                                                    false,
                                                                ),
                                                        },
                                                    )
                                                  : t(
                                                        ':subject :has not yet opened the invitation sent on :invited_on.',
                                                        {
                                                            subject: capitalise(
                                                                they.subject,
                                                            ),
                                                            has: they.has,
                                                            invited_on:
                                                                longDate(
                                                                    member.invited_on,
                                                                    false,
                                                                ),
                                                        },
                                                    )}
                                        </div>
                                        <p className="text-[13px] leading-[1.5] text-text-muted">
                                            {t(
                                                'Until :subject :does, :subject :has no portal login, and :possessive subjects sit empty on the timetable.',
                                                {
                                                    subject: they.subject,
                                                    does: they.does,
                                                    has: they.has,
                                                    possessive: they.possessive,
                                                },
                                            )}
                                        </p>
                                    </div>
                                    {member.invited_on ? (
                                        <button
                                            type="button"
                                            disabled={sending}
                                            onClick={sendReminder}
                                            className={primaryButtonClass}
                                        >
                                            {member.invitation_expired
                                                ? t('Send a new link')
                                                : t('Send a reminder')}
                                        </button>
                                    ) : (
                                        <Link
                                            href={access.url(member.id)}
                                            className={primaryButtonClass}
                                        >
                                            {t('Set up portal access')}
                                        </Link>
                                    )}
                                    {reminded && !reminderError && (
                                        <p
                                            role="status"
                                            className="text-[12px] leading-4 text-success"
                                        >
                                            {t(
                                                'A fresh link is on its way. It works for seven days.',
                                            )}
                                        </p>
                                    )}
                                    <FieldError
                                        message={reminderError ?? undefined}
                                    />
                                </>
                            )}
                        </div>
                        <Note title={t('Corrections are normal')}>
                            {t(
                                'Nothing in this record was checked with a government body. If a detail is wrong, change it here and :subject :sees the correction in :possessive portal.',
                                {
                                    subject: they.subject,
                                    sees: they.sees,
                                    possessive: they.possessive,
                                },
                            )}
                        </Note>
                        <div className="mt-auto flex flex-col gap-2">
                            <p className="text-[12px] leading-[1.5] text-text-muted">
                                {lastEdit
                                    ? t('Last edited:by on :on. ', {
                                          by: lastEdit.by
                                              ? ` by the ${lastEdit.by}`
                                              : '',
                                          on: longDate(lastEdit.on, false),
                                      })
                                    : ''}
                                {t('Every change is kept in the log.')}
                            </p>
                            <div className="flex flex-wrap gap-2">
                                <Link
                                    href={edit.url(member.id)}
                                    className="flex h-9 items-center rounded-md border border-solid border-border px-4 text-[14px] font-medium text-primary hover:bg-surface"
                                >
                                    {t('Edit :possessive record', {
                                        possessive: they.possessive,
                                    })}
                                </Link>
                                <Link
                                    href={index.url()}
                                    className={quietLinkClass}
                                >
                                    {t('Back to roster')}
                                </Link>
                            </div>
                        </div>
                    </>
                }
            >
                <div className="flex flex-wrap items-center gap-4">
                    <Avatar
                        initials={member.initials}
                        photoUrl={member.photo_url}
                        size={56}
                    />
                    <div className="flex min-w-0 flex-col gap-1">
                        <p className="font-display text-[20px] leading-[1.1] font-semibold text-text">
                            {member.name}
                        </p>
                        <p className="text-[13px] leading-[1.35] text-text-muted">
                            {[member.role_label, subjects, employment]
                                .filter(Boolean)
                                .join(' · ')}
                        </p>
                    </div>
                    <span className="ml-auto flex h-7 shrink-0 items-center gap-2 rounded-md border border-solid border-border px-3 text-[13px] font-medium text-text">
                        <StatusDot
                            tone={member.has_account ? 'success' : 'warning'}
                        />
                        {member.has_account
                            ? t('Portal on')
                            : t('No portal account')}
                    </span>
                </div>

                <section className="flex flex-col gap-2">
                    <p className={sectionLabelClass}>
                        {t('Who')} {they.subject}{' '}
                        {they.subject === 'they' ? t('are') : t('is')}
                    </p>
                    <dl className="flex flex-col">
                        <Row label={t('Gender')}>
                            {member.gender ? GENDER_LABELS[member.gender] : '—'}
                        </Row>
                        <Row label={t('Highest qualification')}>
                            {member.qualification ?? '—'}
                        </Row>
                        <Row label={t('Address')}>{member.address ?? '—'}</Row>
                        <Row label={t('Email')}>{member.email}</Row>
                        <Row label={t('Phone')}>{member.phone}</Row>
                    </dl>
                </section>

                <section className="flex flex-col gap-2">
                    <p className={sectionLabelClass}>
                        {t(':their work here', { their: Their })}
                    </p>
                    <dl className="flex flex-col">
                        <Row label={t('Portal role')}>
                            {member.role_label}{' '}
                            <Link
                                href={access.url(member.id)}
                                className="ml-2 text-[13px] font-medium text-primary hover:underline"
                            >
                                {t('Change')}
                            </Link>
                        </Row>
                        <Row label={t('Subjects')}>
                            {subjects || t('None assigned yet')}
                        </Row>
                        <Row label={t('Employment type')}>
                            {employment
                                ? `${employment} · ${EMPLOYMENT_NOTES[member.employment_type ?? '']}`
                                : '—'}
                        </Row>
                        <Row label={t('Joined this school')}>
                            {longDate(member.joined_on)}
                        </Row>
                    </dl>
                </section>

                <section className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between">
                        <p className={sectionLabelClass}>
                            {t(':their teaching days and hours', {
                                their: Their,
                            })}
                        </p>
                        <button
                            type="button"
                            onClick={() => setChangingHours(true)}
                            className="text-[13px] leading-4 font-medium text-primary hover:underline"
                        >
                            {t('Change')}
                        </button>
                    </div>
                    <dl className="flex flex-col">
                        <div className="flex items-center gap-4 border-t border-solid border-border py-[9px]">
                            <dt className="w-[176px] shrink-0 text-[13px] text-text-muted">
                                {t('Teaching days')}
                            </dt>
                            <dd className="flex flex-wrap gap-[6px]">
                                {WEEKDAYS.map((name) => t(name)).map(
                                    (day, i) => {
                                        const bit = 1 << i;

                                        if ((schoolDays & bit) === 0) {
                                            return null;
                                        }

                                        return (
                                            <span
                                                key={day}
                                                className={`flex h-[26px] w-11 shrink-0 items-center justify-center rounded-sm text-[12px] leading-4 ${
                                                    (teachingDays & bit) !== 0
                                                        ? 'bg-primary-tint font-semibold text-primary'
                                                        : 'border border-solid border-border text-text-muted'
                                                }`}
                                            >
                                                {day}
                                            </span>
                                        );
                                    },
                                )}
                            </dd>
                        </div>
                        <Row label={t('Most periods a week')}>
                            {member.max_periods_week ?? t('No limit')} ·{' '}
                            {they.subject}{' '}
                            {they.subject === 'they'
                                ? t('teach')
                                : t('teaches')}{' '}
                            {member.periods_taught} {t('now')}
                        </Row>
                        <Row label={t('Most periods a day')}>
                            <span className="font-mono">
                                {member.max_periods_day ?? 6}
                            </span>
                        </Row>
                        <Row label={t('Cannot teach')} last>
                            {member.unavailable_times.length > 0 ? (
                                <span className="flex flex-col gap-1">
                                    {member.unavailable_times.map((time, i) => (
                                        <span key={i}>
                                            {describeTime(time)}
                                        </span>
                                    ))}
                                </span>
                            ) : (
                                t('Nothing set')
                            )}
                        </Row>
                    </dl>
                    <p className="text-[13px] leading-[19px] text-text-muted">
                        {t(
                            'If nothing is set, a teacher can teach every day, up to 6 periods a day. The timetable only reads this.',
                        )}
                    </p>
                </section>
            </SplitLayout>

            {changingHours && (
                <HoursDialog
                    member={member}
                    schoolDays={schoolDays}
                    periods={periods}
                    onClose={() => setChangingHours(false)}
                />
            )}
        </div>
    );
}

export default withAppShell(StaffRecord);
