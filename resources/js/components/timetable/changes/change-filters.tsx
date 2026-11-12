import { t } from '../../../lib/i18n';
import { fieldLabelClass } from '../../structure/ui';
import { inputClass, type TimetableChanges } from './model';

/** The teacher or class, and the day the change is for. */
export function ChangeFilters({ changes }: { changes: TimetableChanges }) {
    const {
        props,
        mode,
        date,
        termStarts,
        termEnds,
        setFirst,
        setSecond,
        visit,
    } = changes;

    return (
        <div className="flex flex-col gap-4 sm:flex-row">
            {mode === 'cover' ? (
                <label
                    className={`flex min-w-0 flex-1 flex-col gap-[6px] ${fieldLabelClass}`}
                >
                    {t('Teacher who is away')}
                    <select
                        value={props.teacher ?? ''}
                        onChange={(e) => visit({ teacher: e.target.value })}
                        className={inputClass}
                    >
                        <option value="">{t('Choose a teacher')}</option>
                        {(props.teachers ?? []).map((teacher) => (
                            <option key={teacher.id} value={teacher.id}>
                                {teacher.name}
                            </option>
                        ))}
                    </select>
                </label>
            ) : (
                <label
                    className={`flex min-w-0 flex-1 flex-col gap-[6px] ${fieldLabelClass}`}
                >
                    {t('Class')}
                    <select
                        value={props.class ?? ''}
                        onChange={(e) => {
                            setFirst('');
                            setSecond('');
                            visit({ class: e.target.value });
                        }}
                        className={inputClass}
                    >
                        <option value="">{t('Choose a class')}</option>
                        {(props.classes ?? []).map((option) => (
                            <option key={option.id} value={option.id}>
                                {option.name}
                            </option>
                        ))}
                    </select>
                </label>
            )}
            <label
                className={`flex shrink-0 flex-col gap-[6px] sm:w-[200px] ${fieldLabelClass}`}
            >
                {t('Day')}
                <input
                    type="date"
                    value={date}
                    min={termStarts}
                    max={termEnds}
                    onChange={(e) =>
                        e.target.value && visit({ date: e.target.value })
                    }
                    className={`${inputClass} font-mono`}
                />
            </label>
        </div>
    );
}
