import { router } from '@inertiajs/react';
import { move } from '@/actions/App/Http/Controllers/SyllabusController';
import { t } from '../../../lib/i18n';
import { type SyllabusModel, type Topic, weeksLabel } from './model';

/** One topic in the list, with buttons to move it earlier or later. */
export function TopicRow({
    syllabus,
    topic,
    index,
}: {
    syllabus: SyllabusModel;
    topic: Topic;
    index: number;
}) {
    const { topics, setEditing } = syllabus;

    return (
        <div className="group flex min-h-[44px] items-center gap-4 border-b border-solid border-border px-4 py-2 last:border-b-0">
            <span className="w-6 shrink-0 font-mono text-[12px] text-text-muted">
                {index + 1}
            </span>
            <button
                type="button"
                onClick={() => setEditing(topic.id ?? null)}
                className="flex min-w-0 flex-1 flex-col text-left hover:underline"
            >
                <span className="text-[14px] leading-5 text-text">
                    {topic.name}
                </span>
                {topic.subtopics.length > 0 && (
                    <span className="truncate text-[12px] leading-4 text-text-muted">
                        {topic.subtopics.map((row) => row.name).join(' · ')}
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
                    aria-label={t('Move :label earlier', {
                        label: topic.name,
                    })}
                    disabled={index === 0}
                    onClick={() =>
                        topic.id &&
                        router.patch(
                            move.url(topic.id),
                            {
                                direction: 'up',
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
                    aria-label={t('Move :label later', {
                        label: topic.name,
                    })}
                    disabled={index === topics.length - 1}
                    onClick={() =>
                        topic.id &&
                        router.patch(
                            move.url(topic.id),
                            {
                                direction: 'down',
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
    );
}
