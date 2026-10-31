import { Head, Link } from '@inertiajs/react';
import { withAppShell } from '@/layouts/app-layout';
import { useT } from '@/lib/i18n';
import { index as fees } from '@/actions/App/Http/Controllers/FeeController';
import { student as studentFees } from '@/actions/App/Http/Controllers/FeePaymentController';
import { index as assessments } from '@/actions/App/Http/Controllers/AssessmentController';
import { index as timetable } from '@/actions/App/Http/Controllers/TimetableController';
import { index as staff } from '@/actions/App/Http/Controllers/StaffRosterController';
import {
    outlineButtonClass,
    solidButtonClass,
} from '@/components/structure/ui';

type Props = {
    date: string;
    schoolName: string;
    students: number;
    classes: number;
    teachers: number;
    collected: number;
    billed: number;
    percent: number;
    openAssessments: number;
    overdueCount: number;
    overdue: { id: string; name: string; admission: string; balance: number }[];
};
function SchoolDashboard(props: Props) {
    const t = useT();
    return (
        <div className="flex flex-col gap-7">
            <Head title={t('Dashboard')} />
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <p className="text-[13px] text-text-muted">{props.date}</p>
                    <h1 className="font-display text-[32px] leading-10 font-extrabold tracking-tight">
                        {props.schoolName}
                    </h1>
                </div>
                <div className="flex gap-2">
                    <Link href={staff()} className={outlineButtonClass}>
                        {t('Teachers & Staff')}
                    </Link>
                    <Link href={fees()} className={solidButtonClass}>
                        {t('Record payment')}
                    </Link>
                </div>
            </header>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {[
                    {
                        label: 'Students enrolled',
                        value: props.students.toLocaleString(),
                        sub: `${props.classes} ${t('classes')}`,
                    },
                    {
                        label: 'Teaching staff',
                        value: props.teachers.toLocaleString(),
                        sub: t('in this school'),
                    },
                    {
                        label: 'Fees collected',
                        value: `${props.percent}%`,
                        sub: `${Number(props.collected).toLocaleString()} / ${Number(props.billed).toLocaleString()} XAF`,
                    },
                    {
                        label: 'Open assessments',
                        value: props.openAssessments.toLocaleString(),
                        sub: t('accepting marks'),
                    },
                ].map((stat) => (
                    <div
                        key={stat.label}
                        className="flex flex-col gap-3 rounded-xl border border-border p-5"
                    >
                        <p className="text-[13px] text-text-muted">
                            {t(stat.label)}
                        </p>
                        <p className="font-display text-[32px] leading-9 font-extrabold">
                            {stat.value}
                        </p>
                        <p className="text-xs text-text-muted">{stat.sub}</p>
                    </div>
                ))}
            </div>
            <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
                <section className="overflow-hidden rounded-xl border border-border">
                    <div className="flex items-center justify-between border-b border-border px-5 py-4">
                        <h2 className="text-[16px] font-semibold">
                            {t('Outstanding fees')}
                        </h2>
                        <Link
                            href={fees()}
                            className="text-[13px] font-semibold text-primary"
                        >
                            {t('View all')} {props.overdueCount}
                        </Link>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-[13px]">
                            <thead className="bg-surface text-text-muted">
                                <tr>
                                    <th className="px-5 py-3 font-medium">
                                        {t('Student')}
                                    </th>
                                    <th className="px-5 py-3 text-right font-medium">
                                        {t('Balance')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {props.overdue.map((s) => (
                                    <tr
                                        key={s.id}
                                        className="border-t border-border"
                                    >
                                        <td className="px-5 py-4">
                                            <Link
                                                href={studentFees(s.id)}
                                                className="flex flex-col gap-1 font-semibold text-primary"
                                            >
                                                {s.name}
                                                <span className="font-mono text-xs font-normal text-text-muted">
                                                    {s.admission}
                                                </span>
                                            </Link>
                                        </td>
                                        <td className="px-5 py-4 text-right font-mono">
                                            {s.balance.toLocaleString()} XAF
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {props.overdue.length === 0 && (
                            <p className="p-8 text-center text-text-muted">
                                {t('No outstanding fees.')}
                            </p>
                        )}
                    </div>
                </section>
                <section className="flex flex-col gap-5 rounded-xl border border-border p-5">
                    <h2 className="text-[16px] font-semibold">
                        {t('Try these first')}
                    </h2>
                    {[
                        {
                            label: 'Record a fee payment and print the receipt',
                            href: fees(),
                        },
                        {
                            label: 'Enter marks and see a report card',
                            href: assessments(),
                        },
                        {
                            label: 'Build next week’s timetable',
                            href: timetable(),
                        },
                    ].map((item, i) => (
                        <Link
                            key={item.label}
                            href={item.href}
                            className="flex gap-3 border-t border-border pt-4 text-[14px] leading-5 text-primary"
                        >
                            <span className="font-mono text-text-muted">
                                0{i + 1}
                            </span>
                            {t(item.label)} →
                        </Link>
                    ))}
                </section>
            </div>
        </div>
    );
}
export default withAppShell(SchoolDashboard);
