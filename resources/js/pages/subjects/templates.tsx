import { Head } from '@inertiajs/react';
import { StructureHeader, subjectsCrumb } from '../../components/structure/ui';
import { ChooseSet } from '../../components/subjects/templates/choose-set';
import { ClassesAndTeachers } from '../../components/subjects/templates/classes-and-teachers';
import {
    TITLES,
    type TemplatesProps,
    useTemplateWizard,
} from '../../components/subjects/templates/model';
import { ReviewAndCreate } from '../../components/subjects/templates/review';
import { WizardFooter } from '../../components/subjects/templates/wizard-footer';
import { WizardSteps } from '../../components/subjects/templates/wizard-steps';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

function Templates(props: TemplatesProps) {
    const wizard = useTemplateWizard(props);
    const { yearLabel, step, picked, set } = wizard;

    return (
        <div className="flex flex-col gap-7 lg:min-h-[calc(100vh-56px)]">
            <Head title={t(TITLES[step])} />
            <StructureHeader
                section="subjects"
                trail={[subjectsCrumb, { label: t('Templates') }]}
                title={t(TITLES[step])}
                tag={t('Subject setup:year_label', {
                    year_label: yearLabel ? ` · ${yearLabel}` : '',
                })}
                meta={
                    step === 0
                        ? t('create many subjects in one go')
                        : t(':picked subjects from :set', {
                              picked: picked.length,
                              set: set.name,
                          })
                }
            />
            <WizardSteps step={step} />

            {step === 0 && <ChooseSet wizard={wizard} />}
            {step === 1 && <ClassesAndTeachers wizard={wizard} />}
            {step === 2 && <ReviewAndCreate wizard={wizard} />}
            <WizardFooter wizard={wizard} />
        </div>
    );
}

export default withAppShell(Templates);
