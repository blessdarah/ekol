import { showSchoolStep } from '@/actions/App/Http/Controllers/Auth/RegistrationController';
import { Link } from '@inertiajs/react';
import { t } from '../../lib/i18n';
import { type DemoFormModel } from './model';

/** The thanks once a demo is booked, with what happens next. */
export function DemoThanks({
    demo,
    demoBooking,
}: {
    demo: DemoFormModel;
    demoBooking: NonNullable<DemoFormModel['demoBooking']>;
}) {
    const { form, setEditing } = demo;

    return (
        <section
            id="demo"
            className="flex w-full shrink-0 scroll-mt-24 flex-col gap-5 rounded-[18px] border border-solid border-brand-border bg-brand-raised p-6 sm:p-8 lg:w-[460px]"
        >
            <h2 className="text-[22px] font-bold text-primary-soft">
                {t('Thank you')}
                {demoBooking.contact_name
                    ? `, ${demoBooking.contact_name.split(' ')[0]}`
                    : ''}
            </h2>
            <p className="text-[14px] leading-5 text-primary-muted">
                {t('Your demo request for :school is in.', {
                    school: demoBooking.school_name,
                })}
            </p>
            <ol className="flex flex-col gap-5 text-[14px] leading-5">
                <li>
                    {t('Request received')}
                    <p className="text-primary-muted">{demoBooking.whatsapp}</p>
                </li>
                <li>
                    {t(
                        'We message you on WhatsApp within one working day to arrange a 20-minute call.',
                    )}
                </li>
                <li>
                    {t(
                        'After the call, you get your own demo school to try for 14 days.',
                    )}
                </li>
            </ol>
            <button
                type="button"
                onClick={() => {
                    form.setData({
                        ...form.data,
                        contact_name: demoBooking.contact_name ?? '',
                        school_name: demoBooking.school_name,
                        whatsapp: demoBooking.whatsapp.replace(/^\+237/, ''),
                    });
                    setEditing(true);
                }}
                className="text-left text-[13px] text-primary-muted underline"
            >
                {t('Wrong number? Change it')}
            </button>
            <Link
                href={showSchoolStep()}
                className="text-[13px] text-primary-muted underline"
            >
                {t('Start your free term')}
            </Link>
        </section>
    );
}
