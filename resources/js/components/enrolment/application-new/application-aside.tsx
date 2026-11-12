import { Link } from '@inertiajs/react';
import { index } from '@/actions/App/Http/Controllers/ApplicationRosterController';
import { t } from '../../../lib/i18n';
import {
    capsLabelClass,
    outlineButtonClass,
    solidButtonClass,
} from '../../structure/ui';
import { type NewApplication } from './model';

/** The documents handed in, saving, and what saving does not do. */
export function ApplicationAside({
    application,
}: {
    application: NewApplication;
}) {
    const { data, asked, toggleDocument, processing } = application;

    return (
        <aside className="flex shrink-0 flex-col gap-5 border-solid border-border lg:w-[328px] lg:border-l lg:pl-8">
            <div className="flex flex-col gap-[14px] rounded-lg border border-solid border-border bg-surface p-4">
                <p className={capsLabelClass}>{t('Documents received')}</p>
                <div className="flex flex-col gap-[10px]">
                    {asked.map(([key, label]) => (
                        <label
                            key={key}
                            className="flex cursor-pointer items-center gap-[10px] text-[13px] leading-[18px] text-text"
                        >
                            <input
                                type="checkbox"
                                checked={data.documents.includes(key)}
                                onChange={() => toggleDocument(key)}
                                className="h-[18px] w-[18px] shrink-0 accent-primary"
                            />
                            {label}
                        </label>
                    ))}
                </div>
                <p className="text-[13px] leading-[18px] text-text-muted">
                    {t(
                        'Tick what the family has handed in. The rest shows as missing and can be ticked later.',
                    )}
                </p>
                <div className="flex flex-col gap-2">
                    <button
                        type="submit"
                        disabled={processing}
                        className={`${solidButtonClass} h-10 text-[14px]`}
                    >
                        {t('Save application')}
                    </button>
                    <Link href={index.url()} className={outlineButtonClass}>
                        {t('Cancel')}
                    </Link>
                </div>
            </div>
            <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border bg-white p-4">
                <p className="text-[13px] leading-4 font-semibold text-text">
                    {t('Not a student yet')}
                </p>
                <p className="text-[13px] leading-[19px] text-text-muted">
                    {t(
                        'Saving creates no student and no matricule. That happens when the application is admitted.',
                    )}
                </p>
            </div>
        </aside>
    );
}
