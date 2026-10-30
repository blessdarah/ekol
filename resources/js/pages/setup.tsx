import { Head } from '@inertiajs/react';
import { useState } from 'react';
import { withAppShell } from '../layouts/app-layout';
import { t } from '../lib/i18n';
import {
    type SaveState,
    type SetupProps,
    SaveContext,
} from '../components/setup/shared';
import { ProfileZone } from '../components/setup/profile';
import { YearZone } from '../components/setup/academic-year';
import { InstallmentsZone } from '../components/setup/installments';
import { WindowsZone } from '../components/setup/assessment-windows';
import { SchooldayZone } from '../components/setup/school-day';

const SAVE_LABELS: Record<SaveState, string> = {
    idle: 'Changes save automatically',
    saving: 'Saving…',
    saved: 'All changes saved',
    error: 'Some changes could not be saved',
};

function SetupPage({
    school,
    years,
    year,
    terms,
    templates,
    periods,
    assessments,
}: SetupProps) {
    const [saveState, setSaveState] = useState<SaveState>('idle');

    return (
        <SaveContext value={setSaveState}>
            <Head title={t('School Setup')} />
            <div className="flex flex-col gap-7">
                <div className="flex flex-wrap items-end justify-between gap-2">
                    <h1 className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text sm:text-[40px] sm:leading-[44px]">
                        {t('School Setup')}
                    </h1>
                    <p
                        aria-live="polite"
                        className={`text-[13px] leading-4 ${saveState === 'error' ? 'text-danger' : 'text-text-muted'}`}
                    >
                        {t(SAVE_LABELS[saveState])}
                    </p>
                </div>
                <ProfileZone school={school} />
                <YearZone years={years} year={year} terms={terms} />
                <InstallmentsZone year={year} templates={templates} />
                <WindowsZone assessments={assessments} />
                <SchooldayZone school={school} periods={periods} />
            </div>
        </SaveContext>
    );
}

export default withAppShell(SetupPage);
