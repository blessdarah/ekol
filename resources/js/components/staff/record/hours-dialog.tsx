import { useForm } from '@inertiajs/react';
import { useEffect, useState, type FormEvent } from 'react';
import { updateHours } from '@/actions/App/Http/Controllers/StaffController';
import { FieldError, WEEKDAYS, WEEKDAY_NAMES, pronounsFor } from '../ui';
import { t } from '../../../lib/i18n';
import { describeTime, type MemberProp, type UnavailableTime } from './model';

/** Changing the days and periods a teacher can be timetabled. */
export function HoursDialog({
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
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[color-mix(in_srgb,var(--color-text)_50.2%,transparent)] p-4"
        >
            <form
                onSubmit={submit}
                className="flex w-full max-w-[540px] flex-col gap-[18px] rounded-lg bg-white p-6 shadow-[0_24px_60px_color-mix(in_srgb,var(--color-text)_28%,transparent)]"
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
