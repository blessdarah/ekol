import { Head, Link } from '@inertiajs/react';
import { opening } from '@/actions/App/Http/Controllers/SchemeOpeningController';
import { SchemesHeader, StepBar } from '../../components/schemes/ui';
import { solidButtonClass } from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';
import { LevelSwitch } from '../../components/schemes/syllabus/level-switch';
import {
    type SyllabusProps,
    useSyllabus,
} from '../../components/schemes/syllabus/model';
import { SubjectList } from '../../components/schemes/syllabus/subject-list';
import { TopicTable } from '../../components/schemes/syllabus/topic-table';

function Syllabus(props: SyllabusProps) {
    const syllabus = useSyllabus(props);
    const { steps, levels, level, subject } = syllabus;

    return (
        <div className="flex flex-col gap-7">
            <Head title={t('Syllabus')} />
            <SchemesHeader
                trail={[{ label: t('Syllabus') }]}
                tag={t('Schemes:term_label', {
                    term_label: steps.term ? ` · ${t(steps.term.label)}` : '',
                })}
                title={t('Syllabus')}
                sub={t(
                    'The topics each subject must cover at each level. Every teacher’s scheme starts from this list, and it is kept for next year.',
                )}
                action={
                    <Link href={opening.url()} className={solidButtonClass}>
                        {t('Next: open schemes →')}
                    </Link>
                }
            />
            <StepBar steps={steps} active="syllabus" />

            {levels.length === 0 ? (
                <p className="rounded-md bg-surface p-4 text-[13px] text-text">
                    {t(
                        'No level has classes this year yet. Add classes under Levels first.',
                    )}
                </p>
            ) : (
                <>
                    <LevelSwitch syllabus={syllabus} />
                    <div className="flex flex-col gap-6 lg:flex-row">
                        <SubjectList syllabus={syllabus} />
                        {subject && level && (
                            <TopicTable
                                syllabus={syllabus}
                                level={level}
                                subject={subject}
                            />
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export default withAppShell(Syllabus);
