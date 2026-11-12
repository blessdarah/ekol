import { Link } from '@inertiajs/react';
import { reEnrolment } from '@/actions/App/Http/Controllers/ReEnrolmentController';
import { t } from '../../../lib/i18n';
import { capsLabelClass } from '../../structure/ui';
import { amberText, count, linkClass } from '../ui';
import { BigNumber, SplitBar, Stat } from './figures';
import { type EnrolmentOverview, cardClass } from './model';

/** This year's students, by what happens to them next year. */
export function ContinuingCard({ overview }: { overview: EnrolmentOverview }) {
    const { continuing, currentLabel } = overview;

    return (
        <div className={cardClass}>
            <div className="flex items-baseline justify-between gap-3">
                <p className={capsLabelClass}>{t('Continuing students')}</p>
                <Link href={reEnrolment.url()} className={linkClass}>
                    {continuing.undecided > 0
                        ? t('Decide :undecided →', {
                              undecided: count(continuing.undecided),
                          })
                        : t('Open promotion →')}
                </Link>
            </div>
            <BigNumber
                value={continuing.total}
                label={t('from :year', {
                    year: currentLabel ?? 'this year',
                })}
            />
            <SplitBar
                parts={[
                    {
                        value: continuing.total - continuing.undecided,
                        tone: 'bg-success',
                    },
                    { value: continuing.undecided, tone: 'bg-warning' },
                ]}
            />
            <div className="flex flex-wrap gap-5">
                <Stat value={continuing.promote} label={t('Promote')} />
                <Stat value={continuing.repeat} label={t('Repeat')} />
                <Stat value={continuing.leaving} label={t('Leaving')} />
                <Stat
                    value={continuing.undecided}
                    label={t('Not decided')}
                    tone={continuing.undecided > 0 ? amberText : undefined}
                />
            </div>
        </div>
    );
}
