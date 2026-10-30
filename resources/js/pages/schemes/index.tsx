import { Head, Link } from '@inertiajs/react';
import {
    exportMethod,
    index,
} from '@/actions/App/Http/Controllers/SchemeController';
import { dayMonth } from '../../components/fees/ui';
import { SchemesHeader } from '../../components/schemes/ui';
import { StructureTabs, solidButtonClass } from '../../components/structure/ui';
import { ExportDialog, toQuery } from '../../components/table/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';
import {
    type IndexProps,
    useSchemesProgress,
} from '../../components/schemes/progress/model';
import { SchemeOverview } from '../../components/schemes/progress/scheme-overview';
import { SchemeTable } from '../../components/schemes/progress/scheme-table';
import { SchemeDrawer } from '../../components/schemes/progress/scheme-drawer';
function SchemesIndex(props: IndexProps) {
    const model = useSchemesProgress(props);
    const {
        steps,
        dueOn,
        canManage,
        totals,
        paged,
        picked,
        exporting,
        setExporting,
        sort,
        values,
        selection,
    } = model;
    return (
        <div className="flex flex-col gap-7">
            <Head title={t('Schemes of work')} />
            <SchemesHeader
                title={t('Schemes of work')}
                tag={t('Schemes:term_label', {
                    term_label: steps.term ? ` · ${t(steps.term.label)}` : '',
                })}
                meta={t(':count schemes · due :due', {
                    count: totals.all,
                    due: dayMonth(dueOn, false),
                })}
                action={
                    totals.to_approve > 0 ? (
                        <Link
                            href={index.url({
                                query: { state: 'to_approve' },
                            })}
                            className={solidButtonClass}
                        >
                            {t('Approve :count waiting →', {
                                count: totals.to_approve,
                            })}
                        </Link>
                    ) : undefined
                }
            />
            {canManage && <StructureTabs active="schemes" />}

            <SchemeOverview {...model} />

            <SchemeTable {...model} />

            {picked && <SchemeDrawer {...model} picked={picked} />}

            {exporting && (
                <ExportDialog
                    title={t('Export schemes')}
                    subtitle={t(':year · as filtered on screen', {
                        year: t(steps.term?.label ?? 'Schemes of work'),
                    })}
                    noun={t('schemes')}
                    matching={paged.total}
                    selected={selection.allMatching ? 'all' : selection.ids}
                    everyone={totals.all}
                    columns={[
                        { key: 'subject', label: t('Subject'), on: true },
                        { key: 'class', label: t('Class'), on: true },
                        {
                            key: 'department',
                            label: t('Department'),
                            on: false,
                        },
                        { key: 'teacher', label: t('Teacher'), on: true },
                        { key: 'state', label: t('Status'), on: true },
                        { key: 'taught', label: t('Taught so far'), on: true },
                        {
                            key: 'planned',
                            label: t('Planned so far'),
                            on: true,
                        },
                        { key: 'topics', label: t('Sub-topics'), on: false },
                        { key: 'coverage', label: t('Coverage %'), on: false },
                    ]}
                    href={({ scope, format, columns }) =>
                        exportMethod.url({
                            query: toQuery(scope === 'everyone' ? {} : values, {
                                sort,
                                format:
                                    format === 'print' ? 'print' : undefined,
                                columns: columns.join(','),
                                ids:
                                    scope === 'selected' &&
                                    !selection.allMatching
                                        ? selection.ids.join(',')
                                        : undefined,
                            }),
                        })
                    }
                    onClose={() => setExporting(false)}
                />
            )}
        </div>
    );
}
export default withAppShell(SchemesIndex);
