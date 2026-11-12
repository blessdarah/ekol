import { t } from '../../../lib/i18n';
import { tableRowClass } from '../../table/ui';
import { ErrorText, capsLabelClass } from '../ui';
import { type SeriesEditModel } from './model';

/** The subjects students can choose from, with who teaches them. */
export function ElectivePool({ model }: { model: SeriesEditModel }) {
    const { pool, data, toggleElective, inPool, electivesAllowed, fieldError } =
        model;

    return (
        <section className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
                <p className={capsLabelClass}>{t('Elective pool')}</p>
                <p className="text-[13px] leading-4 text-text-muted">
                    {t(
                        'Subjects a student can choose from. Core subjects are not repeated here.',
                    )}
                </p>
            </div>
            <div className="flex flex-col overflow-clip rounded-md border border-solid border-border">
                <div className="flex h-[30px] shrink-0 items-center gap-3 bg-surface px-3 text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase">
                    <span className="w-[18px] shrink-0" />
                    <span className="flex-1">{t('Subject')}</span>
                    <span className="w-[84px] shrink-0">{t('Code')}</span>
                    <span className="w-[190px] shrink-0">{t('Teaching')}</span>
                </div>
                {pool.map((subject, position) => {
                    const chosen = data.electives.includes(subject.id);
                    const muted = chosen ? 'text-text' : 'text-text-muted';

                    return (
                        <label
                            key={subject.id}
                            className={`flex h-[34px] shrink-0 cursor-pointer items-center gap-3 border-t border-solid border-border px-3 ${tableRowClass({ index: position })}`}
                        >
                            <input
                                type="checkbox"
                                checked={chosen}
                                onChange={() => toggleElective(subject.id)}
                                className="h-[18px] w-[18px] shrink-0 accent-primary"
                            />
                            <span
                                className={`flex-1 truncate text-[14px] leading-[18px] font-medium ${muted}`}
                            >
                                {subject.name}
                                <span className="ml-2 text-[11px] font-normal text-text-muted">
                                    {t(
                                        subject.domain.charAt(0).toUpperCase() +
                                            subject.domain.slice(1),
                                    )}
                                </span>
                            </span>
                            <span
                                className={`w-[84px] shrink-0 font-mono text-[12px] leading-4 ${muted}`}
                            >
                                {subject.code}
                            </span>
                            <span className="flex w-[190px] shrink-0 items-center gap-[6px] text-[13px] leading-4">
                                {!chosen ? (
                                    <span className="text-text-muted">
                                        {t('Not in the pool')}
                                    </span>
                                ) : subject.teachers === 0 ? (
                                    <>
                                        <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-warning" />
                                        <span className="text-warning-text">
                                            {t('No teacher assigned')}
                                        </span>
                                    </>
                                ) : (
                                    <span className="text-text">
                                        {subject.teachers}{' '}
                                        {subject.teachers === 1
                                            ? t('teacher')
                                            : t('teachers')}
                                    </span>
                                )}
                            </span>
                        </label>
                    );
                })}
                <div className="flex h-8 shrink-0 items-center justify-between border-t border-solid border-border bg-surface px-3">
                    <span className="text-[13px] leading-4 text-text-muted">
                        {t(':pool subjects', {
                            pool: pool.length,
                        })}
                    </span>
                    <span className="flex items-baseline gap-[6px]">
                        <span className="font-mono text-[13px] leading-4 text-text">
                            {t(':in_pool in the pool', {
                                in_pool: inPool.length,
                            })}
                        </span>
                        <span className="text-[13px] leading-4 text-text-muted">
                            {t('· students pick up to :electives_allowed', {
                                electives_allowed: electivesAllowed,
                            })}
                        </span>
                    </span>
                </div>
            </div>
            <ErrorText message={fieldError('electives')} />
        </section>
    );
}
