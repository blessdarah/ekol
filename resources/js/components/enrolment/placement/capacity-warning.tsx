import { router } from '@inertiajs/react';
import { storeClass } from '@/actions/App/Http/Controllers/EnrolmentController';
import { t } from '../../../lib/i18n';
import { count } from '../ui';
import { type ClassPlacement, type PlacementLevel } from './model';

/** The warning when a level has no classes or too few seats. */
export function CapacityWarning({
    classPlacement,
    level,
}: {
    classPlacement: ClassPlacement;
    level: PlacementLevel;
}) {
    const { enrolment, classes } = classPlacement;

    return (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-solid border-warning bg-warning-tint px-4 py-3">
            <p className="min-w-0 flex-1 text-[13px] leading-[19px] text-text">
                {classes.length === 0
                    ? t(
                          ':level has no classes in :year yet. Add one to start placing.',
                          {
                              level: level.name,
                              year: enrolment.year,
                          },
                      )
                    : t(
                          ':level has :expected students for :seats seats. Add a class or raise the class size, or some students will have no seat.',
                          {
                              level: level.name,
                              expected: count(level.expected),
                              seats: count(level.seats),
                          },
                      )}
            </p>
            <button
                type="button"
                onClick={() =>
                    router.post(
                        storeClass.url(level.id),
                        {},
                        { preserveScroll: true },
                    )
                }
                className="flex h-8 shrink-0 items-center rounded-md border border-solid border-border bg-white px-[14px] text-[13px] leading-4 font-medium text-text hover:bg-surface"
            >
                {t('Add a class to :level', {
                    level: level.name,
                })}
            </button>
        </div>
    );
}
