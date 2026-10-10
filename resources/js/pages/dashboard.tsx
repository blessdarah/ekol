import { Head } from '@inertiajs/react';
import { withAppShell } from '../layouts/app-layout';

function Dashboard() {
    return (
        <>
            <Head title="Dashboard" />
            <div className="rounded-xl border border-solid border-border bg-white p-8">
                <p className="text-xs font-semibold tracking-[0.06em] text-text-muted uppercase">
                    Coming soon
                </p>
                <h1 className="font-display mt-2 text-[28px] leading-[1.2] font-bold text-text">
                    Dashboard
                </h1>
                <p className="mt-2 text-[14px] text-text-muted">
                    Arriving in the dashboard flow. Stats, overdue fees and
                    attention items land here.
                </p>
            </div>
        </>
    );
}

export default withAppShell(Dashboard);
