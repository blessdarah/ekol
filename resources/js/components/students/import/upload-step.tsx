import { Link } from '@inertiajs/react';
import { index } from '@/actions/App/Http/Controllers/StudentRosterController';
import { template } from '@/actions/App/Http/Controllers/StudentImportController';
import {
    ErrorText,
    outlineButtonClass,
    solidButtonClass,
} from '../../structure/ui';
import { t } from '../../../lib/i18n';
import { useUploadStep } from './model';

/** The first step: picking the CSV file to upload. */
export function UploadStep({ hasYear }: { hasYear: boolean }) {
    const { form, submit } = useUploadStep();

    return (
        <div className="flex flex-col gap-8 lg:flex-row">
            <form
                onSubmit={submit}
                className="flex min-w-0 flex-1 flex-col gap-4"
            >
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-surface px-6 py-10 text-center hover:border-primary">
                    <span className="text-[14px] leading-[18px] font-semibold text-text">
                        {form.data.file
                            ? form.data.file.name
                            : t('Choose a CSV file')}
                    </span>
                    <span className="text-[13px] leading-[19px] text-text-muted">
                        {t(
                            'One row per student, with a header line. Up to 5,000 rows and 2 MB.',
                        )}
                    </span>
                    <input
                        type="file"
                        accept=".csv,text/csv"
                        className="sr-only"
                        onChange={(e) =>
                            form.setData('file', e.target.files?.[0] ?? null)
                        }
                    />
                </label>
                <ErrorText message={form.errors.file} />
                {!hasYear && (
                    <p className="text-[13px] leading-[19px] text-warning">
                        {t(
                            'Students are placed in classes of an academic year. Make a year active in School Setup before importing.',
                        )}
                    </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <a
                        href={template.url()}
                        className="text-[13px] leading-4 font-medium text-primary hover:underline"
                    >
                        {t('Download a template to fill in')}
                    </a>
                    <div className="flex gap-2">
                        <Link href={index.url()} className={outlineButtonClass}>
                            {t('Cancel')}
                        </Link>
                        <button
                            type="submit"
                            disabled={
                                !form.data.file || form.processing || !hasYear
                            }
                            className={solidButtonClass}
                        >
                            {t('Upload and match columns')}
                        </button>
                    </div>
                </div>
            </form>
            <aside className="flex shrink-0 flex-col gap-5 border-solid border-border lg:w-[328px] lg:border-l lg:pl-8">
                <div className="flex flex-col gap-[10px] rounded-lg border border-solid border-border bg-white p-4">
                    <p className="text-[14px] leading-[18px] font-semibold text-text">
                        {t('What each row needs')}
                    </p>
                    <ul className="flex flex-col gap-2 text-[13px] leading-[18px] text-text-muted">
                        <li>{t('Full name, surname first')}</li>
                        <li>
                            {t('Date of birth, as 2010-03-14 or 14/03/2010')}
                        </li>
                        <li>{t('Gender: boy or girl')}</li>
                        <li>{t('Class, spelled as on the Levels page')}</li>
                        <li>{t('A guardian’s name and phone number')}</li>
                    </ul>
                </div>
                <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border bg-white p-4">
                    <p className="text-[13px] leading-4 font-semibold text-text">
                        {t('Using Excel or Google Sheets?')}
                    </p>
                    <p className="text-[13px] leading-[19px] text-text-muted">
                        {t(
                            'Save or download the sheet as CSV first. Excel files cannot be read directly yet.',
                        )}
                    </p>
                </div>
            </aside>
        </div>
    );
}
