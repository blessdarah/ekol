import { Head } from '@inertiajs/react';
import { StudentHeader } from '../../components/students/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';
import { CheckStep } from '../../components/students/import/check-step';
import { MatchStep } from '../../components/students/import/match-step';
import { type ImportProps } from '../../components/students/import/model';
import { Progress } from '../../components/students/import/progress';
import { UploadStep } from '../../components/students/import/upload-step';

function ImportStudents(props: ImportProps) {
    const stepIndex = { upload: 0, match: 1, check: 2 }[props.step];

    return (
        <div className="flex flex-col gap-6 lg:min-h-[calc(100vh-56px)]">
            <Head title={t('Import students')} />
            <StudentHeader
                trail={[{ label: t('Import') }]}
                title={t('Import students')}
                tag={t('Enrolment:year_label', {
                    year_label: props.yearLabel ? ` · ${props.yearLabel}` : '',
                })}
                meta={t('bring in a whole intake from a spreadsheet')}
            />
            <Progress step={stepIndex} />

            {props.step === 'upload' && <UploadStep hasYear={props.hasYear} />}
            {props.step === 'match' && props.file && (
                <MatchStep
                    fields={props.fields}
                    file={props.file}
                    sample={props.sample ?? []}
                    guess={props.guess ?? {}}
                />
            )}
            {props.step === 'check' && props.file && props.report && (
                <CheckStep
                    file={props.file}
                    mapping={props.mapping ?? []}
                    report={props.report}
                    nextMatricule={props.nextMatricule ?? ''}
                    hasYear={props.hasYear}
                />
            )}
        </div>
    );
}

export default withAppShell(ImportStudents);
