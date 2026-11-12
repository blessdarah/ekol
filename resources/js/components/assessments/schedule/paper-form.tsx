import { router, useForm } from '@inertiajs/react';
import {
    destroy,
    save,
} from '@/actions/App/Http/Controllers/ExamScheduleController';
import { t } from '../../../lib/i18n';
import { ErrorText, fieldLabelClass } from '../../structure/ui';
import { type PlanSummary, primaryClass } from '../ui';
import { type Row, type ScheduleProps, inputClass } from './model';

/** Set or change one subject's paper: day, time, room and invigilators. */
export function PaperForm({
    plan,
    levelId,
    row,
    rooms,
    staff,
    onClose,
}: {
    plan: PlanSummary;
    levelId: string;
    row: Row;
    rooms: NonNullable<ScheduleProps['rooms']>;
    staff: NonNullable<ScheduleProps['staff']>;
    onClose: () => void;
}) {
    const form = useForm({
        level_id: levelId,
        subject_id: row.subject_id,
        held_on: row.paper?.held_on ?? plan.held_from ?? '',
        starts_at: row.paper?.starts_at ?? '08:00',
        hours: String(row.paper?.hours ?? 2),
        room_id: row.paper?.room_id ?? '',
        invigilator_ids: row.paper?.invigilator_ids ?? ([] as string[]),
    });
    const { data, setData } = form;
    const errors = form.errors as Record<string, string | undefined>;
    const left = staff.filter(
        (member) => !data.invigilator_ids.includes(member.id),
    );

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                form.transform((values) => ({
                    ...values,
                    hours: Number(values.hours),
                    room_id: values.room_id || null,
                }));
                form.post(save.url(plan.id), {
                    preserveScroll: true,
                    onSuccess: onClose,
                });
            }}
            className="flex flex-col gap-3 rounded-lg border border-solid border-primary bg-white p-4"
        >
            <p className="text-[14px] leading-[18px] font-semibold text-text">
                {row.subject}
            </p>
            <div className="flex gap-2">
                <label
                    className={`flex min-w-0 flex-[1.5] flex-col gap-[6px] ${fieldLabelClass}`}
                >
                    {t('Day')}
                    <input
                        type="date"
                        value={data.held_on}
                        min={plan.held_from ?? undefined}
                        max={plan.held_until ?? undefined}
                        onChange={(e) => setData('held_on', e.target.value)}
                        className={`${inputClass} font-mono`}
                    />
                </label>
                <label
                    className={`flex min-w-0 flex-1 flex-col gap-[6px] ${fieldLabelClass}`}
                >
                    {t('Time')}
                    <input
                        type="time"
                        value={data.starts_at}
                        onChange={(e) => setData('starts_at', e.target.value)}
                        className={`${inputClass} font-mono`}
                    />
                </label>
            </div>
            <div className="flex gap-2">
                <label
                    className={`flex w-[84px] shrink-0 flex-col gap-[6px] ${fieldLabelClass}`}
                >
                    {t('Hours')}
                    <input
                        type="number"
                        min={0.5}
                        max={6}
                        step={0.5}
                        value={data.hours}
                        onChange={(e) => setData('hours', e.target.value)}
                        className={`${inputClass} font-mono`}
                    />
                </label>
                <label
                    className={`flex min-w-0 flex-1 flex-col gap-[6px] ${fieldLabelClass}`}
                >
                    {t('Room')}
                    <select
                        value={data.room_id}
                        onChange={(e) => setData('room_id', e.target.value)}
                        className={inputClass}
                    >
                        <option value="">{t('Not set')}</option>
                        {rooms.map((room) => (
                            <option key={room.id} value={room.id}>
                                {t(':code · :capacity seats', {
                                    code: room.code,
                                    capacity: room.capacity,
                                })}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            <div className="flex flex-col gap-[6px]">
                <span className={fieldLabelClass}>{t('Invigilators')}</span>
                <div className="flex flex-wrap gap-[6px]">
                    {data.invigilator_ids.map((id) => (
                        <button
                            key={id}
                            type="button"
                            title={t('Remove')}
                            onClick={() =>
                                setData(
                                    'invigilator_ids',
                                    data.invigilator_ids.filter(
                                        (item) => item !== id,
                                    ),
                                )
                            }
                            className="flex h-6 items-center gap-1 rounded-sm bg-primary-tint px-2 text-[12px] leading-4 font-medium text-primary hover:bg-surface"
                        >
                            {staff.find((member) => member.id === id)?.name} ×
                        </button>
                    ))}
                    {data.invigilator_ids.length === 0 && (
                        <span className="text-[13px] leading-6 text-text-muted">
                            {t('None yet')}
                        </span>
                    )}
                </div>
                {left.length > 0 && (
                    <select
                        aria-label={t('Add an invigilator')}
                        value=""
                        onChange={(e) =>
                            e.target.value &&
                            setData('invigilator_ids', [
                                ...data.invigilator_ids,
                                e.target.value,
                            ])
                        }
                        className={inputClass}
                    >
                        <option value="">{t('Add an invigilator…')}</option>
                        {left.map((member) => (
                            <option key={member.id} value={member.id}>
                                {member.name}
                            </option>
                        ))}
                    </select>
                )}
            </div>
            <ErrorText message={Object.values(errors).find(Boolean)} />
            <div className="flex flex-wrap items-center gap-3">
                <button
                    type="submit"
                    disabled={form.processing || !data.held_on}
                    className={primaryClass}
                >
                    {t('Save paper')}
                </button>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-[13px] leading-4 font-medium text-text-muted hover:underline"
                >
                    {t('Cancel')}
                </button>
                {row.paper && (
                    <button
                        type="button"
                        onClick={() =>
                            router.delete(
                                destroy.url({
                                    plan: plan.id,
                                    paper: row.paper?.id ?? '',
                                }),
                                { preserveScroll: true, onSuccess: onClose },
                            )
                        }
                        className="ml-auto text-[13px] leading-4 font-medium text-danger hover:underline"
                    >
                        {t('Remove paper')}
                    </button>
                )}
            </div>
        </form>
    );
}
