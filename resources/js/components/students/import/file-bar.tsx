import { router } from '@inertiajs/react';
import { destroy } from '@/actions/App/Http/Controllers/StudentImportController';
import { money } from '../ui';
import { t } from '../../../lib/i18n';
import { type FileInfo } from './model';

/** The uploaded file, with a way to replace it. */
export function FileBar({ file, note }: { file: FileInfo; note: string }) {
    return (
        <div className="flex items-center gap-3 rounded-md bg-surface px-4 py-3">
            <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                className="shrink-0"
            >
                <path
                    d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5"
                    fill="none"
                    stroke="var(--color-text)"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                />
            </svg>
            <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-mono text-[13px] leading-[18px] text-text">
                    {file.name}
                </span>
                <span className="text-[12px] leading-4 text-text-muted">
                    {t(':rows rows · :note', { rows: money(file.rows), note })}
                </span>
            </div>
            <button
                type="button"
                onClick={() => router.delete(destroy.url())}
                className="text-[13px] leading-4 font-medium text-primary hover:underline"
            >
                {t('Replace file')}
            </button>
        </div>
    );
}
