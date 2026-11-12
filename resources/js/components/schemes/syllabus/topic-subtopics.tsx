import { capsLabelClass } from '../../structure/ui';
import { t } from '../../../lib/i18n';
import { smallInput, type TopicEditorModel } from './model';

/** The sub-topics of the topic being edited, in teaching order. */
export function TopicSubtopics({ editor }: { editor: TopicEditorModel }) {
    const { topic, setTopic, setSub } = editor;

    return (
        <div className="flex flex-col gap-2">
            <span className={capsLabelClass}>{t('Sub-topics')}</span>
            {topic.subtopics.length === 0 && (
                <p className="text-[12px] text-text-muted">
                    {t('No sub-topics. Teachers place the topic as one block.')}
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
                                    Number(e.target.value.replace(/\D/g, '')) ||
                                    0,
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
    );
}
