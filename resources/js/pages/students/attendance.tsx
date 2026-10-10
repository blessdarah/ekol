import { Head, Link, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { excuse } from '@/actions/App/Http/Controllers/StudentAttendanceController';
import { edit } from '@/actions/App/Http/Controllers/StudentController';
import { ErrorText, capsLabelClass, outlineButtonClass } from '../../components/structure/ui';
import { StudentHeader, StudentTabs, shortDate } from '../../components/students/ui';
import { withAppShell } from '../../layouts/app-layout';

type DayState = 'present' | 'late' | 'absent' | 'excused';

interface AttendanceProps {
    canExcuse: boolean;
    termLabel: string | null;
    student: { id: string; name: string; matricule: string; class: string | null; level: string | null; admitted_year: string };
    stats: { present: number; late: number; absent: number; days: number; rate: number | null };
    term: { starts_on: string; ends_on: string } | null;
    schoolDays: number;
    days: Record<string, DayState>;
    events: { id: string; on: string; status: string; lesson: string; note: string | null; by: string | null }[];
    unexcused: number;
    alertAt: number;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const amber = 'text-[#8A5A12]';

const BOXES: Record<DayState, { letter: string; box: string }> = {
    present: { letter: 'P', box: 'border-success bg-success-tint text-success' },
    late: { letter: 'L', box: `border-warning bg-warning-tint ${amber}` },
    absent: { letter: 'A', box: 'border-danger bg-danger-tint text-danger' },
    excused: { letter: 'E', box: 'border-border bg-surface text-text-muted' },
};

const PILLS: Record<string, { label: string; pill: string }> = {
    late: { label: 'Late', pill: `bg-warning-tint ${amber}` },
    absent: { label: 'Absent', pill: 'bg-danger-tint text-danger' },
    excused: { label: 'Excused', pill: 'border border-solid border-border bg-surface text-text' },
};

function iso(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** The term's weeks up to today, each as the dates of its school days. */
function weeksOf(term: { starts_on: string; ends_on: string }, schoolDays: number): { label: string; dates: (string | null)[] }[] {
    const start = new Date(`${term.starts_on}T12:00:00`);
    const end = new Date(`${term.ends_on}T12:00:00`);
    const today = new Date();
    const monday = new Date(start);
    monday.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const weeks: { label: string; dates: (string | null)[] }[] = [];

    for (let cursor = new Date(monday), number = 1; cursor <= end && cursor <= today; cursor.setDate(cursor.getDate() + 7), number++) {
        const dates = WEEKDAYS.map((_, index) => {
            if ((schoolDays & (1 << index)) === 0) {
                return undefined;
            }

            const date = new Date(cursor);
            date.setDate(cursor.getDate() + index);

            return date >= start && date <= end ? iso(date) : null;
        }).filter((value): value is string | null => value !== undefined);

        weeks.push({ label: `Week ${number} · ${shortDate(iso(cursor))}`, dates });
    }

    return weeks;
}

function Excuse({ studentId, recordId, onClose }: { studentId: string; recordId: string; onClose: () => void }) {
    const form = useForm({ note: '' });
    const errors = form.errors as Record<string, string | undefined>;

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                form.post(excuse.url({ student: studentId, attendance: recordId }), { preserveScroll: true, onSuccess: onClose });
            }}
            className="flex flex-wrap items-start gap-2 pb-3"
        >
            <input
                type="text"
                autoFocus
                aria-label="Why the absence is excused"
                value={form.data.note}
                onChange={(e) => form.setData('note', e.target.value)}
                placeholder="Reason, such as sick with a note from the parent"
                className="h-9 min-w-[240px] flex-1 rounded-md border border-solid border-border px-3 text-[13px] leading-4 text-text outline-none focus:border-primary"
            />
            <button type="submit" disabled={form.processing} className="flex h-9 items-center rounded-md bg-primary px-4 text-[13px] leading-4 font-semibold text-white hover:bg-primary-hover disabled:opacity-40">
                Excuse it
            </button>
            <button type="button" onClick={onClose} className={outlineButtonClass}>
                Cancel
            </button>
            <div className="basis-full">
                <ErrorText message={errors.note} />
            </div>
        </form>
    );
}

function StudentAttendance({ canExcuse, termLabel, student, stats, term, schoolDays, days, events, unexcused, alertAt }: AttendanceProps) {
    const [excusing, setExcusing] = useState<string | null>(null);
    const weeks = term ? weeksOf(term, schoolDays) : [];
    const shown = WEEKDAYS.filter((_, index) => (schoolDays & (1 << index)) !== 0);
    const figures = [
        { label: 'Present', value: String(stats.present), tone: 'text-success', note: stats.present === 1 ? 'day' : 'days' },
        { label: 'Late or part', value: String(stats.late), tone: stats.late > 0 ? amber : 'text-text', note: stats.late === 1 ? 'day' : 'days' },
        { label: 'Absent', value: String(stats.absent), tone: stats.absent > 0 ? 'text-danger' : 'text-text', note: stats.absent === 1 ? 'whole day' : 'whole days' },
        { label: 'Attendance', value: stats.rate === null ? '—' : `${stats.rate}%`, tone: 'text-text', note: `of ${stats.days} ${stats.days === 1 ? 'day' : 'days'} with a register` },
    ];

    return (
        <div className="flex min-h-[calc(100vh-56px)] flex-col gap-5">
            <Head title={`${student.name} · Attendance`} />
            <StudentHeader
                trail={[{ label: student.name }, { label: 'Attendance' }]}
                title={student.name}
                tag={[student.matricule, student.class].filter(Boolean).join(' · ')}
                meta={[`enrolled ${student.admitted_year}`, student.level].filter(Boolean).join(' · ')}
                action={
                    <Link href={edit.url(student.id)} className={outlineButtonClass}>
                        Edit student
                    </Link>
                }
            />
            <StudentTabs studentId={student.id} active="attendance" />

            <div className="flex flex-1 flex-col gap-8 lg:flex-row">
                <div className="flex min-w-0 flex-1 flex-col gap-6">
                    <div className="flex flex-wrap border-y border-solid border-border">
                        {figures.map((figure, position) => (
                            <div
                                key={figure.label}
                                className={`flex min-w-[130px] flex-1 flex-col gap-1 py-[14px] ${position === 0 ? 'pr-4' : 'border-l border-solid border-border px-4'}`}
                            >
                                <span className={capsLabelClass}>{figure.label}</span>
                                <span className={`font-display text-[28px] leading-8 font-extrabold ${figure.tone}`}>{figure.value}</span>
                                <span className="text-[13px] leading-4 text-text-muted">{figure.note}</span>
                            </div>
                        ))}
                    </div>

                    <section className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className={capsLabelClass}>{termLabel ?? 'Term'}, week by week</p>
                            <div className="flex flex-wrap gap-4 text-[12px] leading-4 text-text-muted">
                                {(['present', 'late', 'absent', 'excused'] as DayState[]).map((state) => (
                                    <span key={state} className="flex items-center gap-[6px] capitalize">
                                        <span className={`h-[10px] w-[10px] rounded-sm border border-solid ${BOXES[state].box}`} />
                                        {state === 'late' ? 'Late or part of the day' : state}
                                    </span>
                                ))}
                            </div>
                        </div>
                        {weeks.length === 0 ? (
                            <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                                {term ? 'The term has not started.' : 'No term is active, so there are no registers to read.'}
                            </p>
                        ) : (
                            <div className="flex flex-col gap-2 overflow-x-auto">
                                <div className="flex items-center gap-[6px] pl-[116px]">
                                    {shown.map((label) => (
                                        <span key={label} className="w-16 shrink-0 text-center text-[12px] leading-4 text-text-muted">
                                            {label}
                                        </span>
                                    ))}
                                </div>
                                {weeks.map((week) => (
                                    <div key={week.label} className="flex items-center gap-[6px]">
                                        <span className="w-[110px] shrink-0 text-[13px] leading-4 text-text">{week.label}</span>
                                        {week.dates.map((date, position) => {
                                            const state = date ? days[date] : undefined;

                                            return state ? (
                                                <span
                                                    key={position}
                                                    title={date ? shortDate(date) : undefined}
                                                    className={`flex h-[34px] w-16 shrink-0 items-center justify-center rounded-sm border border-solid font-mono text-[11px] leading-[14px] ${BOXES[state].box}`}
                                                >
                                                    {BOXES[state].letter}
                                                </span>
                                            ) : (
                                                <span key={position} className={`h-[34px] w-16 shrink-0 rounded-sm border border-dashed border-border ${date ? '' : 'opacity-0'}`} />
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        )}
                        <p className="text-[12px] leading-[17px] text-text-muted">
                            A day is read from that day’s lesson registers:
                            present in all of them, absent from all of them, or
                            late or missing for part of the day. An empty box
                            is a day no teacher saved a register.
                        </p>
                    </section>

                    <section className="flex flex-col gap-2">
                        <p className={capsLabelClass}>Absences and late arrivals</p>
                        {events.length === 0 ? (
                            <p className="border-y border-solid border-border py-3 text-[13px] leading-[19px] text-text-muted">None recorded this term.</p>
                        ) : (
                            <ul className="flex flex-col border-b border-solid border-border">
                                {events.map((event) => (
                                    <li key={event.id} className="flex flex-col border-t border-solid border-border">
                                        <div className="flex flex-wrap items-center gap-4 py-3">
                                            <span className="w-[60px] shrink-0 font-mono text-[13px] leading-4 text-text">{shortDate(event.on)}</span>
                                            <span className="flex w-[76px] shrink-0">
                                                <span className={`flex h-[22px] items-center rounded-full px-2 text-[12px] leading-4 font-medium ${PILLS[event.status]?.pill ?? ''}`}>
                                                    {PILLS[event.status]?.label ?? event.status}
                                                </span>
                                            </span>
                                            <span className="min-w-0 flex-1 text-[14px] leading-[18px] text-text">
                                                {event.lesson}
                                                {event.note ? `. ${event.note}` : ''}
                                            </span>
                                            <span className="shrink-0 text-[12px] leading-4 text-text-muted">{event.by}</span>
                                            {canExcuse && event.status === 'absent' && excusing !== event.id && (
                                                <button type="button" onClick={() => setExcusing(event.id)} className="shrink-0 text-[13px] leading-4 font-medium text-primary hover:underline">
                                                    Excuse
                                                </button>
                                            )}
                                        </div>
                                        {excusing === event.id && <Excuse studentId={student.id} recordId={event.id} onClose={() => setExcusing(null)} />}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>

                <aside className="flex shrink-0 flex-col gap-5 border-solid border-border lg:w-[328px] lg:border-l lg:pl-8">
                    <div className="flex flex-col gap-3 rounded-lg border border-solid border-border bg-surface p-4">
                        <p className={capsLabelClass}>Who records this</p>
                        <p className="text-[14px] leading-[21px] text-text">
                            Each teacher saves a register for each lesson. This
                            page reads them; the only change made here is
                            excusing an absence.
                        </p>
                    </div>
                    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-4">
                        <p className="text-[13px] leading-4 font-semibold text-text">School rule</p>
                        <p className={`text-[13px] leading-[19px] ${unexcused >= alertAt ? 'text-danger' : 'text-text-muted'}`}>
                            The school looks closer at {alertAt} unexcused lesson
                            absences in a term. This student has {unexcused}.
                            Nobody is alerted automatically.
                        </p>
                    </div>
                </aside>
            </div>
        </div>
    );
}

export default withAppShell(StudentAttendance);
