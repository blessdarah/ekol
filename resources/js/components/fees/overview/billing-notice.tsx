import { structure } from '@/actions/App/Http/Controllers/FeeStructureController';
import { Link } from '@inertiajs/react';
import { t } from '../../../lib/i18n';
import { solidButtonClass } from '../../structure/ui';
import { type FeesOverview } from './model';

/** A warning when nobody can be billed or some students are not yet. */
export function BillingNotice({ fees }: { fees: FeesOverview }) {
    const { hasPlans, counts, yearLabel } = fees;

    return (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-solid border-warning bg-warning-tint px-4 py-3">
            <p className="min-w-0 flex-1 text-[13px] leading-[19px] text-text">
                {!hasPlans
                    ? t(
                          'No level has a fee for :year_label yet, so nobody can be billed.',
                          { year_label: yearLabel },
                      )
                    : t(':unbilled :have no invoice for :year_label.', {
                          unbilled: counts.unbilled,
                          have:
                              counts.unbilled === 1
                                  ? 'student has'
                                  : 'students have',
                          year_label: yearLabel,
                      })}{' '}
                {t('Set fees and bill students under Fee structure.')}
            </p>
            <Link href={structure.url()} className={solidButtonClass}>
                {t('Open Fee structure →')}
            </Link>
        </div>
    );
}
