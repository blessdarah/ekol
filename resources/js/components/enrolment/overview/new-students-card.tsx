import { Link } from '@inertiajs/react';
import { index as applicationsIndex } from '@/actions/App/Http/Controllers/ApplicationRosterController';
import { t, tChoice } from '../../../lib/i18n';
import { capsLabelClass } from '../../structure/ui';
import { amberText, count, linkClass } from '../ui';
import { BigNumber, SplitBar, Stat } from './figures';
import { type EnrolmentOverview, cardClass } from './model';

/** Applications for the new year, by where they stand. */
export function NewStudentsCard({ overview }: { overview: EnrolmentOverview }) {
    const { applications } = overview;

    return (
        <div className={cardClass}>
            <div className="flex items-baseline justify-between gap-3">
                <p className={capsLabelClass}>{t('New students')}</p>
                <Link
                    href={applicationsIndex.url(
                        applications.to_review > 0
                            ? { query: { stage: 'to_review' } }
                            : undefined,
                    )}
                    className={linkClass}
                >
                    {applications.to_review > 0
                        ? tChoice(
                              '{1} Review :count application →|[2,*] Review :count applications →',
                              applications.to_review,
                              { count: count(applications.to_review) },
                          )
                        : t('Open applications →')}
                </Link>
            </div>
            <BigNumber
                value={applications.total}
                label={
                    applications.total === 1
                        ? t('application')
                        : t('applications')
                }
            />
            <SplitBar
                parts={[
                    {
                        value: applications.admitted,
                        tone: 'bg-success',
                    },
                    {
                        value: applications.to_review,
                        tone: 'bg-warning',
                    },
                    {
                        value: applications.waitlist,
                        tone: 'bg-text-muted',
                    },
                    { value: applications.declined, tone: 'bg-border' },
                ]}
            />
            <div className="flex flex-wrap gap-5">
                <Stat value={applications.admitted} label={t('Admitted')} />
                <Stat
                    value={applications.to_review}
                    label={t('To review')}
                    tone={applications.to_review > 0 ? amberText : undefined}
                />
                <Stat value={applications.waitlist} label={t('Waitlist')} />
                <Stat value={applications.declined} label={t('Declined')} />
            </div>
        </div>
    );
}
