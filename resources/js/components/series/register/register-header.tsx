import { index } from '@/actions/App/Http/Controllers/SeriesRegistrationController';
import { t } from '../../../lib/i18n';
import Breadcrumbs from '../../shell/breadcrumbs';
import { type RegisterOne } from './model';

/** The trail, and who is being registered. */
export function RegisterHeader({
    registration,
}: {
    registration: RegisterOne;
}) {
    const { level, student } = registration;

    return (
        <div className="flex flex-col gap-[6px]">
            <Breadcrumbs
                trail={[
                    {
                        label: t('Series Registration'),
                        href: index.url({ query: { level: level.id } }),
                    },
                    { label: t('Register one by one') },
                    { label: level.name },
                ]}
            />
            <h1 className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text sm:text-[40px] sm:leading-[44px]">
                {student ? student.name : t('Everyone is registered')}
            </h1>
            {student && (
                <p className="font-mono text-[13px] leading-4 text-text-muted">
                    {[student.matricule, student.class]
                        .filter(Boolean)
                        .join(' · ')}
                </p>
            )}
        </div>
    );
}
