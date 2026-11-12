import { Link } from '@inertiajs/react';
import { placement as placementPage } from '@/actions/App/Http/Controllers/StudentPlacementController';
import { t } from '../../../lib/i18n';
import { capsLabelClass } from '../../structure/ui';
import { FillBar, count, linkClass } from '../ui';
import { BigNumber } from './figures';
import { type EnrolmentOverview, cardClass } from './model';

/** How many expected students already have a class. */
export function PlacementCard({ overview }: { overview: EnrolmentOverview }) {
    const { enrolment, continuing, placed } = overview;

    return (
        <div className={cardClass}>
            <div className="flex items-baseline justify-between gap-3">
                <p className={capsLabelClass}>{t('Class placement')}</p>
                <Link href={placementPage.url()} className={linkClass}>
                    {enrolment.unplaced > 0
                        ? t('Place :unplaced →', {
                              unplaced: count(enrolment.unplaced),
                          })
                        : t('Open placement →')}
                </Link>
            </div>
            <BigNumber
                value={placed}
                label={t('of :expected placed', {
                    expected: count(enrolment.expected),
                })}
            />
            <FillBar
                value={placed}
                max={enrolment.expected}
                height={8}
                tone="bg-science"
            />
            <p className="text-[13px] leading-[19px] text-text-muted">
                {t(
                    'Students can be placed as soon as they are decided. Confirm opens when everyone has a class.',
                )}
                {continuing.graduating > 0 &&
                    t(
                        ' :graduating final-year :are graduating and not re-enrolled.',
                        {
                            graduating: count(continuing.graduating),
                            are:
                                continuing.graduating === 1
                                    ? 'student is'
                                    : 'students are',
                        },
                    )}
            </p>
        </div>
    );
}
