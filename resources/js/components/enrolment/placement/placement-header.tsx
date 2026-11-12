import { router } from '@inertiajs/react';
import { placeAll } from '@/actions/App/Http/Controllers/StudentPlacementController';
import { t } from '../../../lib/i18n';
import { outlineButtonClass } from '../../structure/ui';
import { EnrolmentHeader, count } from '../ui';
import { type ClassPlacement } from './model';

/** The page header with the button that places a level automatically. */
export function PlacementHeader({
    classPlacement,
}: {
    classPlacement: ClassPlacement;
}) {
    const { enrolment, level, waiting, classes, freeSeats } = classPlacement;

    return (
        <EnrolmentHeader
            progress={enrolment}
            trail={[{ label: t('Class placement') }]}
            title={t('Class placement')}
            meta={t(
                'give every promoted, repeating and admitted student a class',
            )}
            action={
                level &&
                waiting.length > 0 &&
                classes.length > 0 && (
                    <button
                        type="button"
                        onClick={() =>
                            router.post(
                                placeAll.url(),
                                { level_id: level.id },
                                { preserveScroll: true },
                            )
                        }
                        className={outlineButtonClass}
                    >
                        {t('Place')}{' '}
                        {count(Math.min(waiting.length, freeSeats))}{' '}
                        {level.name}{' '}
                        {Math.min(waiting.length, freeSeats) === 1
                            ? t('student')
                            : t('students')}{' '}
                        {t('automatically')}
                    </button>
                )
            }
        />
    );
}
