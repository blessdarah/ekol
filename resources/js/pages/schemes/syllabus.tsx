import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { opening } from '@/actions/App/Http/Controllers/SchemeOpeningController';
import {
    destroy,
    move,
    show,
    store,
    update,
} from '@/actions/App/Http/Controllers/SyllabusController';
import {
    SchemesHeader,
    StepBar,
    type Steps,
} from '../../components/schemes/ui';
import {
    capsLabelClass,
    outlineButtonClass,
    solidButtonClass,
} from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface Subtopic {
    id?: string;
    name: string;
    periods: number;
}

interface Topic {
    id?: string;
    name: string;
    term_sequence: number;
    week_from: number | null;
    week_to: number | null;
    periods: number;
    subtopics: Subtopic[];
}

interface SyllabusProps {
    steps: Steps;
    levels: { id: string; name: string }[];
    level: { id: string; name: string } | null;
    subjects: { id: string; name: string; topics: number }[];
    subject: { id: string; name: string } | null;
    topics: Topic[];
}

const smallInput =
    'h-8 rounded-md border border-solid border-border bg-white px-2 text-[13px] text-text outline-none focus:border-primary';

function weeksLabel(topic: Topic): string {
    if (topic.week_from === null) {
        return '—';
    }

    return topic.week_to !== null && topic.week_to !== topic.week_from
        ? `${topic.week_from} – ${topic.week_to}`
        : String(topic.week_from);
}

/**
 * The form for one topic and its sub-topics, for a new topic or one
 * being edited.
 */
function TopicEditor({
    initial,
    levelId,
    subjectId,
    onDone,
}: {
    initial: Topic;
    levelId: string;
    subjectId: string;
    onDone: () => void;
}) {
    const [topic, setTopic] = useState<Topic>(initial);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const subtotal = topic.subtopics.reduce(
        (sum, row) => sum + (Number(row.periods) || 0),
        0,
    );

    function setSub(index: number, patch: Partial<Subtopic>) {
        setTopic({
            ...topic,
            subtopics: topic.subtopics.map((row, position) =>
                position === index ? { ...row, ...patch } : row,
            ),
        });
    }

    function save() {
        const payload = {
            ...topic,
            level_id: levelId,
            subject_id: subjectId,
            periods: topic.subtopics.length > 0 ? subtotal : topic.periods,
        };
        const options = {
            preserveScroll: true,
            onStart: () => setBusy(true),
            onFinish: () => setBusy(false),
            onSuccess: () => onDone(),
            onError: (failed: Record<string, string>) => setErrors(failed),
        };

        if (topic.id) {
            router.patch(update.url(topic.id), payload as never, options);
        } else {
            router.post(store.url(), payload as never, options);
        }
    }

    const firstError = Object.values(errors)[0];

    return (
        <div className="flex flex-col gap-3 border-b border-solid border-border bg-surface px-4 py-4">
            <div className="flex flex-wrap items-end gap-3">
                <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-[12px] font-medium text-text">
                    {t('Topic')}
                    <input
                        value={topic.name}
                        onChange={(e) =>
                            setTopic({ ...topic, name: e.target.value })
                        }
                        className={`${smallInput} w-full`}
                        autoFocus
                    />
                </label>
                <label className="flex flex-col gap-1 text-[12px] font-medium text-text">
                    {t('Term')}
                    <select
                        value={topic.term_sequence}
                        onChange={(e) =>
                            setTopic({
                                ...topic,
                                term_sequence: Number(e.target.value),
                            })
                        }
                        className={smallInput}
                    >
                        {[1, 2, 3].map((term) => (
                            <option key={term} value={term}>
                                {t('Term :number', { number: term })}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="flex flex-col gap-1 text-[12px] font-medium text-text">
                    {t('From week')}
                    <input
                        inputMode="numeric"
                        value={topic.week_from ?? ''}
                        onChange={(e) =>
                            setTopic({
                                ...topic,
                                week_from:
                                    e.target.value === ''
                                        ? null
                                        : Number(
                                              e.target.value.replace(/\D/g, ''),
                                          ),
                            })
                        }
                        className={`${smallInput} w-[64px] font-mono`}
                    />
                </label>
                <label className="flex flex-col gap-1 text-[12px] font-medium text-text">
                    {t('To week')}
                    <input
                        inputMode="numeric"
                        value={topic.week_to ?? ''}
                        onChange={(e) =>
                            setTopic({
                                ...topic,
                                week_to:
                                    e.target.value === ''
                                        ? null
                                        : Number(
                                              e.target.value.replace(/\D/g, ''),
                                          ),
                            })
                        }
                        className={`${smallInput} w-[64px] font-mono`}
                    />
                </label>
                <label className="flex flex-col gap-1 text-[12px] font-medium text-text">
                    {t('Periods')}
                    {topic.subtopics.length > 0 ? (
                        <span className="flex h-8 items-center font-mono text-[13px] text-text-muted">
                            {subtotal}
                        </span>
                    ) : (
                        <input
                            inputMode="numeric"
                            value={topic.periods}
                            onChange={(e) =>
                                setTopic({
                                    ...topic,
                                    periods:
                                        Number(
                                            e.target.value.replace(/\D/g, ''),
                                        ) || 0,
                                })
                            }
                            className={`${smallInput} w-[64px] font-mono`}
                        />
                    )}
                </label>
            </div>
            <div className="flex flex-col gap-2">
                <span className={capsLabelClass}>{t('Sub-topics')}</span>
                {topic.subtopics.length === 0 && (
                    <p className="text-[12px] text-text-muted">
                        {t(
                            'No sub-topics. Teachers place the topic as one block.',
                        )}
                    </p>
                )}
                {topic.subtopics.map((row, index) => (
                    <div
                        key={row.id ?? `new-${index}`}
                        className="flex items-center gap-2"
                    >
                        <span className="w-6 shrink-0 text-right font-mono text-[12px] text-text-muted">
                            {index + 1}
                        </span>
                        <input
                            aria-label={t('Sub-topic name')}
                            value={row.name}
                            onChange={(e) =>
                                setSub(index, { name: e.target.value })
                            }
                            className={`${smallInput} flex-1`}
                        />
                        <input
                            aria-label={t('Periods')}
                            inputMode="numeric"
                            value={row.periods}
                            onChange={(e) =>
                                setSub(index, {
                                    periods:
                                        Number(
                                            e.target.value.replace(/\D/g, ''),
                                        ) || 0,
                                })
                            }
                            className={`${smallInput} w-[56px] font-mono`}
                        />
                        <button
                            type="button"
                            onClick={() =>
                                setTopic({
                                    ...topic,
                                    subtopics: topic.subtopics.filter(
                                        (_, position) => position !== index,
                                    ),
                                })
                            }
                            className="text-[12px] font-medium text-danger hover:underline"
                        >
                            {t('Remove')}
                        </button>
                    </div>
                ))}
                <button
                    type="button"
                    onClick={() =>
                        setTopic({
                            ...topic,
                            subtopics: [
                                ...topic.subtopics,
                                { name: '', periods: 1 },
                            ],
                        })
                    }
                    className="self-start text-[13px] font-medium text-primary hover:underline"
                >
                    {t('+ Add a sub-topic')}
                </button>
            </div>
            {firstError && (
                <p className="text-[13px] text-danger">{firstError}</p>
            )}
            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    disabled={busy}
                    onClick={save}
                    className={solidButtonClass}
                >
                    {t('Save topic')}
                </button>
                <button
                    type="button"
                    onClick={onDone}
                    className={outlineButtonClass}
                >
                    {t('Cancel')}
                </button>
                {topic.id && (
                    <button
                        type="button"
                        onClick={() =>
                            topic.id &&
                            router.delete(destroy.url(topic.id), {
                                preserveScroll: true,
                                onSuccess: onDone,
                            })
                        }
                        className="ml-auto text-[13px] font-medium text-danger hover:underline"
                    >
                        {t('Remove topic')}
                    </button>
                )}
            </div>
        </div>
    );
}

function Syllabus({
    steps,
    levels,
    level,
    subjects,
    subject,
    topics,
}: SyllabusProps) {
    const [editing, setEditing] = useState<string | null>(null);
    const ready = subjects.filter((row) => row.topics > 0).length;
    const blank: Topic = {
        name: '',
        term_sequence: 1,
        week_from: null,
        week_to: null,
        periods: 1,
        subtopics: [],
    };

    return (
        <div className="flex flex-col gap-7">
            <Head title={t('Syllabus')} />
            <SchemesHeader
                trail={[{ label: t('Syllabus') }]}
                tag={t('Schemes:term_label', {
                    term_label: steps.term ? ` · ${t(steps.term.label)}` : '',
                })}
                title={t('Syllabus')}
                sub={t(
                    'The topics each subject must cover at each level. Every teacher’s scheme starts from this list, and it is kept for next year.',
                )}
                action={
                    <Link href={opening.url()} className={solidButtonClass}>
                        {t('Next: open schemes →')}
                    </Link>
                }
            />
            <StepBar steps={steps} active="syllabus" />

            {levels.length === 0 ? (
                <p className="rounded-md bg-surface p-4 text-[13px] text-text">
                    {t(
                        'No level has classes this year yet. Add classes under Levels first.',
                    )}
                </p>
            ) : (
                <>
                    <div className="flex flex-wrap gap-2">
                        {levels.map((option) => (
                            <Link
                                key={option.id}
                                href={show.url({ query: { level: option.id } })}
                                preserveScroll
                                className={`flex h-8 items-center rounded-full border border-solid px-[14px] text-[13px] ${
                                    option.id === level?.id
                                        ? 'border-primary bg-primary-tint font-semibold text-primary'
                                        : 'border-border font-medium text-text hover:bg-surface'
                                }`}
                            >
                                {option.name}
                            </Link>
                        ))}
                    </div>
                    <div className="flex flex-col gap-6 lg:flex-row">
                        <div className="flex shrink-0 flex-col gap-1 lg:w-[250px]">
                            <span className={capsLabelClass}>
                                {t(
                                    ':level · :subjects subjects · :ready ready',
                                    {
                                        level: level?.name ?? '',
                                        subjects: subjects.length,
                                        ready,
                                    },
                                )}
                            </span>
                            {subjects.length === 0 && (
                                <p className="text-[13px] text-text-muted">
                                    {t(
                                        'No subject is taught at this level yet.',
                                    )}
                                </p>
                            )}
                            {subjects.map((option) => (
                                <Link
                                    key={option.id}
                                    href={show.url({
                                        query: {
                                            level: level?.id ?? '',
                                            subject: option.id,
                                        },
                                    })}
                                    preserveScroll
                                    className={`flex items-center justify-between rounded-md border border-solid px-3 py-2 text-[14px] ${
                                        option.id === subject?.id
                                            ? 'border-primary bg-primary-tint font-semibold text-primary'
                                            : 'border-transparent text-text hover:bg-surface'
                                    }`}
                                >
                                    <span className="truncate">
                                        {option.name}
                                    </span>
                                    {option.topics > 0 ? (
                                        <span className="shrink-0 font-mono text-[12px] text-text-muted">
                                            {t(':count topics', {
                                                count: option.topics,
                                            })}
                                        </span>
                                    ) : (
                                        <span className="flex shrink-0 items-center gap-1 text-[12px] text-warning-text">
                                            <span className="h-[6px] w-[6px] rounded-full bg-warning" />
                                            {t('Empty')}
                                        </span>
                                    )}
                                </Link>
                            ))}
                        </div>
                        {subject && level && (
                            <div className="flex min-w-0 flex-1 flex-col gap-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h2 className="font-display text-[22px] leading-7 font-bold text-text">
                                        {subject.name} · {level.name}
                                    </h2>
                                    <button
                                        type="button"
                                        onClick={() => setEditing('new')}
                                        className="text-[13px] font-medium text-primary hover:underline"
                                    >
                                        {t('+ Add a topic')}
                                    </button>
                                </div>
                                <div className="overflow-x-auto rounded-lg border border-solid border-border">
                                    <div className="flex min-w-[620px] flex-col">
                                        <div
                                            className={`flex h-9 items-center gap-4 border-b border-solid border-border bg-surface px-4 ${capsLabelClass}`}
                                        >
                                            <span className="w-6 shrink-0">
                                                #
                                            </span>
                                            <span className="flex-1">
                                                {t('Topic')}
                                            </span>
                                            <span className="w-[70px] shrink-0">
                                                {t('Term')}
                                            </span>
                                            <span className="w-[70px] shrink-0">
                                                {t('Weeks')}
                                            </span>
                                            <span className="w-[60px] shrink-0 text-right">
                                                {t('Periods')}
                                            </span>
                                            <span className="w-[54px] shrink-0" />
                                        </div>
                                        {topics.length === 0 &&
                                            editing !== 'new' && (
                                                <p className="px-4 py-4 text-[13px] text-text-muted">
                                                    {t(
                                                        'No topics yet. Add the first one, in the order they are taught.',
                                                    )}
                                                </p>
                                            )}
                                        {topics.map((topic, index) =>
                                            editing === topic.id ? (
                                                <TopicEditor
                                                    key={topic.id}
                                                    initial={topic}
                                                    levelId={level.id}
                                                    subjectId={subject.id}
                                                    onDone={() =>
                                                        setEditing(null)
                                                    }
                                                />
                                            ) : (
                                                <div
                                                    key={topic.id}
                                                    className="group flex min-h-[44px] items-center gap-4 border-b border-solid border-border px-4 py-2 last:border-b-0"
                                                >
                                                    <span className="w-6 shrink-0 font-mono text-[12px] text-text-muted">
                                                        {index + 1}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setEditing(
                                                                topic.id ??
                                                                    null,
                                                            )
                                                        }
                                                        className="flex min-w-0 flex-1 flex-col text-left hover:underline"
                                                    >
                                                        <span className="text-[14px] leading-5 text-text">
                                                            {topic.name}
                                                        </span>
                                                        {topic.subtopics
                                                            .length > 0 && (
                                                            <span className="truncate text-[12px] leading-4 text-text-muted">
                                                                {topic.subtopics
                                                                    .map(
                                                                        (row) =>
                                                                            row.name,
                                                                    )
                                                                    .join(
                                                                        ' · ',
                                                                    )}
                                                            </span>
                                                        )}
                                                    </button>
                                                    <span className="w-[70px] shrink-0 text-[13px] text-text">
                                                        {t('Term :number', {
                                                            number: topic.term_sequence,
                                                        })}
                                                    </span>
                                                    <span className="w-[70px] shrink-0 font-mono text-[13px] text-text">
                                                        {weeksLabel(topic)}
                                                    </span>
                                                    <span className="w-[60px] shrink-0 text-right font-mono text-[13px] text-text">
                                                        {topic.periods}
                                                    </span>
                                                    <span className="flex w-[54px] shrink-0 justify-end gap-1 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
                                                        <button
                                                            type="button"
                                                            aria-label={t(
                                                                'Move :label earlier',
                                                                {
                                                                    label: topic.name,
                                                                },
                                                            )}
                                                            disabled={
                                                                index === 0
                                                            }
                                                            onClick={() =>
                                                                topic.id &&
                                                                router.patch(
                                                                    move.url(
                                                                        topic.id,
                                                                    ),
                                                                    {
                                                                        direction:
                                                                            'up',
                                                                    },
                                                                    {
                                                                        preserveScroll: true,
                                                                    },
                                                                )
                                                            }
                                                            className="px-1 text-text-muted hover:text-text disabled:opacity-30"
                                                        >
                                                            ↑
                                                        </button>
                                                        <button
                                                            type="button"
                                                            aria-label={t(
                                                                'Move :label later',
                                                                {
                                                                    label: topic.name,
                                                                },
                                                            )}
                                                            disabled={
                                                                index ===
                                                                topics.length -
                                                                    1
                                                            }
                                                            onClick={() =>
                                                                topic.id &&
                                                                router.patch(
                                                                    move.url(
                                                                        topic.id,
                                                                    ),
                                                                    {
                                                                        direction:
                                                                            'down',
                                                                    },
                                                                    {
                                                                        preserveScroll: true,
                                                                    },
                                                                )
                                                            }
                                                            className="px-1 text-text-muted hover:text-text disabled:opacity-30"
                                                        >
                                                            ↓
                                                        </button>
                                                    </span>
                                                </div>
                                            ),
                                        )}
                                        {editing === 'new' && (
                                            <TopicEditor
                                                initial={blank}
                                                levelId={level.id}
                                                subjectId={subject.id}
                                                onDone={() => setEditing(null)}
                                            />
                                        )}
                                    </div>
                                </div>
                                <p className="text-[13px] leading-[19px] text-text-muted">
                                    {t(
                                        'Weeks are a suggestion. Teachers move topics when they write their scheme. Weeks with tests or exams on the Sequences & Exams calendar are kept free of new topics.',
                                    )}
                                </p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export default withAppShell(Syllabus);
