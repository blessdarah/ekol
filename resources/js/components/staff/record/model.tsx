import { router } from '@inertiajs/react';
import { useState } from 'react';
import { remind } from '@/actions/App/Http/Controllers/StaffAccessController';
import {
    EMPLOYMENT_LABELS,
    WEEKDAY_NAMES,
    capitalise,
    pronounsFor,
} from '../ui';
import { t } from '../../../lib/i18n';

export interface UnavailableTime {
    weekday: number;
    from: string;
    to: string;
    reason: string | null;
}

export interface MemberProp {
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

export interface RecordProps {
    yearLabel: string | null;
    member: MemberProp;
    schoolDays: number;
    periods: string[];
    lastEdit: { by: string | null; on: string } | null;
}

export const EMPLOYMENT_NOTES: Record<string, string> = {
    government: 'appointed by the regional delegation',
    school_paid: 'on the school’s own contract',
};

export function describeTime(time: UnavailableTime, separator = ' '): string {
    const span =
        time.from === time.to
            ? time.from
            : t(':from to :to', { from: time.from, to: time.to });

    return [`${WEEKDAY_NAMES[time.weekday]}${separator}${span}`, time.reason]
        .filter(Boolean)
        .join(' · ');
}

/** One staff member's record, how to word it, and reminding them to sign in. */
export function useStaffRecord({
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

    return {
        yearLabel,
        member,
        schoolDays,
        periods,
        lastEdit,
        changingHours,
        setChangingHours,
        reminded,
        reminderError,
        sending,
        they,
        Their,
        employment,
        teachingDays,
        subjects,
        sendReminder,
    };
}

export type StaffRecordModel = ReturnType<typeof useStaffRecord>;
