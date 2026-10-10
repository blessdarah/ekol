import { Head, router } from '@inertiajs/react';
import {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import {
    activateTerm,
    show,
    storeYear,
    updateInstallments,
    updateProfile,
    updateSchoolday,
    updateTerms,
    updateWindows,
} from '@/actions/App/Http/Controllers/SetupController';
import { withAppShell } from '../layouts/app-layout';

interface SchoolProp {
    id: string;
    name: string;
    code: string;
    slug: string;
    logo_url: string | null;
    school_days: number;
}

interface YearProp {
    id: string;
    label: string;
    status: string;
    starts_on: string;
    ends_on: string;
}

interface TermProp {
    id?: string;
    label: string;
    sequence: number;
    starts_on: string;
    ends_on: string;
    week_count: number;
    is_current?: boolean;
    has_marks?: boolean;
}

interface TemplateProp {
    seq: number;
    percent: number | string;
    due_on: string | null;
}

interface PeriodProp {
    id?: string;
    label: string;
    starts_at: string;
    ends_at: string;
    is_break?: boolean;
    _delete?: boolean;
}

interface AssessmentProp {
    ids: string[];
    name: string;
    kind: string;
    window_starts_on: string | null;
    window_ends_on: string | null;
    window_status: 'unscheduled' | 'scheduled' | 'open' | 'closed';
}

interface SetupProps {
    school: SchoolProp;
    years: YearProp[];
    year: YearProp | null;
    terms: TermProp[];
    templates: TemplateProp[];
    periods: PeriodProp[];
    assessments: AssessmentProp[];
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const SaveContext = createContext<(state: SaveState) => void>(() => {});

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const DAY_MS = 86_400_000;

const dateInputClass =
    'h-7 rounded-sm border border-solid border-border bg-white px-1 font-mono text-[12px] text-text outline-none focus:border-primary';

const linkClass = 'text-[13px] leading-4 font-medium text-primary hover:underline';

function shortDate(iso: string | null, padded = true): string {
    if (!iso) {
        return '—';
    }

    const [, month, day] = iso.split('-');

    return `${padded ? day : Number(day)} ${MONTHS[Number(month) - 1]}`;
}

function longDate(iso: string): string {
    return `${shortDate(iso, false)} ${iso.slice(0, 4)}`;
}

function addDays(iso: string, days: number): string {
    return new Date(Date.parse(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

function weeksBetween(startsOn: string, endsOn: string): number {
    const days = (Date.parse(endsOn) - Date.parse(startsOn)) / DAY_MS + 1;

    return Math.max(1, Math.ceil(days / 7));
}

function toMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);

    return hours * 60 + minutes;
}

function addMinutes(time: string, minutes: number): string {
    const total = Math.min(toMinutes(time) + minutes, 23 * 60 + 59);

    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function ordinal(n: number): string {
    const suffix =
        n % 100 >= 11 && n % 100 <= 13
            ? 'th'
            : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');

    return `${n}${suffix}`;
}

/**
 * Debounced per-zone autosave. After each successful save the zone's
 * local state is re-read from the server props, so rows created by
 * that save carry their ids into the next one.
 */
function useAutosave<T>(
    url: string,
    initial: T,
    fromProps: (props: SetupProps) => T,
    serialize: (data: T) => unknown = (data) => data,
) {
    const report = useContext(SaveContext);
    const [data, setData] = useState<T>(initial);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    function send(next: T) {
        timer.current = null;
        router.patch(url, serialize(next) as never, {
            async: true,
            preserveState: true,
            preserveScroll: true,
            onSuccess: (page) => {
                setErrors({});
                report('saved');
                if (!timer.current) {
                    setData(fromProps(page.props as unknown as SetupProps));
                }
            },
            onError: (failed) => {
                setErrors(failed);
                report('error');
            },
        });
    }

    function hold(next: T) {
        setData(next);
        if (timer.current) {
            clearTimeout(timer.current);
            timer.current = null;
        }
    }

    function save(next: T) {
        hold(next);
        report('saving');
        timer.current = setTimeout(() => send(next), 800);
    }

    useEffect(
        () => () => {
            if (timer.current) {
                clearTimeout(timer.current);
            }
        },
        [],
    );

    return { data, save, hold, error: Object.values(errors)[0] };
}

function Zone({
    title,
    desc,
    children,
}: {
    title: string;
    desc: string;
    children: ReactNode;
}) {
    return (
        <section className="flex flex-col gap-4 border-b border-solid border-border pb-6 last:border-b-0 lg:flex-row lg:gap-10">
            <div className="flex shrink-0 flex-col gap-1 lg:w-[220px]">
                <h2 className="text-[14px] leading-[18px] font-semibold text-text">
                    {title}
                </h2>
                <p className="text-[13px] leading-[19px] text-text-muted">
                    {desc}
                </p>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-[14px]">
                {children}
            </div>
        </section>
    );
}

function ZoneError({ message }: { message?: string | null }) {
    if (!message) {
        return null;
    }

    return (
        <p role="alert" className="text-[13px] leading-4 text-danger">
            {message}
        </p>
    );
}

function ProfileZone({ school }: { school: SchoolProp }) {
    const report = useContext(SaveContext);
    const { data, save, error } = useAutosave(
        updateProfile.url(),
        { name: school.name },
        (props) => ({ name: props.school.name }),
    );
    const [preview, setPreview] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const logo = preview ?? school.logo_url;

    function uploadLogo(file: File) {
        if (file.size > 2 * 1024 * 1024) {
            setUploadError('Logo must be smaller than 2 MB.');

            return;
        }

        setPreview(URL.createObjectURL(file));
        setUploadError(null);
        setUploading(true);
        report('saving');

        // Multipart bodies only parse on POST, so the PATCH is spoofed.
        router.post(
            updateProfile.url(),
            { _method: 'patch', logo: file },
            {
                async: true,
                preserveState: true,
                preserveScroll: true,
                onSuccess: () => report('saved'),
                onError: (failed) => {
                    setUploadError(
                        failed.logo ?? 'Upload failed. Use a square PNG or SVG.',
                    );
                    setPreview(null);
                    report('error');
                },
                onFinish: () => setUploading(false),
            },
        );
    }

    return (
        <Zone
            title="School profile"
            desc="Shown on report cards, receipts and the login page."
        >
            <div className="flex items-center gap-5">
                <span className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary font-display text-[24px] leading-[30px] font-extrabold tracking-[-0.02em] text-white">
                    {logo ? (
                        <img
                            src={logo}
                            alt=""
                            className="h-full w-full bg-white object-cover"
                        />
                    ) : (
                        school.code.slice(0, 2).toUpperCase()
                    )}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <input
                        type="text"
                        aria-label="School name"
                        value={data.name}
                        onChange={(e) => save({ name: e.target.value })}
                        className="w-full border-b border-solid border-transparent bg-transparent text-[16px] leading-5 font-semibold text-text outline-none hover:border-border focus:border-primary"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                        <label
                            className={`inline-flex h-8 items-center rounded-md border border-solid border-border px-3 text-[13px] leading-4 font-medium text-text hover:bg-surface ${uploading ? 'cursor-wait opacity-50' : 'cursor-pointer'}`}
                        >
                            {uploading ? 'Uploading…' : 'Upload logo'}
                            <input
                                type="file"
                                accept=".png,.svg"
                                className="hidden"
                                disabled={uploading}
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        uploadLogo(file);
                                    }
                                    e.target.value = '';
                                }}
                            />
                        </label>
                        <span className="text-[12px] leading-4 text-text-muted">
                            PNG or SVG, square, at least 256px
                        </span>
                    </div>
                    <ZoneError message={uploadError ?? error} />
                </div>
            </div>
        </Zone>
    );
}

function TermCard({
    term,
    year,
    active,
    onChange,
    onActivate,
}: {
    term: TermProp;
    year: YearProp;
    active: boolean;
    onChange: (patch: Partial<TermProp>) => void;
    onActivate: () => void;
}) {
    const [editing, setEditing] = useState(false);
    const locked = !!term.has_marks;

    function setDates(patch: { starts_on?: string; ends_on?: string }) {
        const next = { ...term, ...patch };

        if (!next.starts_on || !next.ends_on) {
            return;
        }

        onChange({
            ...patch,
            week_count: weeksBetween(next.starts_on, next.ends_on),
        });
    }

    return (
        <div
            className={`flex flex-col gap-[6px] rounded-md border border-solid p-[14px] ${
                active ? 'border-primary bg-primary' : 'border-border'
            }`}
        >
            <div className="flex items-center justify-between">
                <span
                    className={`text-[14px] leading-[18px] font-semibold ${active ? 'text-white' : 'text-text'}`}
                >
                    {term.label}
                </span>
                {active ? (
                    <span className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-[#8FE3B5] uppercase">
                        Active
                    </span>
                ) : (
                    term.id &&
                    year.status === 'current' && (
                        <button
                            type="button"
                            onClick={onActivate}
                            className="text-[12px] leading-4 font-medium text-primary hover:underline"
                        >
                            Set active
                        </button>
                    )
                )}
            </div>
            {editing ? (
                <div className="flex flex-wrap items-center gap-1">
                    <input
                        type="date"
                        aria-label={`${term.label} starts`}
                        value={term.starts_on}
                        min={year.starts_on}
                        max={year.ends_on}
                        onChange={(e) => setDates({ starts_on: e.target.value })}
                        className={dateInputClass}
                    />
                    <input
                        type="date"
                        aria-label={`${term.label} ends`}
                        value={term.ends_on}
                        min={term.starts_on}
                        max={year.ends_on}
                        onChange={(e) => setDates({ ends_on: e.target.value })}
                        className={dateInputClass}
                    />
                    <button
                        type="button"
                        onClick={() => setEditing(false)}
                        className={`text-[12px] leading-4 font-medium hover:underline ${active ? 'text-white' : 'text-primary'}`}
                    >
                        Done
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    disabled={locked}
                    title={
                        locked
                            ? 'This term already has marks, so its dates are locked.'
                            : 'Change dates'
                    }
                    onClick={() => setEditing(true)}
                    className={`self-start font-mono text-[12px] leading-4 enabled:hover:underline disabled:cursor-not-allowed ${active ? 'text-[#CFE3D8]' : 'text-text-muted'}`}
                >
                    {shortDate(term.starts_on)} – {shortDate(term.ends_on)}
                    {locked && ' · locked'}
                </button>
            )}
        </div>
    );
}

function YearZone({
    years,
    year,
    terms,
}: {
    years: YearProp[];
    year: YearProp | null;
    terms: TermProp[];
}) {
    const yearQuery = year ? { query: { year: year.id } } : undefined;
    const { data, save, error } = useAutosave(
        updateTerms.url(yearQuery),
        { terms },
        (props) => ({ terms: props.terms }),
    );
    const [creating, setCreating] = useState(false);
    const [draft, setDraft] = useState({ label: '', starts_on: '', ends_on: '' });
    const [actionError, setActionError] = useState<string | null>(null);

    function setTerm(index: number, patch: Partial<TermProp>) {
        save({
            terms: data.terms.map((term, i) =>
                i === index ? { ...term, ...patch } : term,
            ),
        });
    }

    function addTerm() {
        if (!year) {
            return;
        }

        const last = data.terms[data.terms.length - 1];
        const startsOn =
            last && last.ends_on < year.ends_on
                ? addDays(last.ends_on, 1)
                : year.starts_on;
        const sequence =
            Math.max(0, ...data.terms.map((term) => term.sequence)) + 1;

        save({
            terms: [
                ...data.terms,
                {
                    label: `Term ${sequence}`,
                    sequence,
                    starts_on: startsOn,
                    ends_on: year.ends_on,
                    week_count: weeksBetween(startsOn, year.ends_on),
                },
            ],
        });
    }

    function activate(term: TermProp) {
        if (!term.id) {
            return;
        }

        router.patch(
            activateTerm.url(term.id),
            {},
            {
                preserveState: true,
                preserveScroll: true,
                onSuccess: () => setActionError(null),
                onError: (failed) =>
                    setActionError(Object.values(failed)[0] ?? null),
            },
        );
    }

    function createYear() {
        router.post(storeYear.url(), draft, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                setDraft({ label: '', starts_on: '', ends_on: '' });
                setCreating(false);
                setActionError(null);
            },
            onError: (failed) =>
                setActionError(Object.values(failed)[0] ?? null),
        });
    }

    return (
        <Zone
            title="Academic year & terms"
            desc="The active term decides where marks, attendance and fees are recorded."
        >
            <div className="flex flex-wrap items-center gap-[10px]">
                {year && (
                    <span className="relative flex">
                        <select
                            aria-label="Academic year"
                            value={year.id}
                            onChange={(e) =>
                                router.get(
                                    show.url({ query: { year: e.target.value } }),
                                )
                            }
                            className="h-[34px] appearance-none rounded-md border border-solid border-border bg-white pr-8 pl-3 font-mono text-[14px] leading-[18px] text-text outline-none focus:border-primary"
                        >
                            {years.map((option) => (
                                <option key={option.id} value={option.id}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
                        >
                            <path
                                d="M6 9l6 6 6-6"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                className="text-text-muted"
                            />
                        </svg>
                    </span>
                )}
                <span className="text-[13px] leading-4 text-text-muted">
                    {year
                        ? `${longDate(year.starts_on)} – ${longDate(year.ends_on)}`
                        : 'No academic year yet.'}
                </span>
                <span className="flex-1" />
                {!creating && (
                    <button
                        type="button"
                        onClick={() => setCreating(true)}
                        className={linkClass}
                    >
                        + New academic year
                    </button>
                )}
            </div>
            {creating && (
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        type="text"
                        aria-label="Year label"
                        placeholder="2026/27"
                        value={draft.label}
                        onChange={(e) =>
                            setDraft({ ...draft, label: e.target.value })
                        }
                        className="h-[34px] w-24 rounded-md border border-solid border-border px-3 font-mono text-[14px] text-text outline-none focus:border-primary"
                    />
                    <input
                        type="date"
                        aria-label="Year starts"
                        value={draft.starts_on}
                        onChange={(e) =>
                            setDraft({ ...draft, starts_on: e.target.value })
                        }
                        className={`${dateInputClass} h-[34px] rounded-md px-2`}
                    />
                    <input
                        type="date"
                        aria-label="Year ends"
                        value={draft.ends_on}
                        min={draft.starts_on}
                        onChange={(e) =>
                            setDraft({ ...draft, ends_on: e.target.value })
                        }
                        className={`${dateInputClass} h-[34px] rounded-md px-2`}
                    />
                    <button
                        type="button"
                        onClick={createYear}
                        disabled={
                            !draft.label || !draft.starts_on || !draft.ends_on
                        }
                        className="h-[34px] rounded-md bg-primary px-3 text-[13px] font-medium text-white hover:bg-primary-hover disabled:opacity-40"
                    >
                        Create year
                    </button>
                    <button
                        type="button"
                        onClick={() => setCreating(false)}
                        className="px-1 text-[13px] font-medium text-text-muted hover:underline"
                    >
                        Cancel
                    </button>
                </div>
            )}
            {year && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {data.terms.map((term, index) => (
                        <TermCard
                            key={term.id ?? `new-${index}`}
                            term={term}
                            year={year}
                            active={
                                !!terms.find((saved) => saved.id === term.id)
                                    ?.is_current
                            }
                            onChange={(patch) => setTerm(index, patch)}
                            onActivate={() => activate(term)}
                        />
                    ))}
                    {data.terms.length < 3 && (
                        <button
                            type="button"
                            onClick={addTerm}
                            className="flex min-h-[70px] items-center justify-center rounded-md border border-dashed border-border text-[13px] font-medium text-primary hover:bg-surface"
                        >
                            + Add term
                        </button>
                    )}
                </div>
            )}
            <ZoneError message={actionError ?? error} />
        </Zone>
    );
}

function InstallmentsZone({
    year,
    templates,
}: {
    year: YearProp | null;
    templates: TemplateProp[];
}) {
    const { data, save, hold, error } = useAutosave(
        updateInstallments.url(year ? { query: { year: year.id } } : undefined),
        { templates },
        (props) => ({ templates: props.templates }),
    );
    const [editingDue, setEditingDue] = useState<number | null>(null);
    const rows = data.templates;
    const total = rows.reduce((sum, row) => sum + Number(row.percent || 0), 0);
    const balanced = Math.abs(total - 100) < 0.01;

    // An unbalanced split is kept locally until it adds up again.
    function commit(next: TemplateProp[]) {
        const sum = next.reduce((acc, row) => acc + Number(row.percent || 0), 0);

        if (next.length > 0 && Math.abs(sum - 100) < 0.01) {
            save({ templates: next });
        } else {
            hold({ templates: next });
        }
    }

    function setRow(index: number, patch: Partial<TemplateProp>) {
        commit(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    }

    function addRow() {
        commit([
            ...rows,
            {
                seq: rows.length + 1,
                percent: rows.length === 0 ? 100 : 0,
                due_on: null,
            },
        ]);
    }

    function removeRow() {
        const removed = rows[rows.length - 1];
        const kept = rows.slice(0, -1);
        const last = kept[kept.length - 1];

        commit([
            ...kept.slice(0, -1),
            {
                ...last,
                percent: Number(last.percent || 0) + Number(removed.percent || 0),
            },
        ]);
    }

    return (
        <Zone
            title="Fee installments"
            desc="Applies to every student. Partial payments fill the oldest installment first."
        >
            <div className="flex items-center gap-3">
                <span className="text-[13px] leading-4 font-medium text-text">
                    Number of installments
                </span>
                <div className="flex h-[34px] items-center rounded-md border border-solid border-border">
                    <button
                        type="button"
                        aria-label="Fewer installments"
                        disabled={!year || rows.length <= 1}
                        onClick={removeRow}
                        className="flex h-8 w-[34px] items-center justify-center border-r border-solid border-border text-[16px] leading-5 text-text enabled:hover:bg-surface disabled:text-text-muted disabled:opacity-60"
                    >
                        −
                    </button>
                    <span className="w-[44px] text-center font-mono text-[14px] leading-[18px] text-text">
                        {rows.length}
                    </span>
                    <button
                        type="button"
                        aria-label="More installments"
                        disabled={!year || rows.length >= 12}
                        onClick={addRow}
                        className="flex h-8 w-[34px] items-center justify-center border-l border-solid border-border text-[16px] leading-5 text-text enabled:hover:bg-surface disabled:opacity-40"
                    >
                        +
                    </button>
                </div>
                {rows.length > 0 && !balanced && (
                    <span className="text-[13px] leading-4 text-danger">
                        Splits add up to {total}%. They must total 100% to save.
                    </span>
                )}
            </div>
            {rows.length > 0 && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {rows.map((row, index) => (
                        <div
                            key={row.seq}
                            className="flex items-center justify-between rounded-md border border-solid border-border px-[14px] py-3"
                        >
                            <div className="flex flex-col gap-[2px]">
                                <span className="text-[13px] leading-4 font-medium text-text">
                                    {ordinal(row.seq)}
                                </span>
                                {editingDue === index ? (
                                    <input
                                        type="date"
                                        autoFocus
                                        aria-label={`${ordinal(row.seq)} installment due date`}
                                        value={row.due_on ?? ''}
                                        min={year?.starts_on}
                                        max={year?.ends_on}
                                        onChange={(e) =>
                                            setRow(index, {
                                                due_on: e.target.value || null,
                                            })
                                        }
                                        onBlur={() => setEditingDue(null)}
                                        className={dateInputClass}
                                    />
                                ) : (
                                    <button
                                        type="button"
                                        title="Change due date"
                                        onClick={() => setEditingDue(index)}
                                        className="self-start text-[12px] leading-4 text-text-muted hover:underline"
                                    >
                                        {row.due_on
                                            ? `Due ${shortDate(row.due_on, false)}`
                                            : 'Set due date'}
                                    </button>
                                )}
                            </div>
                            <label className="flex items-center font-mono text-[14px] leading-[18px] text-text">
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    aria-label={`${ordinal(row.seq)} installment percent`}
                                    value={row.percent}
                                    onChange={(e) =>
                                        setRow(index, {
                                            percent: e.target.value.replace(
                                                /[^\d.]/g,
                                                '',
                                            ),
                                        })
                                    }
                                    className="w-[5ch] rounded-sm bg-transparent text-right outline-none hover:bg-surface focus:bg-surface"
                                />
                                %
                            </label>
                        </div>
                    ))}
                </div>
            )}
            <ZoneError
                message={
                    !year ? 'Create an academic year to set installments.' : error
                }
            />
        </Zone>
    );
}

function WindowStatus({ status }: { status: AssessmentProp['window_status'] }) {
    if (status === 'open') {
        return (
            <span className="flex h-6 items-center gap-[6px] rounded-full bg-primary-tint px-[10px] text-[12px] leading-4 font-medium text-primary">
                <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-primary" />
                Open
            </span>
        );
    }

    if (status === 'closed') {
        return (
            <span className="flex h-6 items-center rounded-full border border-solid border-border bg-surface px-[10px] text-[12px] leading-4 font-medium text-text-muted">
                Closed
            </span>
        );
    }

    return (
        <span className="text-[12px] leading-4 text-text-muted">
            {status === 'scheduled' ? 'Scheduled' : 'Not scheduled'}
        </span>
    );
}

interface WindowRow {
    ids: string[];
    name: string;
    window_starts_on: string;
    window_ends_on: string;
}

function windowRows(assessments: AssessmentProp[]): WindowRow[] {
    return assessments.map((row) => ({
        ids: row.ids,
        name: row.name,
        window_starts_on: row.window_starts_on ?? '',
        window_ends_on: row.window_ends_on ?? '',
    }));
}

function WindowsZone({ assessments }: { assessments: AssessmentProp[] }) {
    const { data, save, error } = useAutosave(
        updateWindows.url(),
        { rows: windowRows(assessments) },
        (props) => ({ rows: windowRows(props.assessments) }),
        ({ rows }) => ({
            assessments: rows.flatMap((row) =>
                row.ids.map((id) => ({
                    id,
                    window_starts_on: row.window_starts_on || null,
                    window_ends_on: row.window_ends_on || null,
                })),
            ),
        }),
    );
    const [editing, setEditing] = useState<number | null>(null);

    function setRow(index: number, patch: Partial<WindowRow>) {
        save({
            rows: data.rows.map((row, i) =>
                i === index ? { ...row, ...patch } : row,
            ),
        });
    }

    return (
        <Zone
            title="Sequences & exams"
            desc="Teachers can enter marks only while a window is open. Pass marks are set by each teacher."
        >
            {data.rows.length === 0 ? (
                <p className="text-[13px] leading-[19px] text-text-muted">
                    No sequences or exams yet. Their marks windows appear here
                    once they are created.
                </p>
            ) : (
                <div className="flex flex-col">
                    {data.rows.map((row, index) => {
                        const status =
                            assessments.find(
                                (saved) => saved.ids[0] === row.ids[0],
                            )?.window_status ?? 'unscheduled';

                        return (
                            <div
                                key={row.ids[0]}
                                className="flex min-h-[44px] items-center gap-4 border-b border-solid border-border last:border-b-0"
                            >
                                <span className="flex-1 text-[14px] leading-[18px] font-medium text-text">
                                    {row.name}
                                </span>
                                {editing === index ? (
                                    <span className="flex shrink-0 items-center gap-1">
                                        <input
                                            type="date"
                                            aria-label={`${row.name} window opens`}
                                            value={row.window_starts_on}
                                            onChange={(e) =>
                                                setRow(index, {
                                                    window_starts_on:
                                                        e.target.value,
                                                })
                                            }
                                            className={dateInputClass}
                                        />
                                        <input
                                            type="date"
                                            aria-label={`${row.name} window closes`}
                                            value={row.window_ends_on}
                                            min={row.window_starts_on}
                                            onChange={(e) =>
                                                setRow(index, {
                                                    window_ends_on:
                                                        e.target.value,
                                                })
                                            }
                                            className={dateInputClass}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setEditing(null)}
                                            className="text-[12px] leading-4 font-medium text-primary hover:underline"
                                        >
                                            Done
                                        </button>
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        title="Change marks window"
                                        onClick={() => setEditing(index)}
                                        className={`w-[200px] shrink-0 text-left font-mono text-[13px] leading-4 hover:underline ${
                                            status === 'open'
                                                ? 'text-text'
                                                : 'text-text-muted'
                                        }`}
                                    >
                                        {row.window_starts_on &&
                                        row.window_ends_on
                                            ? `${shortDate(row.window_starts_on)} → ${shortDate(row.window_ends_on)}`
                                            : 'Set window'}
                                    </button>
                                )}
                                <span className="flex w-[130px] shrink-0 justify-end">
                                    <WindowStatus status={status} />
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
            <ZoneError message={error} />
        </Zone>
    );
}

const timeInputClass =
    'w-[90px] shrink-0 rounded-sm bg-transparent font-mono text-[13px] leading-4 outline-none hover:bg-primary-tint focus:bg-primary-tint [&::-webkit-calendar-picker-indicator]:hidden';

function SchooldayZone({
    school,
    periods,
}: {
    school: SchoolProp;
    periods: PeriodProp[];
}) {
    const { data, save, error } = useAutosave(
        updateSchoolday.url(),
        { school_days: school.school_days, periods },
        (props) => ({
            school_days: props.school.school_days,
            periods: props.periods,
        }),
    );
    const visible = data.periods.filter((row) => !row._delete);
    const lessons = visible.filter((row) => !row.is_break).length;
    const days = WEEKDAYS.filter(
        (_, index) => (data.school_days & (1 << index)) !== 0,
    ).length;

    function setPeriod(target: PeriodProp, patch: Partial<PeriodProp>) {
        save({
            ...data,
            periods: data.periods.map((row) =>
                row === target ? { ...row, ...patch } : row,
            ),
        });
    }

    function removePeriod(target: PeriodProp) {
        save({
            ...data,
            periods: target.id
                ? data.periods.map((row) =>
                      row === target ? { ...row, _delete: true } : row,
                  )
                : data.periods.filter((row) => row !== target),
        });
    }

    function addPeriod(isBreak: boolean) {
        const startsAt = visible[visible.length - 1]?.ends_at ?? '07:30';

        save({
            ...data,
            periods: [
                ...data.periods,
                {
                    label: isBreak ? 'BREAK' : `P${lessons + 1}`,
                    starts_at: startsAt,
                    ends_at: addMinutes(startsAt, isBreak ? 20 : 55),
                    is_break: isBreak,
                },
            ],
        });
    }

    return (
        <Zone
            title="School day"
            desc="The days and periods every timetable and exam schedule is built on. A change applies to the next timetable version you generate."
        >
            <div className="flex flex-wrap items-center gap-[14px]">
                <span className="text-[13px] leading-4 font-medium text-text">
                    School days
                </span>
                <div className="flex gap-[6px]">
                    {WEEKDAYS.map((day, index) => {
                        const bit = 1 << index;
                        const on = (data.school_days & bit) !== 0;

                        return (
                            <button
                                key={day}
                                type="button"
                                aria-pressed={on}
                                onClick={() =>
                                    save({
                                        ...data,
                                        school_days: data.school_days ^ bit,
                                    })
                                }
                                className={`flex h-[30px] w-[52px] shrink-0 items-center justify-center rounded-md border border-solid text-[13px] leading-4 ${
                                    on
                                        ? 'border-primary bg-primary-tint font-semibold text-primary'
                                        : 'border-border text-text-muted'
                                }`}
                            >
                                {day}
                            </button>
                        );
                    })}
                </div>
            </div>
            <div className="flex flex-col overflow-clip rounded-lg border border-solid border-border">
                <div className="flex h-8 shrink-0 items-center gap-[14px] border-b border-solid border-border bg-surface px-[14px] text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase">
                    <span className="w-[70px] shrink-0">Period</span>
                    <span className="w-[90px] shrink-0">Starts</span>
                    <span className="w-[90px] shrink-0">Ends</span>
                    <span className="flex-1">Length</span>
                </div>
                {visible.length === 0 && (
                    <p className="px-[14px] py-3 text-[13px] leading-[19px] text-text-muted">
                        No periods yet. Add the first one below.
                    </p>
                )}
                {visible.map((row, index) => {
                    const length =
                        toMinutes(row.ends_at) - toMinutes(row.starts_at);
                    const tone = row.is_break ? 'text-text-muted' : 'text-text';

                    return (
                        <div
                            key={row.id ?? `new-${index}`}
                            className={`group flex shrink-0 items-center gap-[14px] border-b border-solid border-border px-[14px] last:border-b-0 ${
                                row.is_break
                                    ? 'h-8 bg-surface'
                                    : `h-[38px] ${index % 2 === 1 ? 'bg-row-alt' : ''}`
                            }`}
                        >
                            <input
                                type="text"
                                aria-label="Period name"
                                value={row.label}
                                onChange={(e) =>
                                    setPeriod(row, { label: e.target.value })
                                }
                                className={`w-[70px] shrink-0 rounded-sm bg-transparent outline-none hover:bg-primary-tint focus:bg-primary-tint ${
                                    row.is_break
                                        ? 'text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase'
                                        : 'text-[14px] leading-[18px] font-medium text-text'
                                }`}
                            />
                            <input
                                type="time"
                                aria-label={`${row.label} starts`}
                                value={row.starts_at}
                                onChange={(e) =>
                                    setPeriod(row, { starts_at: e.target.value })
                                }
                                className={`${timeInputClass} ${tone}`}
                            />
                            <input
                                type="time"
                                aria-label={`${row.label} ends`}
                                value={row.ends_at}
                                onChange={(e) =>
                                    setPeriod(row, { ends_at: e.target.value })
                                }
                                className={`${timeInputClass} ${tone}`}
                            />
                            <span className="flex-1 font-mono text-[12px] leading-4 text-text-muted">
                                {length > 0 ? `${length} min` : '—'}
                            </span>
                            <button
                                type="button"
                                onClick={() => removePeriod(row)}
                                className="text-[12px] leading-4 font-medium text-danger opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:underline focus:opacity-100"
                            >
                                Remove
                            </button>
                        </div>
                    );
                })}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] leading-[19px] text-text-muted">
                    {lessons * days} lesson slots a week for each class. Used by
                    the Timetable and the Exam schedule.
                </p>
                <div className="flex gap-4">
                    <button
                        type="button"
                        onClick={() => addPeriod(false)}
                        className={linkClass}
                    >
                        Add a period
                    </button>
                    <button
                        type="button"
                        onClick={() => addPeriod(true)}
                        className={linkClass}
                    >
                        Add a break
                    </button>
                </div>
            </div>
            <ZoneError message={error} />
        </Zone>
    );
}

const SAVE_LABELS: Record<SaveState, string> = {
    idle: 'Changes save automatically',
    saving: 'Saving…',
    saved: 'All changes saved',
    error: 'Some changes could not be saved',
};

function SetupPage({
    school,
    years,
    year,
    terms,
    templates,
    periods,
    assessments,
}: SetupProps) {
    const [saveState, setSaveState] = useState<SaveState>('idle');

    return (
        <SaveContext value={setSaveState}>
            <Head title="School Setup" />
            <div className="flex flex-col gap-7">
                <div className="flex flex-wrap items-end justify-between gap-2">
                    <h1 className="font-display text-[40px] leading-[44px] font-extrabold tracking-[-0.02em] text-text">
                        School Setup
                    </h1>
                    <p
                        aria-live="polite"
                        className={`text-[13px] leading-4 ${saveState === 'error' ? 'text-danger' : 'text-text-muted'}`}
                    >
                        {SAVE_LABELS[saveState]}
                    </p>
                </div>
                <ProfileZone school={school} />
                <YearZone years={years} year={year} terms={terms} />
                <InstallmentsZone year={year} templates={templates} />
                <WindowsZone assessments={assessments} />
                <SchooldayZone school={school} periods={periods} />
            </div>
        </SaveContext>
    );
}

export default withAppShell(SetupPage);
