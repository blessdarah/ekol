import { Head, Link, router } from '@inertiajs/react';
import { checks, generator } from '@/actions/App/Http/Controllers/TimetableController';
import {
    TimetableHeader,
    type TimetablePhase,
    amberText,
    linkClass,
    primaryActionClass,
    quietActionClass,
} from '../../components/timetable/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface Item {
    title: string;
    detail: string | null;
    action: { label: string; href: string } | null;
}

interface ChecksProps {
    phase: TimetablePhase;
    inputs: { blocking: Item[]; warnings: Item[]; passed: string[] };
}

function List({ items, dot }: { items: Item[]; dot: string }) {
    return (
        <ul className="flex flex-col overflow-clip rounded-lg border border-solid border-border">
            {items.map((item, position) => (
                <li
                    key={`${item.title}-${position}`}
                    className={`flex min-h-[46px] items-center gap-3 border-b border-solid border-border px-4 py-[10px] last:border-b-0 ${position % 2 === 1 ? 'bg-row-alt' : ''}`}
                >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                    <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-[14px] leading-[18px] font-medium text-text">{t(item.title)}</span>
                        {item.detail && <span className="text-[12px] leading-4 text-text-muted">{item.detail}</span>}
                    </span>
                    {item.action && (
                        <Link href={item.action.href} className={`shrink-0 ${linkClass}`}>
                            {t(item.action.label)} →
                        </Link>
                    )}
                </li>
            ))}
        </ul>
    );
}

function Checks({ phase, inputs }: ChecksProps) {
    const blocked = inputs.blocking.length > 0;
    const stats = [
        { label: t('Must be fixed'), value: inputs.blocking.length, tone: blocked ? 'text-danger' : 'text-text' },
        { label: t('Warnings'), value: inputs.warnings.length, tone: inputs.warnings.length > 0 ? amberText : 'text-text' },
        { label: t('Passed'), value: inputs.passed.length, tone: 'text-success' },
    ];

    return (
        <div className="flex flex-col gap-5">
            <Head title={t('Check inputs')} />
            <TimetableHeader
                page="checks"
                phase={phase}
                trail={[{ label: t('Check inputs') }]}
                title={t('Check inputs')}
                meta={t('Is everything the generator needs in place for draft version :draft?', { draft: phase.draft })}
                action={
                    <>
                        <button
                            type="button"
                            onClick={() => router.get(checks.url(), {}, { preserveScroll: true })}
                            className={quietActionClass}
                        >
                            {t('Check again')}
                        </button>
                        <Link
                            href={generator.url()}
                            aria-disabled={blocked}
                            tabIndex={blocked ? -1 : undefined}
                            className={primaryActionClass}
                        >
                            {t('Next: generate →')}
                        </Link>
                    </>
                }
            />

            <div className="flex flex-wrap border-y border-solid border-border">
                {stats.map((stat, position) => (
                    <div
                        key={stat.label}
                        className={`flex min-w-[140px] flex-1 flex-col gap-[2px] py-[10px] ${position === 0 ? 'pr-4' : 'border-l border-solid border-border px-4'}`}
                    >
                        <span className="text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase">{t(stat.label)}</span>
                        <span className={`font-display text-[24px] leading-7 font-extrabold ${stat.tone}`}>{stat.value}</span>
                    </div>
                ))}
            </div>

            {blocked && (
                <section className="flex flex-col gap-[10px]">
                    <p className="text-[12px] leading-4 font-semibold tracking-[0.06em] text-danger uppercase">
                        {t('Must be fixed before generating')}
                    </p>
                    <List items={inputs.blocking} dot="bg-danger" />
                </section>
            )}

            {inputs.warnings.length > 0 && (
                <section className="flex flex-col gap-[10px]">
                    <p className={`text-[12px] leading-4 font-semibold tracking-[0.06em] uppercase ${amberText}`}>
                        {t('Warnings. You can generate anyway')}
                    </p>
                    <List items={inputs.warnings} dot="bg-warning" />
                </section>
            )}

            <section className="flex flex-col gap-[10px]">
                <p className="text-[12px] leading-4 font-semibold tracking-[0.06em] text-success uppercase">
                    {t('Passed · :passed', { passed: inputs.passed.length })}
                </p>
                <p className="max-w-[900px] text-[13px] leading-5 text-text-muted">
                    {inputs.passed.length > 0 ? inputs.passed.join(' · ') : t('Nothing has passed yet.')}
                </p>
            </section>
        </div>
    );
}

export default withAppShell(Checks);
