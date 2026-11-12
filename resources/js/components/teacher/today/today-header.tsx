import { Link } from '@inertiajs/react';
import { index as sheetsIndex } from '@/actions/App/Http/Controllers/MarkSheetController';
import { t } from '../../../lib/i18n';
import { monoCaps, type TodayModel } from './model';

/** The greeting, the day's summary and the main shortcuts. */
export function TodayHeader({ today }: { today: TodayModel }) {
    const { date, greeting, name, summary } = today;

    return (
        <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
                <p className={`${monoCaps} text-text-muted`}>
                    {t('Today · :date', { date })}
                </p>
                <h1 className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text sm:text-[40px] sm:leading-[44px]">
                    {greeting}, {name}
                </h1>
                <p className="text-[14px] leading-5 text-text-muted">
                    {summary}
                </p>
            </div>
            <div className="flex gap-3">
                <Link
                    href="/my-timetable"
                    className="flex h-9 items-center rounded-md border border-solid border-border px-[14px] text-[14px] leading-[18px] font-medium text-text hover:bg-surface"
                >
                    {t('My timetable')}
                </Link>
                <Link
                    href={sheetsIndex.url()}
                    className="flex h-9 items-center rounded-md bg-primary px-4 text-[14px] leading-[18px] font-medium text-white hover:bg-primary-hover"
                >
                    {t('Enter marks')}
                </Link>
            </div>
        </div>
    );
}
