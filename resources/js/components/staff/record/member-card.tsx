import { Avatar, StatusDot } from '../ui';
import { t } from '../../../lib/i18n';
import { type StaffRecordModel } from './model';

/** The member's photo, name and whether they can sign in. */
export function MemberCard({ record }: { record: StaffRecordModel }) {
    const { member, employment, subjects } = record;

    return (
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
                <StatusDot tone={member.has_account ? 'success' : 'warning'} />
                {member.has_account ? t('Portal on') : t('No portal account')}
            </span>
        </div>
    );
}
