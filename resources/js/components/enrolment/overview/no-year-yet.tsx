import { Head } from '@inertiajs/react';
import { show as setup } from '@/actions/App/Http/Controllers/SetupController';
import { t } from '../../../lib/i18n';
import Breadcrumbs from '../../shell/breadcrumbs';
import { NoYear } from '../ui';

/** Shown until the next school year is set up. */
export function NoYearYet({ currentLabel }: { currentLabel: string | null }) {
    return (
        <div className="flex flex-col gap-5">
            <Head title={t('New school year')} />
            <div className="flex flex-col gap-[6px]">
                <Breadcrumbs trail={[{ label: t('New school year') }]} />
                <h1 className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text sm:text-[40px] sm:leading-[44px]">
                    {t('New school year')}
                </h1>
            </div>
            <NoYear currentLabel={currentLabel} setupHref={setup.url()} />
        </div>
    );
}
