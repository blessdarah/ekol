import { router } from '@inertiajs/react';
import { useState } from 'react';
import {
    store,
    update,
} from '@/actions/App/Http/Controllers/SyllabusController';
import { type Steps } from '../ui';

export interface Subtopic {
    id?: string;
    name: string;
    periods: number;
}

export interface Topic {
    id?: string;
    name: string;
    term_sequence: number;
    week_from: number | null;
    week_to: number | null;
    periods: number;
    subtopics: Subtopic[];
}

export interface SyllabusProps {
    steps: Steps;
    levels: { id: string; name: string }[];
    level: { id: string; name: string } | null;
    subjects: { id: string; name: string; topics: number }[];
    subject: { id: string; name: string } | null;
    topics: Topic[];
}

export interface TopicEditorProps {
    initial: Topic;
    levelId: string;
    subjectId: string;
    onDone: () => void;
}

export const smallInput =
    'h-8 rounded-md border border-solid border-border bg-white px-2 text-[13px] text-text outline-none focus:border-primary';

export function weeksLabel(topic: Topic): string {
    if (topic.week_from === null) {
        return '—';
    }

    return topic.week_to !== null && topic.week_to !== topic.week_from
        ? `${topic.week_from} – ${topic.week_to}`
        : String(topic.week_from);
}

/** The level and subject picked, and which topic is open for editing. */
export function useSyllabus({
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

    return {
        steps,
        levels,
        level,
        subjects,
        subject,
        topics,
        editing,
        setEditing,
        ready,
        blank,
    };
}

export type SyllabusModel = ReturnType<typeof useSyllabus>;

/** One topic and its sub-topics as edited so far, and saving it. */
export function useTopicEditor({
    initial,
    levelId,
    subjectId,
    onDone,
}: TopicEditorProps) {
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

    return {
        topic,
        setTopic,
        busy,
        subtotal,
        setSub,
        save,
        firstError,
        onDone,
    };
}

export type TopicEditorModel = ReturnType<typeof useTopicEditor>;
