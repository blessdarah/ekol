import { Link } from '@inertiajs/react';
import { show } from '@/actions/App/Http/Controllers/TeacherSchemeController';
import { STATUS_DOTS } from '../ui';
import { capsLabelClass } from '../../structure/ui';
import { t } from '../../../lib/i18n';
import { type MySchemeModel } from './model';

/** The teacher's other schemes this term, to switch between. */
export function SchemeSwitch({ mine }: { mine: MySchemeModel }) {
    const { schemes, scheme } = mine;

    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className={capsLabelClass}>
                {t('My schemes · :count', { count: schemes.length })}
            </span>
            {schemes.map((option) => (
                <Link
                    key={option.id}
                    href={show.url({ query: { scheme: option.id } })}
                    preserveScroll
                    className={`flex h-8 items-center gap-2 rounded-full border border-solid px-3 text-[13px] ${
                        option.id === scheme.id
                            ? 'border-primary bg-primary-tint font-semibold text-primary'
                            : 'border-border text-text hover:bg-surface'
                    }`}
                >
                    <span
                        className={`h-[6px] w-[6px] rounded-full ${STATUS_DOTS[option.status] ?? 'bg-text-muted'}`}
                    />
                    {option.subject} · {option.class}
                </Link>
            ))}
        </div>
    );
}
