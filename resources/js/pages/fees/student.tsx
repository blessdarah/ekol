import { Head } from '@inertiajs/react';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';
import { BalanceSummary } from '../../components/fees/student/balance-summary';
import { BillItems } from '../../components/fees/student/bill-items';
import { Installments } from '../../components/fees/student/installments';
import {
    type StudentFeesProps,
    useStudentFees,
} from '../../components/fees/student/model';
import { NotBilled } from '../../components/fees/student/not-billed';
import { PaymentDrawer } from '../../components/fees/student/payment-drawer';
import { PaymentHistory } from '../../components/fees/student/payment-history';
import { StudentHeader } from '../../components/fees/student/student-header';
import { YearSwitch } from '../../components/fees/student/year-switch';

function StudentFees(props: StudentFeesProps) {
    const fees = useStudentFees(props);
    const {
        currency,
        student,
        invoices,
        invoice,
        today,
        methods,
        paying,
        setPaying,
    } = fees;

    return (
        <div className="flex flex-col gap-7">
            <Head title={t(':student · Fees', { student: student.name })} />
            <StudentHeader fees={fees} />

            {!invoice ? (
                <NotBilled fees={fees} />
            ) : (
                <>
                    {invoices.length > 1 && (
                        <YearSwitch fees={fees} invoice={invoice} />
                    )}

                    <BalanceSummary fees={fees} invoice={invoice} />

                    <Installments fees={fees} invoice={invoice} />

                    {invoice.items.length > 1 && (
                        <BillItems invoice={invoice} />
                    )}

                    <PaymentHistory invoice={invoice} />

                    {paying && invoice.balance > 0 && (
                        <PaymentDrawer
                            invoice={invoice}
                            studentId={student.id}
                            currency={currency}
                            today={today}
                            methods={methods}
                            onClose={() => setPaying(false)}
                        />
                    )}
                </>
            )}
        </div>
    );
}

export default withAppShell(StudentFees);
