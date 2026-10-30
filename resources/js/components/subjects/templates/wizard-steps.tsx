import { t } from '../../../lib/i18n';
import { STEPS } from './model';

/** The three steps, the current one marked. */
export function WizardSteps({ step }: { step: number }) {
    return (
        <ol className="flex flex-wrap items-center gap-3">
            {STEPS.map((label, position) => (
                <li key={label} className="flex items-center gap-3">
                    {position > 0 && (
                        <span
                            className={`h-px w-12 shrink-0 ${position <= step ? 'bg-primary' : 'bg-border'}`}
                        />
                    )}
                    <span className="flex items-center gap-2">
                        <span
                            className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] leading-4 font-semibold ${
                                position === step
                                    ? 'bg-primary text-white'
                                    : position < step
                                      ? 'bg-primary-tint'
                                      : 'border border-solid border-border bg-surface text-text-muted'
                            }`}
                        >
                            {position < step ? (
                                <svg width="12" height="12" viewBox="0 0 12 12">
                                    <path
                                        d="M2.6 6.2 4.9 8.5 9.4 3.9"
                                        fill="none"
                                        stroke="var(--color-primary)"
                                        strokeWidth="1.8"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            ) : (
                                position + 1
                            )}
                        </span>
                        <span
                            className={`text-[13px] leading-4 ${position <= step ? 'font-semibold text-text' : 'text-text-muted'}`}
                        >
                            {label}
                        </span>
                    </span>
                </li>
            ))}
            <li className="ml-auto text-[13px] leading-4 text-text-muted">
                {t('Step :step of :steps', {
                    step: step + 1,
                    steps: STEPS.length,
                })}
            </li>
        </ol>
    );
}
