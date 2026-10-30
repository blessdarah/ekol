import { Head, Link } from '@inertiajs/react';
import { index as changes } from '@/actions/App/Http/Controllers/TimetableChangeController';
import {
    generator,
    index as overview,
    publishing,
} from '@/actions/App/Http/Controllers/TimetableController';
import {
    TimetableHeader,
    primaryActionClass,
    quietActionClass,
} from '../../components/timetable/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';
import {
    type ReviewProps,
    useTimetableReview,
} from '../../components/timetable/review/model';
import { ReviewPicker } from '../../components/timetable/review/review-picker';
import { ReviewGrid } from '../../components/timetable/review/review-grid';
import { SelectedLesson } from '../../components/timetable/review/selected-lesson';
function Review(props: ReviewProps) {
    const model = useTimetableReview(props);
    const { phase, version, readOnly } = model;
    return (
        <div className="flex flex-col gap-5 lg:min-h-[calc(100vh-56px)]">
            <Head title={t('Review the timetable')} />
            <TimetableHeader
                page="review"
                phase={phase}
                trail={[
                    { label: readOnly ? t('Live timetable') : t('Review') },
                ]}
                title={
                    readOnly
                        ? t('The live timetable')
                        : t('Review the timetable')
                }
                meta={
                    readOnly
                        ? t(
                              'Version :number · what the school works from. It changes only through Changes or a new version.',
                              { number: version.number },
                          )
                        : t(
                              'Draft version :number · look at it by class, by teacher or by room, and fix what is flagged.',
                              { number: version.number },
                          )
                }
                action={
                    readOnly ? (
                        <>
                            <Link
                                href={overview.url()}
                                className={quietActionClass}
                            >
                                {t('← Overview')}
                            </Link>
                            <Link
                                href={changes.url()}
                                className={primaryActionClass}
                            >
                                {t('Open Changes')}
                            </Link>
                        </>
                    ) : (
                        <>
                            <Link
                                href={generator.url()}
                                className={quietActionClass}
                            >
                                {t('← Generate again')}
                            </Link>
                            <Link
                                href={publishing.url()}
                                aria-disabled={phase.to_fix !== 0}
                                tabIndex={phase.to_fix !== 0 ? -1 : undefined}
                                className={primaryActionClass}
                            >
                                {t('Next: publish →')}
                            </Link>
                        </>
                    )
                }
            />

            <div className="flex flex-1 flex-col gap-5 xl:flex-row">
                <ReviewPicker {...model} />

                <ReviewGrid {...model} />

                <SelectedLesson {...model} />
            </div>
        </div>
    );
}
export default withAppShell(Review);
