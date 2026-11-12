import { t } from '../../../lib/i18n';

/** How saved, submitted and closed mark sheets differ. */
export function MarksNote() {
    return (
        <p className="flex items-start gap-2 pt-1 text-[13px] leading-[18px] text-text-muted">
            <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                className="mt-[2px] shrink-0"
            >
                <circle
                    cx="7"
                    cy="7"
                    r="5.5"
                    fill="none"
                    stroke="var(--color-text-muted)"
                    strokeWidth="1.5"
                />
                <path
                    d="M7 4.5V7.5"
                    fill="none"
                    stroke="var(--color-text-muted)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                />
                <circle
                    cx="7"
                    cy="9.6"
                    r="0.8"
                    fill="var(--color-text-muted)"
                />
            </svg>
            {t(
                'A sheet you save is a draft until you submit it. After the marks window closes, nobody can change a mark without the school reopening it.',
            )}
        </p>
    );
}
