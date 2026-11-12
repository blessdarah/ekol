import { t } from '../../../lib/i18n';
import { weekDates, type Week } from '../ui';
import { smallSelect } from './model';

/** Picking the week a sub-topic is taught in, or taking it out of the plan. */
export function WeekPicker({
    weeks,
    value,
    label,
    onPick,
}: {
    weeks: Week[];
    value: number | null;
    label: string;
    onPick: (week: number | null) => void;
}) {
    return (
        <select
            aria-label={label}
            value={value ?? ''}
            onChange={(e) =>
                onPick(e.target.value === '' ? null : Number(e.target.value))
            }
            className={smallSelect}
        >
            <option value="">
                {value === null
                    ? t('Place in week…')
                    : t('Take out of the plan')}
            </option>
            {weeks.map((week) => (
                <option key={week.week} value={week.week}>
                    {t('Week :week', { week: week.week })} · {weekDates(week)}
                    {week.free ? ` · ${week.free}` : ''}
                </option>
            ))}
        </select>
    );
}
