import { t } from '../../../lib/i18n';
import { ErrorText, capsLabelClass } from '../../structure/ui';
import { limits } from '../ui';
import { type RegisterOne } from './model';

/** Step 2: the chosen series' core subjects and the electives to tick. */
export function SubjectList({ registration }: { registration: RegisterOne }) {
    const { chosen, core, pool, total, electives, toggle, teachers, errors } =
        registration;

    if (!chosen) {
        return null;
    }

    return (
        <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <p className={capsLabelClass}>
                    {t('2 · Subjects for :code', {
                        code: chosen.code,
                    })}
                </p>
                <div className="flex items-center gap-[10px]">
                    <span className="text-[13px] leading-4 text-text-muted">
                        {limits(chosen)}
                    </span>
                    {chosen.max !== null && (
                        <span aria-hidden="true" className="flex gap-[3px]">
                            {Array.from(
                                { length: chosen.max },
                                (_, position) => (
                                    <span
                                        key={position}
                                        className={`h-[6px] w-[18px] shrink-0 rounded-[2px] ${position < total ? 'bg-primary' : 'bg-border'}`}
                                    />
                                ),
                            )}
                        </span>
                    )}
                    <span className="font-mono text-[14px] leading-[18px] text-text">
                        {total}
                        {chosen.max !== null ? `/${chosen.max}` : ''}
                    </span>
                </div>
            </div>
            <ul className="flex flex-col overflow-clip rounded-lg border border-solid border-border">
                {core.map((subject) => (
                    <li
                        key={subject.id}
                        className="flex min-h-[52px] shrink-0 items-center gap-[14px] border-b border-solid border-border bg-surface px-4 last:border-b-0"
                    >
                        <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-sm bg-text-muted">
                            <svg width="11" height="11" viewBox="0 0 24 24">
                                <rect
                                    x="5"
                                    y="11"
                                    width="14"
                                    height="10"
                                    rx="2"
                                    fill="none"
                                    stroke="var(--color-bg)"
                                    strokeWidth="3"
                                />
                                <path
                                    d="M8 11V7a4 4 0 018 0v4"
                                    fill="none"
                                    stroke="var(--color-bg)"
                                    strokeWidth="3"
                                />
                            </svg>
                        </span>
                        <span className="min-w-0 flex-1 text-[14px] leading-[18px] font-medium text-text">
                            {subject.name}
                        </span>
                        <span className="flex w-20 shrink-0">
                            <span className="flex h-[22px] items-center rounded-sm border border-solid border-text px-2 text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-text">
                                {t('CORE')}
                            </span>
                        </span>
                        <Teacher name={teachers[subject.id]} />
                    </li>
                ))}
                {pool.map((subject) => {
                    const on = electives.includes(subject.id);

                    return (
                        <li
                            key={subject.id}
                            className="border-b border-solid border-border last:border-b-0"
                        >
                            <label className="flex min-h-[52px] cursor-pointer items-center gap-[14px] px-4 hover:bg-row-alt">
                                <input
                                    type="checkbox"
                                    checked={on}
                                    onChange={() => toggle(subject.id)}
                                    className="h-[18px] w-[18px] shrink-0 accent-primary"
                                />
                                <span
                                    className={`min-w-0 flex-1 text-[14px] leading-[18px] text-text ${on ? 'font-medium' : ''}`}
                                >
                                    {subject.name}
                                </span>
                                <span className="flex w-20 shrink-0">
                                    <span className="flex h-[22px] items-center rounded-sm border border-dashed border-text-muted px-2 text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-text-muted">
                                        {t('ELECTIVE')}
                                    </span>
                                </span>
                                <Teacher name={teachers[subject.id]} />
                            </label>
                        </li>
                    );
                })}
            </ul>
            <ErrorText message={errors.electives} />
        </section>
    );
}

/** Who teaches a subject, or a warning when nobody does. */
function Teacher({ name }: { name?: string }) {
    return (
        <span
            className={`w-40 shrink-0 truncate text-[13px] leading-4 ${name ? 'text-text-muted' : 'text-warning'}`}
        >
            {name ?? t('No teacher assigned')}
        </span>
    );
}
