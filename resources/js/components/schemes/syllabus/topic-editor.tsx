import { router } from '@inertiajs/react';
import { destroy } from '@/actions/App/Http/Controllers/SyllabusController';
import { outlineButtonClass, solidButtonClass } from '../../structure/ui';
import { t } from '../../../lib/i18n';
import { smallInput, type TopicEditorProps, useTopicEditor } from './model';
import { TopicSubtopics } from './topic-subtopics';

/**
 * The form for one topic and its sub-topics, for a new topic or one
 * being edited.
 */
export function TopicEditor(props: TopicEditorProps) {
    const editor = useTopicEditor(props);
    const { topic, setTopic, busy, subtotal, save, firstError, onDone } =
        editor;

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
            <TopicSubtopics editor={editor} />
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
