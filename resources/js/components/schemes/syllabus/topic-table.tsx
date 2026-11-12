import { capsLabelClass } from '../../structure/ui';
import { t } from '../../../lib/i18n';
import { type SyllabusModel } from './model';
import { TopicEditor } from './topic-editor';
import { TopicRow } from './topic-row';

/** The topics of the subject at the level, in the order they are taught. */
export function TopicTable({
    syllabus,
    level,
    subject,
}: {
    syllabus: SyllabusModel;
    level: NonNullable<SyllabusModel['level']>;
    subject: NonNullable<SyllabusModel['subject']>;
}) {
    const { topics, editing, setEditing, blank } = syllabus;

    return (
        <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-[22px] leading-7 font-bold text-text">
                    {subject.name} · {level.name}
                </h2>
                <button
                    type="button"
                    onClick={() => setEditing('new')}
                    className="text-[13px] font-medium text-primary hover:underline"
                >
                    {t('+ Add a topic')}
                </button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-solid border-border">
                <div className="flex min-w-[620px] flex-col">
                    <div
                        className={`flex h-9 items-center gap-4 border-b border-solid border-border bg-surface px-4 ${capsLabelClass}`}
                    >
                        <span className="w-6 shrink-0">#</span>
                        <span className="flex-1">{t('Topic')}</span>
                        <span className="w-[70px] shrink-0">{t('Term')}</span>
                        <span className="w-[70px] shrink-0">{t('Weeks')}</span>
                        <span className="w-[60px] shrink-0 text-right">
                            {t('Periods')}
                        </span>
                        <span className="w-[54px] shrink-0" />
                    </div>
                    {topics.length === 0 && editing !== 'new' && (
                        <p className="px-4 py-4 text-[13px] text-text-muted">
                            {t(
                                'No topics yet. Add the first one, in the order they are taught.',
                            )}
                        </p>
                    )}
                    {topics.map((topic, index) =>
                        editing === topic.id ? (
                            <TopicEditor
                                key={topic.id}
                                initial={topic}
                                levelId={level.id}
                                subjectId={subject.id}
                                onDone={() => setEditing(null)}
                            />
                        ) : (
                            <TopicRow
                                key={topic.id}
                                syllabus={syllabus}
                                topic={topic}
                                index={index}
                            />
                        ),
                    )}
                    {editing === 'new' && (
                        <TopicEditor
                            initial={blank}
                            levelId={level.id}
                            subjectId={subject.id}
                            onDone={() => setEditing(null)}
                        />
                    )}
                </div>
            </div>
            <p className="text-[13px] leading-[19px] text-text-muted">
                {t(
                    'Weeks are a suggestion. Teachers move topics when they write their scheme. Weeks with tests or exams on the Sequences & Exams calendar are kept free of new topics.',
                )}
            </p>
        </div>
    );
}
