import { Link } from '@inertiajs/react';
import { create } from '@/actions/App/Http/Controllers/StudentRegistrationController';
import { show as importPage } from '@/actions/App/Http/Controllers/StudentImportController';
import { t } from '../../../lib/i18n';
import {
    PlusIcon,
    outlineButtonClass,
    solidButtonClass,
} from '../../structure/ui';
import { StudentHeader, money } from '../ui';
import { type StudentRoster } from './model';

/** The year's enrolment, with importing and adding a student. */
export function RosterHeader({ roster }: { roster: StudentRoster }) {
    const { yearLabel, counts } = roster;

    return (
        <StudentHeader
            trail={[{ label: t('Roster') }]}
            title={t('Students')}
            tag={t('Enrolment:year_label', {
                year_label: yearLabel ? ` · ${yearLabel}` : '',
            })}
            meta={t(':total students · :classes classes', {
                total: money(counts.total),
                classes: counts.classes,
            })}
            action={
                <div className="flex gap-2">
                    <Link
                        href={importPage.url()}
                        className={`${outlineButtonClass} gap-2`}
                    >
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            className="shrink-0"
                        >
                            <path
                                d="M12 15V4M7 9l5-5 5 5M4 17v3h16v-3"
                                fill="none"
                                stroke="var(--color-text)"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                        {t('Import')}
                    </Link>
                    <Link href={create.url()} className={solidButtonClass}>
                        <PlusIcon />
                        {t('Add student')}
                    </Link>
                </div>
            }
        />
    );
}
