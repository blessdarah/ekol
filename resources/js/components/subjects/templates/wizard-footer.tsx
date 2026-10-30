import { index } from '@/actions/App/Http/Controllers/SubjectController';
import { Link } from '@inertiajs/react';
import { t } from '../../../lib/i18n';
import {
    ErrorText,
    outlineButtonClass,
    solidButtonClass,
} from '../../structure/ui';
import { type TemplateWizard } from './model';

/** Back and next, and what is still missing before the next step. */
export function WizardFooter({ wizard }: { wizard: TemplateWizard }) {
    const {
        step,
        setStep,
        error,
        creating,
        picked,
        ready,
        startPlans,
        createAll,
    } = wizard;

    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
                <p className="text-[13px] leading-4 text-text-muted">
                    {step === 0 &&
                        t(
                            'Subjects you already have are left alone. Next, choose classes and teachers.',
                        )}
                    {step === 1 &&
                        t(
                            ':ready of :picked subjects are fully staffed. The rest are saved as drafts.',
                            { ready: ready.length, picked: picked.length },
                        )}
                    {step === 2 &&
                        t(
                            'You can edit any subject afterwards from the roster.',
                        )}
                </p>
                <ErrorText message={error} />
            </div>
            <div className="flex gap-2">
                {step === 0 ? (
                    <Link href={index.url()} className={outlineButtonClass}>
                        {t('Cancel')}
                    </Link>
                ) : (
                    <button
                        type="button"
                        onClick={() => setStep(step - 1)}
                        className={outlineButtonClass}
                    >
                        {t('Back')}
                    </button>
                )}
                {step === 0 && (
                    <button
                        type="button"
                        disabled={picked.length === 0}
                        onClick={startPlans}
                        className={solidButtonClass}
                    >
                        {t('Continue with :picked subjects', {
                            picked: picked.length,
                        })}
                    </button>
                )}
                {step === 1 && (
                    <button
                        type="button"
                        onClick={() => setStep(2)}
                        className={solidButtonClass}
                    >
                        {t('Continue to review')}
                    </button>
                )}
                {step === 2 && (
                    <button
                        type="button"
                        disabled={creating}
                        onClick={createAll}
                        className={solidButtonClass}
                    >
                        {t('Create :picked subjects', {
                            picked: picked.length,
                        })}
                    </button>
                )}
            </div>
        </div>
    );
}
