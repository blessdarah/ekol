import { router, useForm } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import {
    mapping as saveMapping,
    upload,
} from '@/actions/App/Http/Controllers/StudentImportController';
import { t } from '../../../lib/i18n';

export interface Field {
    key: string;
    label: string;
    required: boolean;
}

export interface FileInfo {
    name: string;
    rows: number;
    headers: string[];
}

export interface Problem {
    row: number;
    name: string;
    status: 'fix' | 'duplicate';
    problem: string;
}

export interface ImportProps {
    yearLabel: string | null;
    hasYear: boolean;
    fields: Field[];
    step: 'upload' | 'match' | 'check';
    file?: FileInfo;
    sample?: string[][];
    guess?: Record<string, number | null>;
    mapping?: { field: string; column: string }[];
    nextMatricule?: string;
    report?: {
        rows: number;
        ready: number;
        fix: number;
        duplicates: number;
        problems: Problem[];
    };
}

export interface MatchStepProps {
    fields: Field[];
    file: FileInfo;
    sample: string[][];
    guess: Record<string, number | null>;
}

export interface CheckStepProps {
    file: FileInfo;
    mapping: { field: string; column: string }[];
    report: NonNullable<ImportProps['report']>;
    nextMatricule: string;
    hasYear: boolean;
}

export const STEPS = ['Upload', 'Match columns', 'Check and import'];

/** The CSV file picked for upload, and sending it. */
export function useUploadStep() {
    const form = useForm({ file: null as File | null });

    function submit(event: FormEvent) {
        event.preventDefault();
        form.post(upload.url());
    }

    return { form, submit };
}

/** Which file column each field is read from, and saving that choice. */
export function useMatchStep({ fields, file, sample, guess }: MatchStepProps) {
    const [chosen, setChosen] = useState<Record<string, string>>(() =>
        Object.fromEntries(
            fields.map((field) => [
                field.key,
                guess[field.key]?.toString() ?? '',
            ]),
        ),
    );
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const matched = fields.filter((field) => chosen[field.key] !== '').length;

    function submit(event: FormEvent) {
        event.preventDefault();
        setSaving(true);
        router.post(
            saveMapping.url(),
            {
                mapping: Object.fromEntries(
                    fields.map((field) => [
                        field.key,
                        chosen[field.key] === ''
                            ? null
                            : Number(chosen[field.key]),
                    ]),
                ),
            },
            {
                onError: (failed) => setErrors(failed),
                onFinish: () => setSaving(false),
            },
        );
    }

    return {
        fields,
        file,
        sample,
        chosen,
        setChosen,
        errors,
        saving,
        matched,
        submit,
    };
}

export type MatchStepModel = ReturnType<typeof useMatchStep>;

/** The check of the rows before import, and running the import. */
export function useCheckStep({
    file,
    mapping,
    report,
    nextMatricule,
    hasYear,
}: CheckStepProps) {
    const [showAll, setShowAll] = useState(false);
    const [importing, setImporting] = useState(false);
    const shown = showAll ? report.problems : report.problems.slice(0, 6);
    const stats: [string, number, string][] = [
        ['Rows', report.rows, 'text-text'],
        ['Ready', report.ready, 'text-success'],
        [t('Need fixing'), report.fix, 'text-danger'],
        [t('Possible duplicates'), report.duplicates, 'text-warning-text'],
    ];

    return {
        file,
        mapping,
        report,
        nextMatricule,
        hasYear,
        showAll,
        setShowAll,
        importing,
        setImporting,
        shown,
        stats,
    };
}

export type CheckStepModel = ReturnType<typeof useCheckStep>;
