import { Head, router } from '@inertiajs/react';
import { show as dashboard } from '@/actions/App/Http/Controllers/DashboardController';
import { AttendanceAndResults } from '../components/dashboard/attendance-and-results';
import { DashboardHeader } from '../components/dashboard/dashboard-header';
import { FeesAndAttention } from '../components/dashboard/fees-and-attention';
import { DashboardHeadlines } from '../components/dashboard/headlines';
import { LevelsAndAdmissions } from '../components/dashboard/levels-and-admissions';
import type { DashboardProps } from '../components/dashboard/model';
import { withAppShell } from '../layouts/app-layout';
import { t } from '../lib/i18n';

function Dashboard(props: DashboardProps) {
    if (!props.counts || !props.attendance) {
        return (
            <>
                <Head title={t('Dashboard')} />
                <div className="rounded-xl border border-solid border-border bg-white p-8">
                    <h1 className="font-display text-[28px] leading-[1.2] font-bold text-text">
                        {t('Dashboard')}
                    </h1>
                </div>
            </>
        );
    }

    function switchRange(next: 'term' | 'year') {
        router.get(
            dashboard.url({ query: next === 'year' ? { range: 'year' } : {} }),
            {},
            {
                only: ['range', 'fees', 'attendance'],
                preserveScroll: true,
                preserveState: true,
                replace: true,
            },
        );
    }

    return (
        <div className="flex flex-col">
            <Head title={t('Dashboard')} />
            <DashboardHeader
                props={props}
                hasRanges={
                    Boolean(props.fees) || props.attendance.series.length > 0
                }
                onRange={switchRange}
            />
            <DashboardHeadlines props={props} />
            <FeesAndAttention props={props} />
            <AttendanceAndResults props={props} />
            <LevelsAndAdmissions props={props} />
        </div>
    );
}

export default withAppShell(Dashboard);
