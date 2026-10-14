import { Head, Link } from '@inertiajs/react';
import { index } from '@/actions/App/Http/Controllers/AssessmentController';
import { show } from '@/actions/App/Http/Controllers/MarkSheetController';
import {
    Empty,
    STATE_LABELS,
    type PlanState,
    amberText,
    day,
} from '../../components/assessments/ui';
import Breadcrumbs from '../../components/shell/breadcrumbs';
import { capsLabelClass } from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface SheetsProps {
    canManage: boolean;
    sheets: {
        id: string;
        subject: string | null;
        class: string | null;
        plan: string | null;
        state: PlanState | null;
        open: boolean;
        closes_on: string | null;
        opens_on: string | null;
        entered: number;
        students: number;
        submitted: boolean;
    }[];
}

function Sheets({ canManage, sheets }: SheetsProps) {
    return (
        <div className="flex flex-col gap-5">
            <Head title={t('My mark sheets')} />
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-[6px]">
                    <Breadcrumbs trail={[{ label: t('Marks') }]} />
                    <h1 className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text sm:text-[40px] sm:leading-[44px]">
                        {t('My mark sheets')}
                    </h1>
                    <p className="text-[13px] leading-4 text-text-muted">
                        {t(
                            'One sheet per subject, class and assessment. Each is out of 20.',
                        )}
                    </p>
                </div>
                {canManage && (
                    <Link
                        href={index.url()}
                        className="text-[13px] leading-4 font-medium text-primary hover:underline"
                    >
                        {t('Sequences & Exams →')}
                    </Link>
                )}
            </div>

            {sheets.length === 0 ? (
                <Empty title={t('No mark sheets yet')}>
                    {t(
                        'A sheet appears here when an assessment is scheduled for a class you teach.',
                    )}
                </Empty>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-solid border-border">
                    <div className="flex min-w-[720px] flex-col">
                        <div
                            className={`flex h-[34px] items-center gap-4 border-b border-solid border-border bg-surface px-4 ${capsLabelClass}`}
                        >
                            <span className="flex-1">
                                {t('Subject and class')}
                            </span>
                            <span className="w-[150px] shrink-0">
                                {t('Assessment')}
                            </span>
                            <span className="w-[90px] shrink-0 text-right">
                                {t('Entered')}
                            </span>
                            <span className="w-[210px] shrink-0">
                                {t('Status')}
                            </span>
                            <span className="w-[60px] shrink-0" />
                        </div>
                        {sheets.map((sheet, position) => (
                            <Link
                                key={sheet.id}
                                href={show.url(sheet.id)}
                                className={`flex min-h-[52px] items-center gap-4 border-b border-solid border-border px-4 py-2 last:border-b-0 hover:bg-surface ${position % 2 === 1 ? 'bg-row-alt' : ''}`}
                            >
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate text-[14px] leading-[18px] font-medium text-text">
                                        {sheet.subject}
                                    </span>
                                    <span className="text-[12px] leading-4 text-text-muted">
                                        {sheet.class}
                                    </span>
                                </span>
                                <span className="w-[150px] shrink-0 truncate text-[13px] leading-4 text-text">
                                    {sheet.plan}
                                </span>
                                <span className="w-[90px] shrink-0 text-right font-mono text-[13px] leading-4 text-text">
                                    {sheet.entered} / {sheet.students}
                                </span>
                                <span className="flex w-[210px] shrink-0">
                                    {sheet.open ? (
                                        <span
                                            className={`flex h-6 items-center gap-[6px] rounded-full px-[10px] text-[12px] leading-4 font-medium ${sheet.submitted ? 'bg-success-tint text-success' : `bg-warning-tint ${amberText}`}`}
                                        >
                                            <span
                                                className={`h-[6px] w-[6px] shrink-0 rounded-full ${sheet.submitted ? 'bg-success' : 'bg-warning'}`}
                                            />
                                            {sheet.submitted
                                                ? t('Submitted')
                                                : t('To fill')}{' '}
                                            {t('· closes')}{' '}
                                            {day(sheet.closes_on)}
                                        </span>
                                    ) : (
                                        <span className="text-[13px] leading-4 text-text-muted">
                                            {sheet.state === 'scheduled'
                                                ? t('Opens :opens_on', {
                                                      opens_on: day(
                                                          sheet.opens_on,
                                                      ),
                                                  })
                                                : sheet.state
                                                  ? STATE_LABELS[sheet.state]
                                                  : ''}
                                        </span>
                                    )}
                                </span>
                                <span className="w-[60px] shrink-0 text-right text-[13px] leading-4 font-medium text-primary">
                                    {t('Open')}
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default withAppShell(Sheets);
