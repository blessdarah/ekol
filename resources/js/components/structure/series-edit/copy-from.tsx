import { t } from '../../../lib/i18n';
import { SearchPicker } from '../ui';
import { type SeriesEditModel } from './model';

/** Start from another series' subjects. */
export function CopyFrom({ model }: { model: SeriesEditModel }) {
    const { copySources, copyFrom } = model;

    return (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border bg-white p-4">
            <p className="text-[13px] leading-4 font-semibold text-text">
                {t('Similar to another series?')}
            </p>
            <p className="text-[13px] leading-[18px] text-text-muted">
                {t('Copy eligible core subjects and electives, then adjust.')}
            </p>
            <SearchPicker
                label={t('Copy from a series')}
                placeholder={t('Copy from a series')}
                options={copySources.map((other) => ({
                    id: other.id,
                    name: other.label,
                }))}
                onSelect={copyFrom}
            />
        </div>
    );
}
