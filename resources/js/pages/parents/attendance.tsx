import { Head } from '@inertiajs/react';
import { home } from '@/actions/App/Http/Controllers/ParentController';
import { dayMonth } from '../../components/fees/ui';
import {
    ChildSummary,
    PayHeading,
    PayShell,
    type ChildCard,
    type Issuer,
} from '../../components/pay/ui';
import { useT } from '../../lib/i18n';

interface AttendanceProps {
    issuer: Issuer;
    student: ChildCard;
    termLabel: string | null;
    stats: {
        present: number;
        late: number;
        absent: number;
        days: number;
        rate: number | null;
    };
    events: {
        id: string;
        on: string;
        status: string;
        lesson: string;
        note: string | null;
    }[];
}

const STATUS: Record<string, { label: string; pill: string }> = {
    absent: { label: 'Absent', pill: 'bg-danger-tint text-danger' },
    excused: { label: 'Excused', pill: 'bg-surface text-text-muted' },
    late: { label: 'Late', pill: 'bg-warning-tint text-[#8A5A12]' },
};

export default function ParentAttendance({
    issuer,
    student,
    termLabel,
    stats,
    events,
}: AttendanceProps) {
    const t = useT();
    const figures = [
        { label: t('Days present'), value: stats.present },
        { label: t('Days late'), value: stats.late },
        { label: t('Days away'), value: stats.absent },
    ];

    return (
        <PayShell issuer={issuer} back={home.url()}>
            <Head title={`${t('Attendance')} — ${student.name}`} />
            <ChildSummary student={student} />
            <PayHeading
                title={t('Attendance')}
                sub={
                    termLabel
                        ? stats.rate === null
                            ? t(
                                  'No register has been taken for :name in :term yet.',
                                  { name: student.name, term: t(termLabel) },
                              )
                            : t(
                                  ':rate% of the :days school days counted in :term.',
                                  {
                                      rate: stats.rate,
                                      days: stats.days,
                                      term: t(termLabel),
                                  },
                              )
                        : t('The school has no term running at the moment.')
                }
            />
            {stats.days > 0 && (
                <div className="grid grid-cols-3 gap-2">
                    {figures.map((figure) => (
                        <div
                            key={figure.label}
                            className="flex flex-col gap-1 rounded-xl border border-solid border-border bg-white px-4 py-3"
                        >
                            <span className="font-mono text-[22px] leading-7 font-bold">
                                {figure.value}
                            </span>
                            <span className="text-[13px] text-text-muted">
                                {figure.label}
                            </span>
                        </div>
                    ))}
                </div>
            )}
            {stats.days > 0 && (
                <div className="flex flex-col gap-2">
                    <h2 className="text-[15px] font-semibold">
                        {t('Absences and late arrivals')}
                    </h2>
                    {events.length === 0 ? (
                        <p className="rounded-xl bg-success-tint px-4 py-3 text-[14px] text-success">
                            {t(
                                'None this term. Every lesson attended on time.',
                            )}
                        </p>
                    ) : (
                        <ul className="flex flex-col divide-y divide-border rounded-xl border border-solid border-border bg-white">
                            {events.map((event) => {
                                const status =
                                    STATUS[event.status] ?? STATUS.absent;

                                return (
                                    <li
                                        key={event.id}
                                        className="flex items-start gap-3 px-4 py-3"
                                    >
                                        <span className="w-14 shrink-0 font-mono text-[13px] leading-6 text-text-muted">
                                            {dayMonth(event.on, false)}
                                        </span>
                                        <span className="flex min-w-0 flex-1 flex-col">
                                            <span className="text-[14px] leading-6">
                                                {event.lesson || t('Lesson')}
                                            </span>
                                            {event.note && (
                                                <span className="text-[13px] text-text-muted">
                                                    {event.note}
                                                </span>
                                            )}
                                        </span>
                                        <span
                                            className={`flex h-6 shrink-0 items-center rounded-full px-[10px] text-[12px] font-medium ${status.pill}`}
                                        >
                                            {t(status.label)}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}
            <p className="text-[13px] text-text-muted">
                {t(
                    'To excuse an absence, contact the school office with the reason.',
                )}
            </p>
        </PayShell>
    );
}
