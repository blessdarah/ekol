import { Link } from '@inertiajs/react';
import { structure } from '@/actions/App/Http/Controllers/FeeStructureController';
import { t } from '../../../lib/i18n';
import { type StudentFeesModel } from './model';

/** What to do when the student has no invoice yet. */
export function NotBilled({ fees }: { fees: StudentFeesModel }) {
    const { student } = fees;

    return (
        <div className="flex flex-col items-start gap-3 rounded-md bg-surface p-5">
            <p className="text-[14px] leading-[18px] font-semibold text-text">
                {t('Not billed yet')}
            </p>
            <p className="max-w-[560px] text-[13px] leading-[19px] text-text">
                {student.name} {t('has no invoice. Set a fee for')}{' '}
                {student.level ?? t('the level')}{' '}
                {t('and bill its students under Fee structure.')}
            </p>
            <Link
                href={structure.url()}
                className="text-[13px] leading-4 font-medium text-primary hover:underline"
            >
                {t('Open Fee structure →')}
            </Link>
        </div>
    );
}
