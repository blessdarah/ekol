import { Head, Link } from '@inertiajs/react';

export default function Dashboard() {
    return (
        <>
            <Head title="Dashboard" />
            <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center p-6">
                <h1 className="mb-1 text-2xl font-semibold">Dashboard</h1>
                <p className="text-sm text-gray-500">
                    Admin dashboard lands here (screen 01, separate change).
                </p>
                <Link
                    href="/logout"
                    method="post"
                    as="button"
                    className="mt-4 text-sm underline"
                >
                    Sign out
                </Link>
            </main>
        </>
    );
}
