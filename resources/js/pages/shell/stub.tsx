import { Head, Link } from '@inertiajs/react';
import { withAppShell } from '../../layouts/app-layout';

function ShellStub({ section, flow }: { section: string; flow: string }) {
    return (
        <>
            <Head title={section} />
            <div className="rounded-xl border border-solid border-border bg-white p-8">
                <p className="text-xs font-semibold tracking-[0.06em] text-text-muted uppercase">
                    Coming soon
                </p>
                <h1 className="font-display mt-2 text-[28px] leading-[1.2] font-bold text-text">
                    {section}
                </h1>
                <p className="mt-2 text-[14px] text-text-muted">
                    Arriving in the {flow}. This page holds its place in
                    the sidebar until then.
                </p>
                <Link
                    href="/dashboard"
                    className="mt-6 inline-flex h-9 items-center rounded-lg border border-solid border-border px-4 text-[14px] font-medium text-text"
                >
                    Back to dashboard
                </Link>
            </div>
        </>
    );
}

export default withAppShell(ShellStub);
