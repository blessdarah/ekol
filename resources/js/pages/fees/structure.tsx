import { Head } from '@inertiajs/react';
import { FeesHeader } from '../../components/fees/ui';
import {
    outlineButtonClass,
    solidButtonClass,
} from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';
import { AmountsByLevel } from '../../components/fees/structure/amounts-by-level';
import { FeeItems } from '../../components/fees/structure/fee-items';
import { FeesAside } from '../../components/fees/structure/fees-aside';
import {
    draft,
    type OpenYear,
    type StructureProps,
    useFeeStructure,
} from '../../components/fees/structure/model';
import { YearSwitch } from '../../components/fees/structure/year-switch';

/** The fee editor for an open year. */
function StructureEditor(props: StructureProps & { year: OpenYear }) {
    const fees = useFeeStructure(props);
    const {
        year,
        years,
        previousItems,
        previousLabel,
        dirty,
        form,
        save,
        setItems,
    } = fees;

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                save();
            }}
            className="flex flex-col gap-5 lg:min-h-[calc(100vh-56px)]"
        >
            <Head title={t('Fee structure')} />
            <FeesHeader
                active="structure"
                trail={[{ label: t('Fee structure') }]}
                title={t('Fee structure')}
                tag={t(year.label)}
                meta={t(
                    'what the school charges for the year, level by level, and who is billed',
                )}
                action={
                    <div className="flex flex-wrap gap-2">
                        {previousItems.length > 0 && (
                            <button
                                type="button"
                                onClick={() =>
                                    setItems(
                                        previousItems.map((item) =>
                                            draft(item, false),
                                        ),
                                    )
                                }
                                className={outlineButtonClass}
                            >
                                {t('Copy :previous_label fees', {
                                    previous_label: previousLabel,
                                })}
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={!dirty || form.processing}
                            className={solidButtonClass}
                        >
                            {t('Save fees')}
                        </button>
                    </div>
                }
            />

            {years.length > 1 && <YearSwitch fees={fees} />}

            <div className="flex flex-1 flex-col gap-7 lg:flex-row">
                <div className="flex min-w-0 flex-1 flex-col gap-7">
                    <FeeItems fees={fees} />
                    <AmountsByLevel fees={fees} />
                </div>

                <aside className="flex shrink-0 flex-col gap-4 border-solid border-border lg:w-[320px] lg:border-l lg:pl-7">
                    <FeesAside fees={fees} />
                </aside>
            </div>
        </form>
    );
}

/** Remount on what the server holds, so a save resets the draft to it. */
function Structure(props: StructureProps) {
    const { year } = props;

    if (!year) {
        return (
            <div className="flex flex-col gap-5">
                <Head title={t('Fee structure')} />
                <FeesHeader
                    active="structure"
                    trail={[{ label: t('Fee structure') }]}
                    title={t('Fee structure')}
                />
                <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                    {t(
                        'Fees are set for an academic year, and the school has none open. Add a year in School Setup first.',
                    )}
                </p>
            </div>
        );
    }

    return (
        <StructureEditor
            key={`${year.id}|${JSON.stringify(props.items ?? [])}`}
            {...props}
            year={year}
        />
    );
}

export default withAppShell(Structure);
