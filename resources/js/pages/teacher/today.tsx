import { Head, Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { index as sheetsIndex, show as sheetPage } from '@/actions/App/Http/Controllers/MarkSheetController';
import { withAppShell } from '../../layouts/app-layout';

interface Lesson {
    id: string;
    starts_at: string;
    ends_at: string;
    class: string;
    subject: string;
    room: string | null;
    students: number;
    state: 'done' | 'now' | 'next' | 'later';
    marked: boolean;
    in_minutes: number | null;
}

interface SheetRow {
    id: string;
    plan: string;
    class: string;
    subject: string;
    students: number;
    entered: number;
    open: boolean;
    submitted: boolean;
    opens_on: string | null;
    closes_on: string | null;
}

interface TodayProps {
    date: string;
    greeting: string;
    name: string;
    hasTimetable: boolean;
    isSchoolDay: boolean;
    lessons: Lesson[];
    unmarked: number;
    next: Lesson | null;
    sheets: SheetRow[];
    openSheets: number;
    closesOn: string | null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monoCaps = 'font-mono text-[11px] leading-[14px] tracking-[0.08em] uppercase';
const outlineButton = 'flex h-[34px] shrink-0 items-center rounded-md border border-solid border-border px-[14px] text-[13px] leading-4 font-medium text-text hover:bg-surface';

function day(iso: string | null): string {
    if (!iso) {
        return 'soon';
    }

    const [, month, date] = iso.split('-');

    return `${Number(date)} ${MONTHS[Number(month) - 1]}`;
}

function plural(count: number, one: string, many = `${one}s`): string {
    return `${count} ${count === 1 ? one : many}`;
}

function wait(minutes: number): string {
    if (minutes < 60) {
        return `In ${plural(minutes, 'minute')}`;
    }

    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;

    return `In ${plural(hours, 'hour')}${rest > 0 ? ` ${rest} min` : ''}`;
}

function Card({ title, note, children, className = '' }: { title: string; note?: string; children: ReactNode; className?: string }) {
    return (
        <section className={`flex min-w-0 flex-col overflow-clip rounded-lg border border-solid border-border bg-white ${className}`}>
            <header className="flex items-center gap-4 border-b border-solid border-border bg-surface px-4 py-3">
                <h2 className="font-display text-[14px] leading-[18px] font-semibold text-text">{title}</h2>
                {note && <span className="font-mono text-[12px] leading-4 text-text-muted">{note}</span>}
            </header>
            {children}
        </section>
    );
}

/** A section of the design whose feature is not built yet. */
function Pending({ children }: { children: ReactNode }) {
    return <p className="px-4 py-[14px] text-[13px] leading-[19px] text-text-muted">{children}</p>;
}

const LESSON_PILLS: Record<Lesson['state'], { label: string; pill: string }> = {
    done: { label: 'Done', pill: 'bg-surface text-text-muted' },
    now: { label: 'Now', pill: 'bg-white text-primary' },
    next: { label: 'Up next', pill: 'bg-white text-primary' },
    later: { label: 'Later', pill: 'bg-surface text-text-muted' },
};

function Today({ date, greeting, name, hasTimetable, isSchoolDay, lessons, unmarked, next, sheets, openSheets, closesOn }: TodayProps) {
    const summary = [
        hasTimetable ? plural(lessons.length, 'lesson') + ' today' : 'no timetable published yet',
        ...(unmarked > 0 ? [`${unmarked} attendance still to mark`] : []),
        plural(openSheets, 'mark sheet') + ' open',
    ].join(' · ');
    const upcoming = sheets.filter((sheet) => !sheet.open);

    return (
        <div className="flex flex-col gap-6">
            <Head title="Today" />
            <div className="flex flex-wrap items-end justify-between gap-6">
                <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
                    <p className={`${monoCaps} text-text-muted`}>Today · {date}</p>
                    <h1 className="font-display text-[40px] leading-[44px] font-extrabold tracking-[-0.02em] text-text">
                        {greeting}, {name}
                    </h1>
                    <p className="text-[14px] leading-5 text-text-muted">{summary}</p>
                </div>
                <div className="flex gap-3">
                    <Link href="/my-timetable" className="flex h-9 items-center rounded-md border border-solid border-border px-[14px] text-[14px] leading-[18px] font-medium text-text hover:bg-surface">
                        My timetable
                    </Link>
                    <Link href={sheetsIndex.url()} className="flex h-9 items-center rounded-md bg-primary px-4 text-[14px] leading-[18px] font-medium text-white hover:bg-primary-hover">
                        Enter marks
                    </Link>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 rounded-lg bg-primary-tint p-6">
                {next ? (
                    <>
                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                            <p className={`${monoCaps} text-primary`}>
                                {next.state === 'now' ? 'Now' : wait(next.in_minutes ?? 0)} · {next.starts_at} – {next.ends_at}
                            </p>
                            <p className="font-display text-[20px] leading-[26px] font-semibold text-text">
                                {next.class} · {next.subject}
                            </p>
                            <p className="text-[13px] leading-[18px] text-text-muted">
                                {next.room ? `Room ${next.room}` : 'No room set'} · {plural(next.students, 'student')}
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <Link href={`/attendance?lesson=${next.id}`} className="flex h-9 items-center rounded-md bg-primary px-4 text-[14px] leading-[18px] font-medium text-white hover:bg-primary-hover">
                                Take attendance
                            </Link>
                            <Link href="/teaching-log" className="flex h-9 items-center rounded-md border border-solid border-[#C9DED4] bg-white px-4 text-[14px] leading-[18px] font-medium text-text hover:bg-surface">
                                Start lesson
                            </Link>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col gap-2">
                        <p className={`${monoCaps} text-primary`}>Next lesson</p>
                        <p className="font-display text-[20px] leading-[26px] font-semibold text-text">
                            {!hasTimetable
                                ? 'No timetable is published yet'
                                : lessons.length > 0
                                  ? 'Your lessons are done for today'
                                  : isSchoolDay
                                    ? 'You have no lessons today'
                                    : 'No school today'}
                        </p>
                        <p className="text-[13px] leading-[18px] text-text-muted">
                            {hasTimetable
                                ? 'Your next lesson shows here on your next teaching day.'
                                : 'Your lessons appear here once the school publishes the term’s timetable.'}
                        </p>
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-6 xl:flex-row">
                <Card
                    title="Marks to enter"
                    note={openSheets > 0 ? `${openSheets} open${closesOn ? ` · ${openSheets === 1 ? 'closes' : 'all close'} ${day(closesOn)}` : ''}` : undefined}
                    className="xl:flex-[1.75]"
                >
                    {sheets.length === 0 ? (
                        <Pending>Nothing to enter. A sheet appears here when an assessment is scheduled for a class you teach.</Pending>
                    ) : (
                        sheets.map((sheet, position) => {
                            const share = sheet.students > 0 ? Math.round((sheet.entered / sheet.students) * 100) : 0;
                            const resume = sheet.open && sheet.entered > 0 && !sheet.submitted;

                            return (
                                <div
                                    key={sheet.id}
                                    className={`flex flex-wrap items-center gap-4 px-4 py-3 ${position > 0 ? 'border-t border-solid border-border' : ''} ${resume ? 'bg-[#EDF4F0]' : ''}`}
                                >
                                    <div className="flex w-[240px] shrink-0 flex-col gap-[2px]">
                                        <p className="font-display text-[14px] leading-[18px] font-semibold text-text">
                                            {sheet.plan} · {sheet.class}
                                        </p>
                                        <p className="text-[12px] leading-4 text-text-muted">
                                            {sheet.subject} · {plural(sheet.students, 'student')}
                                        </p>
                                    </div>
                                    {sheet.open ? (
                                        <>
                                            <div className="flex w-[180px] shrink-0 flex-col gap-[6px]">
                                                <p className="font-mono text-[18px] leading-[22px] text-text">
                                                    {sheet.entered} / {sheet.students}
                                                </p>
                                                <span className={`flex h-[6px] rounded-full ${resume ? 'bg-white' : 'bg-surface'}`}>
                                                    <span
                                                        className={`h-[6px] rounded-full ${sheet.entered > 0 ? 'bg-primary' : 'bg-[#C3CCC8]'}`}
                                                        style={{ width: `${Math.max(2, share)}%` }}
                                                    />
                                                </span>
                                            </div>
                                            <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
                                                {sheet.submitted && <span className="text-[12px] leading-4 text-success">Submitted</span>}
                                                <Link
                                                    href={sheetPage.url(sheet.id)}
                                                    className={
                                                        resume
                                                            ? 'flex h-[34px] shrink-0 items-center rounded-md bg-primary px-[14px] text-[13px] leading-4 font-medium text-white hover:bg-primary-hover'
                                                            : outlineButton
                                                    }
                                                >
                                                    {sheet.submitted ? 'Review' : resume ? 'Resume' : 'Start'}
                                                </Link>
                                            </div>
                                        </>
                                    ) : (
                                        <p className="min-w-0 flex-1 text-right text-[13px] leading-4 font-medium text-text-muted opacity-70">
                                            Opens {day(sheet.opens_on)}
                                        </p>
                                    )}
                                </div>
                            );
                        })
                    )}
                    {sheets.length > 0 && (
                        <p className="border-t border-solid border-border bg-row-alt px-4 py-3 text-[12px] leading-4 text-text-muted">
                            {openSheets === 0
                                ? 'Nothing is owed right now.'
                                : upcoming.length === 0
                                  ? 'Nothing else is coming up.'
                                  : `${plural(upcoming.length, 'more sheet')} ${upcoming.length === 1 ? 'opens' : 'open'} later.`}
                        </p>
                    )}
                </Card>

                <Card title="Today’s lessons" note={hasTimetable ? String(lessons.length) : undefined} className="xl:flex-1">
                    {lessons.length === 0 ? (
                        <Pending>
                            {!hasTimetable
                                ? 'The term’s timetable is not published yet.'
                                : isSchoolDay
                                  ? 'No lessons on your timetable today.'
                                  : 'Not a school day.'}
                        </Pending>
                    ) : (
                        lessons.map((lesson, position) => {
                            const focus = lesson.id === next?.id;
                            const pill = lesson.marked
                                ? { label: 'Marked', pill: 'bg-success-tint text-success' }
                                : lesson.state === 'done'
                                  ? { label: 'Not marked', pill: 'bg-warning-tint text-[#8A5A12]' }
                                  : LESSON_PILLS[lesson.state];

                            return (
                                <Link
                                    key={lesson.id}
                                    href={`/attendance?lesson=${lesson.id}`}
                                    className={`flex items-center gap-3 px-4 py-[11px] hover:bg-surface ${focus ? 'bg-[#EDF4F0]' : position > 0 ? 'border-t border-solid border-border' : ''}`}
                                >
                                    <span className={`w-11 shrink-0 font-mono text-[13px] leading-4 ${focus ? 'text-primary' : 'text-text-muted'}`}>{lesson.starts_at}</span>
                                    <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
                                        <span className={`truncate text-[13px] leading-[18px] text-text ${focus ? 'font-semibold' : 'font-medium'}`}>
                                            {lesson.class} · {lesson.subject}
                                        </span>
                                        <span className="text-[12px] leading-4 text-text-muted">
                                            {lesson.room ? `Room ${lesson.room}` : 'No room'} · {plural(lesson.students, 'student')}
                                        </span>
                                    </span>
                                    <span className={`shrink-0 rounded-full px-2 py-[3px] text-[12px] leading-4 font-medium ${pill.pill}`}>{pill.label}</span>
                                </Link>
                            );
                        })
                    )}
                </Card>
            </div>

            <div className="flex flex-col gap-6 xl:flex-row">
                <Card title="Teaching log" className="xl:flex-[1.75]">
                    <Pending>
                        Lessons you have taught but not logged will be listed
                        here, with the topic and homework to fill in. The
                        teaching log is not built yet.
                    </Pending>
                </Card>
                <Card title="Lesson notes" className="xl:flex-1">
                    <Pending>Notes that are due will be listed here. Lesson notes are not built yet.</Pending>
                </Card>
            </div>

            <p className="flex items-start gap-2 pt-1 text-[13px] leading-[18px] text-text-muted">
                <svg width="14" height="14" viewBox="0 0 14 14" className="mt-[2px] shrink-0">
                    <circle cx="7" cy="7" r="5.5" fill="none" stroke="#56625C" strokeWidth="1.5" />
                    <path d="M7 4.5V7.5" fill="none" stroke="#56625C" strokeWidth="1.5" strokeLinecap="round" />
                    <circle cx="7" cy="9.6" r="0.8" fill="#56625C" />
                </svg>
                A sheet you save is a draft until you submit it. After the
                marks window closes, nobody can change a mark without the
                school reopening it.
            </p>
        </div>
    );
}

export default withAppShell(Today);
