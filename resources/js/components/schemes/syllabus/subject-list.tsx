import { Link } from '@inertiajs/react';
import { show } from '@/actions/App/Http/Controllers/SyllabusController';
import { capsLabelClass } from '../../structure/ui';
import { t } from '../../../lib/i18n';
import { type SyllabusModel } from './model';

/** The subjects taught at the level, and how many topics each has. */
export function SubjectList({ syllabus }: { syllabus: SyllabusModel }) {
    const { level, subjects, subject, ready } = syllabus;

    return (
        <div className="flex shrink-0 flex-col gap-1 lg:w-[250px]">
            <span className={capsLabelClass}>
                {t(':level · :subjects subjects · :ready ready', {
                    level: level?.name ?? '',
                    subjects: subjects.length,
                    ready,
                })}
            </span>
            {subjects.length === 0 && (
                <p className="text-[13px] text-text-muted">
                    {t('No subject is taught at this level yet.')}
                </p>
            )}
            {subjects.map((option) => (
                <Link
                    key={option.id}
                    href={show.url({
                        query: {
                            level: level?.id ?? '',
                            subject: option.id,
                        },
                    })}
                    preserveScroll
                    className={`flex items-center justify-between rounded-md border border-solid px-3 py-2 text-[14px] ${
                        option.id === subject?.id
                            ? 'border-primary bg-primary-tint font-semibold text-primary'
                            : 'border-transparent text-text hover:bg-surface'
                    }`}
                >
                    <span className="truncate">{option.name}</span>
                    {option.topics > 0 ? (
                        <span className="shrink-0 font-mono text-[12px] text-text-muted">
                            {t(':count topics', {
                                count: option.topics,
                            })}
                        </span>
                    ) : (
                        <span className="flex shrink-0 items-center gap-1 text-[12px] text-warning-text">
                            <span className="h-[6px] w-[6px] rounded-full bg-warning" />
                            {t('Empty')}
                        </span>
                    )}
                </Link>
            ))}
        </div>
    );
}
