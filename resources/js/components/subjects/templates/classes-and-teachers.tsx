import { t } from '../../../lib/i18n';
import { capsLabelClass } from '../../structure/ui';
import { ClassTable, LevelPicker } from '../class-table';
import { type TemplateWizard, isReady } from './model';

/** Step 2: for each subject, its levels, classes, teachers and periods. */
export function ClassesAndTeachers({ wizard }: { wizard: TemplateWizard }) {
    const {
        levels,
        classes,
        staff,
        plans,
        setCurrent,
        sameTeacher,
        setSameTeacher,
        picked,
        active,
        activePlan,
        ready,
        updatePlan,
        changeLevels,
        applyTeacher,
    } = wizard;

    if (!active || !activePlan) {
        return null;
    }

    return (
        <div className="flex flex-1 flex-col gap-8 lg:flex-row">
            <div className="flex shrink-0 flex-col gap-3 lg:w-[300px]">
                <div className="flex items-center justify-between">
                    <p className={capsLabelClass}>
                        {t(':picked subjects', {
                            picked: picked.length,
                        })}
                    </p>
                    {picked.length - ready.length > 0 && (
                        <span className="flex h-6 items-center gap-[6px] rounded-full bg-warning-tint px-[10px] text-[12px] leading-4 font-medium text-warning-text">
                            <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-warning" />
                            {picked.length - ready.length} {t('need teachers')}
                        </span>
                    )}
                </div>
                <div className="flex flex-col gap-[2px] rounded-lg bg-surface p-[6px]">
                    {picked.map((subject) => {
                        const plan = plans[subject.code];
                        const rows = Object.values(plan.assignments);
                        const selected = subject.code === active.code;

                        return (
                            <button
                                key={subject.code}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => {
                                    setCurrent(subject.code);
                                    setSameTeacher('');
                                }}
                                className={`flex h-[38px] shrink-0 items-center gap-[10px] rounded-md px-[10px] text-left ${selected ? 'bg-primary-tint' : 'hover:bg-white'}`}
                            >
                                <span
                                    className={`size-2 shrink-0 rounded-full ${isReady(plan) ? 'bg-success' : 'bg-warning'}`}
                                />
                                <span
                                    className={`flex-1 truncate text-[14px] leading-[18px] ${selected ? 'font-semibold text-primary' : 'font-medium text-text'}`}
                                >
                                    {subject.name}
                                </span>
                                <span className="font-mono text-[12px] leading-4 text-text-muted">
                                    {rows.filter((row) => row.staff_id).length}{' '}
                                    / {rows.length}
                                </span>
                            </button>
                        );
                    })}
                </div>
                <p className="text-[13px] leading-[18px] text-text-muted">
                    {t(
                        'Classes with a teacher, out of classes taking the subject.',
                    )}
                </p>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="flex flex-col gap-[2px]">
                        <h2 className="font-display text-[28px] leading-[34px] font-bold tracking-[-0.02em] text-text">
                            {active.name}
                        </h2>
                        <p className="font-mono text-[13px] leading-4 text-text-muted">
                            {active.code} · {active.department}
                        </p>
                    </div>
                    <p className="flex h-8 items-center gap-2 rounded-md border border-solid border-border bg-surface px-3">
                        <span className="text-[13px] leading-4 text-text-muted">
                            {t('Coefficient')}
                        </span>
                        <span className="font-mono text-[14px] leading-[18px] text-text">
                            {active.coefficient}
                        </span>
                        <span className="text-[12px] leading-4 text-text-muted">
                            {t('from template')}
                        </span>
                    </p>
                </div>
                <LevelPicker
                    levels={levels}
                    value={activePlan.level_ids}
                    onChange={(next) => changeLevels(active.code, next)}
                />
                <div className="flex flex-wrap items-center gap-3 rounded-md bg-surface px-3 py-[10px]">
                    <span className="text-[13px] leading-4 text-text-muted">
                        {t('Same teacher for every class?')}
                    </span>
                    <select
                        aria-label={t('Teacher for every class')}
                        value={sameTeacher}
                        onChange={(e) => setSameTeacher(e.target.value)}
                        className="h-[30px] w-[200px] rounded-md border border-solid border-border bg-white px-[10px] text-[14px] text-text outline-none focus:border-primary"
                    >
                        <option value="">{t('Choose a teacher')}</option>
                        {staff.map((member) => (
                            <option key={member.id} value={member.id}>
                                {member.name}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        disabled={!sameTeacher}
                        onClick={() => applyTeacher(active.code)}
                        className="flex h-[30px] items-center rounded-md border border-solid border-border bg-white px-3 text-[13px] leading-4 font-medium text-text hover:bg-primary-tint disabled:opacity-50"
                    >
                        {t('Apply to all')}
                    </button>
                </div>
                <ClassTable
                    classes={classes.filter((option) =>
                        activePlan.level_ids.includes(option.level_id),
                    )}
                    staff={staff}
                    value={activePlan.assignments}
                    defaultPeriods={active.weekly_periods}
                    onChange={(assignments) =>
                        updatePlan(active.code, { assignments })
                    }
                />
            </div>
        </div>
    );
}
