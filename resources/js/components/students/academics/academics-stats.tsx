import { t } from '../../../lib/i18n';
import { capsLabelClass } from '../../structure/ui';
import { mark, ordinal, type StudentAcademics } from './model';

/** The average, class position and subject count for the focus assessment. */
export function AcademicsStats({ academics }: { academics: StudentAcademics }) {
    const { focus, subjects, coefficients } = academics;

    return (
        <div className="flex flex-wrap border-y border-solid border-border">
            <div className="flex min-w-[170px] flex-1 flex-col gap-1 py-[14px] pr-4">
                <span className={capsLabelClass}>
                    {focus
                        ? t(':focus average', {
                              focus: focus.name,
                          })
                        : t('Average')}
                </span>
                <span className="flex items-baseline gap-2">
                    <span className="font-display text-[28px] leading-8 font-extrabold text-text">
                        {mark(focus?.average)}
                    </span>
                    <span className="font-mono text-[12px] leading-4 text-text-muted">
                        / 20
                        {focus && !focus.complete ? t(' · so far') : ''}
                    </span>
                </span>
            </div>
            <div className="flex min-w-[170px] flex-1 flex-col gap-1 border-l border-solid border-border px-4 py-[14px]">
                <span className={capsLabelClass}>{t('Position in class')}</span>
                <span className="flex items-baseline gap-2">
                    <span className="font-display text-[28px] leading-8 font-extrabold text-text">
                        {focus?.position ? ordinal(focus.position) : '—'}
                    </span>
                    <span className="font-mono text-[12px] leading-4 text-text-muted">
                        {focus?.position
                            ? t('of :of', { of: focus.of })
                            : focus
                              ? t('not ranked while a mark is missing')
                              : ''}
                    </span>
                </span>
            </div>
            <div className="flex min-w-[170px] flex-1 flex-col gap-1 border-l border-solid border-border py-[14px] pl-4">
                <span className={capsLabelClass}>{t('Subjects')}</span>
                <span className="flex items-baseline gap-2">
                    <span className="font-display text-[28px] leading-8 font-extrabold text-text">
                        {subjects.length}
                    </span>
                    <span className="font-mono text-[12px] leading-4 text-text-muted">
                        {t('coeff. total :coefficients', {
                            coefficients,
                        })}
                    </span>
                </span>
            </div>
        </div>
    );
}
