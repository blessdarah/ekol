import { Link } from '@inertiajs/react';
import { access } from '@/actions/App/Http/Controllers/StaffAccessController';
import { edit } from '@/actions/App/Http/Controllers/StaffController';
import { index } from '@/actions/App/Http/Controllers/StaffRosterController';
import {
    FieldError,
    Note,
    StatusDot,
    capitalise,
    longDate,
    primaryButtonClass,
    quietLinkClass,
    sectionLabelClass,
} from '../ui';
import { t } from '../../../lib/i18n';
import { type StaffRecordModel } from './model';

/** The portal account, the corrections note and the record's actions. */
export function RecordAside({ record }: { record: StaffRecordModel }) {
    const {
        member,
        lastEdit,
        reminded,
        reminderError,
        sending,
        they,
        Their,
        sendReminder,
    } = record;

    return (
        <>
            <div className="flex flex-col gap-3">
                <p className={sectionLabelClass}>
                    {t(':their portal account', { their: Their })}
                </p>
                {member.has_account ? (
                    <div className="flex items-center gap-2 text-[13px] leading-[1.5] text-text">
                        <StatusDot tone="success" />
                        {capitalise(they.subject)} {they.has} {t('set')}{' '}
                        {they.possessive} {t('password and can sign in.')}
                    </div>
                ) : (
                    <>
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-[13px] leading-[1.5] text-text">
                                <StatusDot tone="warning" />
                                {!member.invited_on
                                    ? t('No invitation has been sent yet.')
                                    : member.invitation_expired
                                      ? t(
                                            'The invitation sent on :invited_on has expired.',
                                            {
                                                invited_on: longDate(
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
                                                invited_on: longDate(
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
                        <FieldError message={reminderError ?? undefined} />
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
                              by: lastEdit.by ? ` by the ${lastEdit.by}` : '',
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
                    <Link href={index.url()} className={quietLinkClass}>
                        {t('Back to roster')}
                    </Link>
                </div>
            </div>
        </>
    );
}
