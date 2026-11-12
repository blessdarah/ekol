import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { store, update } from '@/actions/App/Http/Controllers/SeriesController';
import { t } from '../../../lib/i18n';

export interface SubjectProp {
    id: string;
    code: string;
    name: string;
    teachers: number;
    domain: string;
}

export interface SeriesEditProps {
    yearLabel: string | null;
    level: { id: string; name: string };
    levels: { id: string; name: string }[];
    series: {
        id: string;
        code: string;
        name: string;
        stream: string;
        min_subjects: number | null;
        max_subjects: number | null;
        core: string[];
        electives: string[];
        level_ids: string[];
    } | null;
    subjects: SubjectProp[];
    unavailableSubjects: string[];
    others: {
        id: string;
        label: string;
        core: string[];
        electives: string[];
    }[];
}

/**
 * The series as edited so far, the subjects its domain allows, and what
 * students would be offered.
 */
export function useSeriesEdit({
    yearLabel,
    level,
    levels,
    series,
    subjects,
    unavailableSubjects,
    others,
}: SeriesEditProps) {
    const form = useForm({
        level_id: level.id,
        code: series?.code ?? '',
        name: series?.name ?? '',
        stream: series?.stream ?? 'science',
        min_subjects: String(series?.min_subjects ?? 2),
        max_subjects: String(series?.max_subjects ?? 5),
        level_ids: series?.level_ids ?? [level.id],
        core: series?.core ?? [],
        electives: series?.electives ?? [],
    });
    const { data, setData, errors, processing } = form;
    const fieldError = (field: 'core' | 'electives' | 'level_ids') =>
        Object.entries(errors).find(
            ([key]) => key === field || key.startsWith(`${field}.`),
        )?.[1];

    const code = data.code.trim() || 'this series';
    const eligibleSubjects = subjects.filter(
        (subject) =>
            subject.domain === 'general' || subject.domain === data.stream,
    );
    const eligibleIds = new Set(eligibleSubjects.map((subject) => subject.id));
    const copySources = others.filter((other) =>
        [...other.core, ...other.electives].some((id) => eligibleIds.has(id)),
    );
    const byId = new Map(
        eligibleSubjects.map((subject) => [subject.id, subject]),
    );
    const core = data.core.flatMap((id) => byId.get(id) ?? []);
    const pool = eligibleSubjects.filter(
        (subject) => !data.core.includes(subject.id),
    );
    const inPool = pool.filter((subject) =>
        data.electives.includes(subject.id),
    );
    const electivesAllowed = Math.max(
        0,
        (Number(data.max_subjects) || 0) - core.length,
    );
    const unstaffed = [...core, ...inPool].filter(
        (subject) => subject.teachers === 0,
    );

    function toggleElective(id: string) {
        setData(
            'electives',
            data.electives.includes(id)
                ? data.electives.filter((other) => other !== id)
                : [...data.electives, id],
        );
    }

    function copyFrom(id: string) {
        const source = others.find((other) => other.id === id);

        if (source) {
            setData({
                ...data,
                core: source.core.filter((subjectId) =>
                    eligibleIds.has(subjectId),
                ),
                electives: source.electives.filter((subjectId) =>
                    eligibleIds.has(subjectId),
                ),
            });
        }
    }

    function changeDomain(stream: string) {
        const allowedIds = new Set(
            subjects
                .filter(
                    (subject) =>
                        subject.domain === 'general' ||
                        subject.domain === stream,
                )
                .map((subject) => subject.id),
        );
        const removed = [...data.core, ...data.electives]
            .filter((id) => !allowedIds.has(id))
            .flatMap((id) => byId.get(id)?.name ?? []);

        if (
            removed.length > 0 &&
            !window.confirm(
                t(
                    'Changing the domain will remove these selected subjects: :subjects. Continue?',
                    { subjects: removed.join(', ') },
                ),
            )
        ) {
            return;
        }

        setData({
            ...data,
            stream,
            core: data.core.filter((id) => allowedIds.has(id)),
            electives: data.electives.filter((id) => allowedIds.has(id)),
        });
    }

    function submit(event: FormEvent) {
        event.preventDefault();

        if (series) {
            form.patch(update.url(series.id));
        } else {
            form.post(store.url());
        }
    }

    return {
        yearLabel,
        level,
        levels,
        series,
        subjects,
        unavailableSubjects,
        others,
        form,
        data,
        setData,
        errors,
        processing,
        fieldError,
        code,
        eligibleSubjects,
        copySources,
        core,
        pool,
        inPool,
        electivesAllowed,
        unstaffed,
        toggleElective,
        copyFrom,
        changeDomain,
        submit,
    };
}

export type SeriesEditModel = ReturnType<typeof useSeriesEdit>;
