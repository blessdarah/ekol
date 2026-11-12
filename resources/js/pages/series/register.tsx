import { Head } from '@inertiajs/react';
import { EveryoneRegistered } from '../../components/series/register/everyone-registered';
import {
    type RegisterProps,
    useRegisterOne,
} from '../../components/series/register/model';
import { RegisterActions } from '../../components/series/register/register-actions';
import { RegisterHeader } from '../../components/series/register/register-header';
import { SeriesChoice } from '../../components/series/register/series-choice';
import { StudentList } from '../../components/series/register/student-list';
import { SubjectList } from '../../components/series/register/subject-list';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

function RegisterOne(props: RegisterProps) {
    const registration = useRegisterOne(props);
    const { student, chosen } = registration;

    return (
        <div className="flex flex-col lg:min-h-[calc(100vh-56px)] lg:flex-row">
            <Head title={student ? student.name : t('Register one by one')} />

            <StudentList registration={registration} />

            <div className="flex min-w-0 flex-1 flex-col gap-7 pt-7 lg:pt-0 lg:pl-10">
                <RegisterHeader registration={registration} />

                {!student ? (
                    <EveryoneRegistered registration={registration} />
                ) : (
                    <>
                        <SeriesChoice registration={registration} />
                        {chosen && <SubjectList registration={registration} />}
                        <RegisterActions registration={registration} />
                    </>
                )}
            </div>
        </div>
    );
}

export default withAppShell(RegisterOne);
