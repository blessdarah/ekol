import { Head } from '@inertiajs/react';

export default function Setup() {
    return (
        <>
            <Head title="School setup" />
            <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center p-6">
                <h1 className="mb-1 text-2xl font-semibold">School setup</h1>
                <p className="text-sm text-gray-500">
                    First-visit setup lands here (screen 08, separate
                    change).
                </p>
            </main>
        </>
    );
}
