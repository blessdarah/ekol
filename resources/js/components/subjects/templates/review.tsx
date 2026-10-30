import { t } from '../../../lib/i18n';
import { capsLabelClass } from '../../structure/ui';
import { tableRowClass } from '../../table/ui';
import { totalPeriods } from '../class-table';
import { type TemplateWizard, isReady, staffing } from './model';

/** Step 3: every subject with its classes and teachers, ready to create. */
export function ReviewAndCreate({ wizard }: { wizard: TemplateWizard }) {
    const {
        unticked,
        plans,
        showAll,
        setShowAll,
        picked,
        alreadyRegistered,
        ready,
        periods,
    } = wizard;

    return (
        <div className="flex flex-1 flex-col gap-8 lg:flex-row">
            <div className="flex min-w-0 flex-1 flex-col gap-5">
                <dl className="flex border-y border-solid border-border">
                    {[
                        [
                            t('To create'),
                            picked.length,
                            'subjects',
                            'text-text',
                        ],
                        [
                            'Ready',
                            ready.length,
                            'fully staffed',
                            'text-success',
                        ],
                        [
                            'Drafts',
                            picked.length - ready.length,
                            'need a teacher',
                            'text-warning-text',
                        ],
                        [
                            'Periods',
                            periods,
                            'per week, all classes',
                            'text-text',
                        ],
                    ].map(([label, value, note, tone], position) => (
                        <div
                            key={label as string}
                            className={`flex flex-1 flex-col gap-1 py-[14px] ${position === 0 ? 'pr-4' : 'border-l border-solid border-border px-4'}`}
                        >
                            <dt className={capsLabelClass}>{label}</dt>
                            <dd className="flex flex-col gap-1">
                                <span
                                    className={`font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] ${tone}`}
                                >
                                    {value}
                                </span>
                                <span className="text-[13px] leading-4 text-text-muted">
                                    {note}
                                </span>
                            </dd>
                        </div>
                    ))}
                </dl>
                <div className="flex flex-col overflow-clip rounded-md border border-solid border-border">
                    <div className="flex h-8 shrink-0 items-center gap-3 bg-surface px-3 text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase">
                        <span className="flex-1">{t('Subject')}</span>
                        <span className="w-11 shrink-0">{t('Coeff')}</span>
                        <span className="w-[170px] shrink-0">
                            {t('Classes & teachers')}
                        </span>
                        <span className="w-16 shrink-0">{t('Periods')}</span>
                        <span className="w-[92px] shrink-0">{t('Status')}</span>
                    </div>
                    {(showAll ? picked : picked.slice(0, 8)).map(
                        (subject, position) => {
                            const plan = plans[subject.code];
                            const done = isReady(plan);

                            return (
                                <div
                                    key={subject.code}
                                    className={`flex h-[38px] shrink-0 items-center gap-3 border-t border-solid border-border px-3 ${tableRowClass({ index: position })}`}
                                >
                                    <span className="flex-1 truncate text-[14px] leading-[18px] font-medium text-text">
                                        {subject.name}
                                    </span>
                                    <span className="w-11 shrink-0 font-mono text-[13px] leading-4 text-text">
                                        {subject.coefficient}
                                    </span>
                                    <span className="flex w-[170px] shrink-0 items-center gap-[6px] text-[13px] leading-4 text-text">
                                        {!done && (
                                            <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-warning" />
                                        )}
                                        {staffing(plan)}
                                    </span>
                                    <span className="w-16 shrink-0 font-mono text-[13px] leading-4 text-text">
                                        {totalPeriods(plan.assignments)}
                                    </span>
                                    <span
                                        className={`flex h-[22px] w-[92px] shrink-0 items-center gap-[6px] rounded-full px-2 text-[12px] leading-4 font-medium ${
                                            done
                                                ? 'bg-success-tint text-success'
                                                : 'bg-warning-tint text-warning-text'
                                        }`}
                                    >
                                        <span
                                            className={`h-[6px] w-[6px] shrink-0 rounded-full ${done ? 'bg-success' : 'bg-warning'}`}
                                        />
                                        {done ? t('Ready') : t('Draft')}
                                    </span>
                                </div>
                            );
                        },
                    )}
                    <div className="flex h-9 shrink-0 items-center justify-between border-t border-solid border-border bg-surface px-3">
                        <span className="text-[13px] leading-4 text-text-muted">
                            {showAll
                                ? picked.length
                                : Math.min(8, picked.length)}{' '}
                            {t('of')} {picked.length} {t('shown')}
                        </span>
                        {picked.length > 8 && (
                            <button
                                type="button"
                                onClick={() => setShowAll(!showAll)}
                                className="text-[13px] leading-4 font-medium text-primary hover:underline"
                            >
                                {showAll
                                    ? t('Show fewer')
                                    : t('Show all :picked', {
                                          picked: picked.length,
                                      })}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <aside className="flex shrink-0 flex-col gap-5 border-solid border-border lg:w-[328px] lg:border-l lg:pl-8">
                <div className="flex flex-col gap-2 rounded-lg border border-solid border-border bg-surface p-4">
                    <p className={capsLabelClass}>{t('When you create')}</p>
                    <p className="font-display text-[16px] leading-[22px] font-bold text-text">
                        {t('Ready subjects go live straight away.')}
                    </p>
                    <p className="text-[13px] leading-[19px] text-text-muted">
                        {t(
                            'They open for marks entry and the timetable. Drafts wait under Needs teacher in the roster until every class has one.',
                        )}
                    </p>
                </div>
                {alreadyRegistered + unticked.length > 0 && (
                    <div className="flex flex-col gap-[10px] rounded-lg border border-solid border-border bg-white p-4">
                        <p className="text-[14px] leading-[18px] font-semibold text-text">
                            {t('Left as they are')}
                        </p>
                        {alreadyRegistered > 0 && (
                            <p className="flex items-center gap-2 text-[13px] leading-4 text-text-muted">
                                <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-success" />
                                {alreadyRegistered} {t('already registered')}
                            </p>
                        )}
                        {unticked.length > 0 && (
                            <p className="flex items-center gap-2 text-[13px] leading-4 text-text-muted">
                                <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-success" />
                                {unticked.length}{' '}
                                {t('template subjects you unticked')}
                            </p>
                        )}
                    </div>
                )}
            </aside>
        </div>
    );
}
