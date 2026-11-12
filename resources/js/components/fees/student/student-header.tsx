import { Link } from '@inertiajs/react';
import { index as feesIndex } from '@/actions/App/Http/Controllers/FeeController';
import { studentTab as feesTab } from '@/actions/App/Http/Controllers/StudentFeeController';
import Breadcrumbs from '../../shell/breadcrumbs';
import { outlineButtonClass, solidButtonClass } from '../../structure/ui';
import { t } from '../../../lib/i18n';
import { type StudentFeesModel } from './model';

/** The student, their guardian, and recording a payment. */
export function StudentHeader({ fees }: { fees: StudentFeesModel }) {
    const { student, invoice, setPaying, trail } = fees;

    return (
        <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-[6px]">
                <Breadcrumbs
                    trail={[
                        { label: t('Fees'), href: feesIndex.url() },
                        ...trail.slice(0, -1).map((label) => ({ label })),
                        { label: trail[trail.length - 1] ?? student.name },
                    ]}
                />
                <h1 className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text sm:text-[40px] sm:leading-[44px]">
                    {student.name}
                </h1>
                <p className="flex flex-wrap items-center gap-x-2 text-[13px] leading-4 text-text-muted">
                    <span className="font-mono">{student.matricule}</span>
                    <span>
                        {t('· Guardian: :guardian · :phone', {
                            guardian: student.guardian,
                            phone: student.phone,
                        })}
                    </span>
                </p>
            </div>
            <div className="flex flex-wrap gap-2">
                <Link
                    href={feesTab.url(student.id)}
                    className={outlineButtonClass}
                >
                    {t('Student record')}
                </Link>
                {invoice && invoice.balance > 0 && (
                    <button
                        type="button"
                        onClick={() => setPaying(true)}
                        className={solidButtonClass}
                    >
                        {t('Record payment')}
                    </button>
                )}
            </div>
        </div>
    );
}
