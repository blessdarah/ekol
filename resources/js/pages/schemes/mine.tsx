import { Head, Link } from '@inertiajs/react';
import { index as schemesIndex } from '@/actions/App/Http/Controllers/SchemeController';
import { solidButtonClass } from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';
import {
    type MineProps,
    type OpenScheme,
    useMyScheme,
} from '../../components/schemes/mine/model';
import { SchemeAside } from '../../components/schemes/mine/scheme-aside';
import { SchemeHeader } from '../../components/schemes/mine/scheme-header';
import { SchemeNotices } from '../../components/schemes/mine/scheme-notices';
import { SchemeSwitch } from '../../components/schemes/mine/scheme-switch';
import { WeekTable } from '../../components/schemes/mine/week-table';

/** The teacher's scheme for the term, once there is one to plan. */
function SchemePlanner(props: OpenScheme) {
    const mine = useMyScheme(props);

    return (
        <div className="flex flex-col gap-5">
            <Head title={t('Scheme of Work')} />
            <SchemeHeader mine={mine} />

            <SchemeSwitch mine={mine} />

            <SchemeNotices mine={mine} />

            <div className="flex flex-col gap-6 xl:flex-row">
                <WeekTable mine={mine} />

                <SchemeAside mine={mine} />
            </div>
        </div>
    );
}

function MyScheme(props: MineProps) {
    const { term, opening, scheme, toApprove } = props;

    if (!term || !opening || !scheme) {
        return (
            <div className="flex flex-col gap-4">
                <Head title={t('Scheme of Work')} />
                <h1 className="font-display text-[28px] leading-8 font-extrabold tracking-[-0.02em] text-text sm:text-[40px] sm:leading-[44px]">
                    {t('Scheme of Work')}
                </h1>
                <p className="rounded-md bg-surface p-4 text-[14px] text-text">
                    {!term
                        ? t('No term is running at the moment.')
                        : !opening
                          ? t(
                                'The school has not opened schemes for :term yet. You will find them here once it has.',
                                { term: t(term.label) },
                            )
                          : t(
                                'You have no class and subject to plan for this term.',
                            )}
                </p>
                {toApprove > 0 && (
                    <Link
                        href={schemesIndex.url({
                            query: { state: 'to_approve' },
                        })}
                        className={`${solidButtonClass} self-start`}
                    >
                        {t('Review :count schemes waiting for you →', {
                            count: toApprove,
                        })}
                    </Link>
                )}
            </div>
        );
    }

    return (
        <SchemePlanner
            {...props}
            term={term}
            opening={opening}
            scheme={scheme}
        />
    );
}

export default withAppShell(MyScheme);
