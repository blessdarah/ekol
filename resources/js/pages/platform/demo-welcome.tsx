import { Form, Head } from '@inertiajs/react';
import { solidButtonClass } from '@/components/structure/ui';
import { useT } from '@/lib/i18n';

export default function DemoWelcome({
    name,
    expires,
    openUrl,
}: {
    name: string;
    expires: string;
    openUrl: string;
}) {
    const t = useT();
    return (
        <main className="min-h-screen bg-white font-auth text-text">
            <Head title={t('Your demo school')} />
            <header className="border-b border-border px-6 py-5 font-display text-xl font-bold text-primary">
                Campus
            </header>
            <section className="mx-auto flex max-w-[540px] flex-col gap-6 px-6 py-10 sm:py-16">
                <p className="text-xs font-semibold text-science">
                    {t('Demo school')} · {t('Open until')} {expires}
                </p>
                <h1 className="font-display text-[32px] leading-9 font-extrabold tracking-tight">
                    {t('Your demo of :school is ready', { school: name })}
                </h1>
                <p className="text-[14px] leading-[21px] text-text-muted">
                    {t(
                        'It is filled with sample students, classes, fees and marks, so you can try everything as the principal. Nothing you do here is real.',
                    )}
                </p>
                <ol className="flex flex-col gap-5 border-y border-border py-6">
                    {[
                        'Record a fee payment and print the receipt',
                        'Enter marks and see a report card',
                        'Build next week’s timetable',
                    ].map((label, i) => (
                        <li
                            key={label}
                            className="flex gap-4 text-[14px] leading-5"
                        >
                            <span className="font-mono text-primary">
                                0{i + 1}
                            </span>
                            {t(label)}
                        </li>
                    ))}
                </ol>
                <Form action={openUrl} method="post">
                    {({ processing }) => (
                        <button
                            disabled={processing}
                            className={`${solidButtonClass} h-11 w-full`}
                        >
                            {t('Open my demo school')}
                        </button>
                    )}
                </Form>
                <p className="text-xs leading-[18px] text-text-muted">
                    {t(
                        'This private link signs you in. Keep it to return to your demo before it closes.',
                    )}
                </p>
            </section>
        </main>
    );
}
