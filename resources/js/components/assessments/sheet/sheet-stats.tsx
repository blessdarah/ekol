import { t } from '../../../lib/i18n';
import { capsLabelClass } from '../../structure/ui';
import type { MarkSheetModel } from './model';

/** The pass mark, how many marks are in, and how the class did. */
export function SheetStats({ model }: { model: MarkSheetModel }) {
    const { passMark, sheet, rows, empty, scores, average, passed } = model;

    return (
        <div className="flex flex-wrap items-center gap-x-10 gap-y-3">
            <div className="flex h-[46px] items-center gap-3 rounded-md bg-surface px-[14px]">
                <span className="text-[13px] leading-4 font-medium text-text">
                    {t('Pass mark')}
                </span>
                <span className="font-mono text-[14px] leading-[18px] text-text">
                    {passMark}{' '}
                    <span className="text-text-muted">/ {sheet.max}</span>
                </span>
            </div>
            {[
                {
                    label: t('Entered'),
                    value: `${rows.length - empty} / ${rows.length}`,
                    tone: 'text-text',
                },
                {
                    label: t('Class average'),
                    value: average === null ? '—' : average.toFixed(2),
                    tone: 'text-text',
                },
                {
                    label: t('Passed'),
                    value:
                        scores.length > 0
                            ? `${passed} · ${Math.round((passed / scores.length) * 100)}%`
                            : '—',
                    tone: 'text-success',
                },
                {
                    label: t('Below pass'),
                    value: String(scores.length - passed),
                    tone:
                        scores.length - passed > 0
                            ? 'text-danger'
                            : 'text-text',
                },
            ].map((stat) => (
                <div key={stat.label} className="flex flex-col gap-[2px]">
                    <span className={capsLabelClass}>{t(stat.label)}</span>
                    <span
                        className={`font-mono text-[16px] leading-5 ${stat.tone}`}
                    >
                        {stat.value}
                    </span>
                </div>
            ))}
        </div>
    );
}
