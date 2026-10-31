import { structure } from '@/actions/App/Http/Controllers/FeeStructureController';
import { edit } from '@/actions/App/Http/Controllers/StudentRegistrationController';
import { Head, Link } from '@inertiajs/react';
import { outlineButtonClass } from '../../components/structure/ui';
import {
    StudentHeader,
    StudentSteps,
    StudentTabs,
} from '../../components/students/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';
import { ExemptionCard } from '../../components/students/fees/exemption-card';
import { Installments } from '../../components/students/fees/installments';
import { InvoiceItems } from '../../components/students/fees/invoice-items';
import { InvoiceTotals } from '../../components/students/fees/invoice-totals';
import { InvoiceYears } from '../../components/students/fees/invoice-years';
import {
    linkClass,
    type StudentFeesProps,
} from '../../components/students/fees/model';
import { PayPanel } from '../../components/students/fees/pay-panel';
import { Payments } from '../../components/students/fees/payments';

function StudentFees(props: StudentFeesProps) {
    const {
        neighbours,
        currency,
        canManageFees,
        canManageStudents,
        student,
        invoices,
        invoice,
    } = props;

    return (
        <div className="flex flex-col gap-5 lg:min-h-[calc(100vh-56px)]">
            <Head title={t(':student · Fees', { student: student.name })} />
            <StudentHeader
                trail={[{ label: student.name }, { label: t('Fees') }]}
                title={student.name}
                tag={[student.matricule, student.class]
                    .filter(Boolean)
                    .join(' · ')}
                action={
                    canManageStudents && (
                        <Link
                            href={edit.url(student.id)}
                            className={outlineButtonClass}
                        >
                            {t('Edit student')}
                        </Link>
                    )
                }
            />
            <StudentTabs
                studentId={student.id}
                active="fees"
                overview={canManageStudents}
            />

            {!invoice ? (
                <div className="flex flex-col items-start gap-3 rounded-md bg-surface p-5">
                    <p className="text-[14px] leading-[18px] font-semibold text-text">
                        {t('Not billed yet')}
                    </p>
                    <p className="max-w-[560px] text-[13px] leading-[19px] text-text">
                        {student.name}{' '}
                        {t(
                            'has no invoice. Fees come from the Fee structure: set a fee for',
                        )}{' '}
                        {student.level ?? t('the level')}
                        {t(', then bill its students.')}
                    </p>
                    {canManageFees && (
                        <Link href={structure.url()} className={linkClass}>
                            {t('Open Fee structure →')}
                        </Link>
                    )}
                </div>
            ) : (
                <div className="flex flex-1 flex-col gap-8 lg:flex-row">
                    <div className="flex min-w-0 flex-1 flex-col gap-[22px]">
                        {invoices.length > 1 && (
                            <InvoiceYears props={props} invoice={invoice} />
                        )}
                        <InvoiceTotals props={props} invoice={invoice} />
                        {invoice.items.length > 1 && (
                            <InvoiceItems invoice={invoice} />
                        )}
                        <Installments invoice={invoice} />
                        <Payments props={props} invoice={invoice} />
                    </div>

                    <aside className="flex shrink-0 flex-col gap-5 border-solid border-border lg:w-[328px] lg:border-l lg:pl-8">
                        <PayPanel props={props} invoice={invoice} />

                        <ExemptionCard
                            key={`${invoice.id}-${invoice.exempted}`}
                            invoice={invoice}
                            currency={currency}
                            canManage={canManageFees}
                        />
                    </aside>
                </div>
            )}
            <StudentSteps
                active="fees"
                overview={canManageStudents}
                neighbours={neighbours}
            />
        </div>
    );
}

export default withAppShell(StudentFees);
