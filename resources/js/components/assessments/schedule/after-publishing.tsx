import { t } from '../../../lib/i18n';
import { linkClass } from '../ui';
import { type Schedule } from './model';

/** What publishing does and does not do, and printing the papers. */
export function AfterPublishing({ schedule }: { schedule: Schedule }) {
    const { plan } = schedule;

    return (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-4">
            <p className="text-[13px] leading-4 font-semibold text-text">
                {t('After publishing')}
            </p>
            <p className="text-[13px] leading-[19px] text-text-muted">
                {t(
                    'The Calendar shows :plan as scheduled with a timetable. Nobody is told automatically; share the papers with students and invigilators yourself.',
                    { plan: plan.name },
                )}
            </p>
            <button
                type="button"
                onClick={() => window.print()}
                className={`self-start ${linkClass}`}
            >
                {t('Print this level’s papers')}
            </button>
        </div>
    );
}
