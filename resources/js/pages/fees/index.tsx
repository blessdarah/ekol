import { Head } from '@inertiajs/react';
import { BillingNotice } from '../../components/fees/overview/billing-notice';
import { FeeStats } from '../../components/fees/overview/fee-stats';
import { FeesExport } from '../../components/fees/overview/fees-export';
import { FeesToolbar } from '../../components/fees/overview/fees-toolbar';
import {
    type FeesProps,
    useFeesOverview,
} from '../../components/fees/overview/model';
import { StudentsTable } from '../../components/fees/overview/students-table';
import { FeesHeader } from '../../components/fees/ui';
import { TableFooter } from '../../components/table/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

function Fees(props: FeesProps) {
    const fees = useFeesOverview(props);
    const { yearLabel, hasPlans, counts, students, table, exporting } = fees;

    return (
        <div className="flex flex-col gap-5">
            <Head title={t('Fees')} />
            <FeesHeader
                active="students"
                title={t('Fees')}
                tag={yearLabel}
                meta={t(
                    'what each student was billed, has paid and still owes',
                )}
            />

            {!yearLabel ? (
                <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                    {t(
                        'Fees are billed for an academic year, and no year is active. Make one active in School Setup first.',
                    )}
                </p>
            ) : (
                <>
                    <FeeStats fees={fees} />

                    {(!hasPlans || counts.unbilled > 0) && (
                        <BillingNotice fees={fees} />
                    )}

                    <FeesToolbar fees={fees} />

                    <StudentsTable fees={fees} />

                    <TableFooter
                        paged={students}
                        onPage={table.page}
                        onPerPage={table.perPage}
                    />
                </>
            )}

            {exporting && <FeesExport fees={fees} />}
        </div>
    );
}

export default withAppShell(Fees);
