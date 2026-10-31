import { Head, Link, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { index } from '@/actions/App/Http/Controllers/StructureController';
import { storeLevel } from '@/actions/App/Http/Controllers/LevelController';
import {
    ErrorText,
    LockIcon,
    StructureHeader,
    Toggle,
    capsLabelClass,
    fieldInputClass,
    fieldLabelClass,
    outlineButtonClass,
    segmentClass,
    solidButtonClass,
    levelsCrumb,
} from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

const LETTERS = 'ABCDEFGHIJKL'.split('');

const RULES = [
    { label: 'Secondary · GCE', series: false },
    { label: 'High school · GCE', series: true },
    { label: 'Any cycle · Francophone', series: false },
];

function LevelCreate({
    yearLabel,
    hasYear,
    defaultSubsystem,
}: {
    yearLabel: string | null;
    hasYear: boolean;
    defaultSubsystem: string;
}) {
    const form = useForm({
        name: '',
        code: '',
        cycle: 'secondary',
        subsystem: defaultSubsystem,
        uses_series: false,
        class_count: hasYear ? '3' : '0',
    });
    const { data, setData, errors, processing } = form;
    const seriesAllowed =
        data.cycle === 'high_school' && data.subsystem === 'anglophone';
    const count = Math.max(0, Math.min(12, Number(data.class_count) || 0));

    function choose(patch: { cycle?: string; subsystem?: string }) {
        const next = { ...data, ...patch };
        const allowed =
            next.cycle === 'high_school' && next.subsystem === 'anglophone';

        setData({ ...next, uses_series: allowed && next.uses_series });
    }

    function submit(event: FormEvent) {
        event.preventDefault();
        form.post(storeLevel.url());
    }

    return (
        <form onSubmit={submit} className="flex flex-col gap-7">
            <Head title={t('Add a level')} />
            <StructureHeader
                trail={[levelsCrumb, { label: t('New level') }]}
                title={t('Add a level')}
                tag={t('Structure:year_label', {
                    year_label: yearLabel ? ` · ${yearLabel}` : '',
                })}
                meta={t(
                    'name it, place it in a cycle, then set up its classes',
                )}
            />

            <div className="flex flex-col gap-8 lg:flex-row">
                <div className="flex min-w-0 flex-1 flex-col gap-6">
                    <section className="flex flex-col gap-3">
                        <p className={capsLabelClass}>{t('Level')}</p>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <label
                                className={`flex flex-1 flex-col gap-2 ${fieldLabelClass}`}
                            >
                                {t('Name')}
                                <input
                                    type="text"
                                    placeholder={t('Form 1')}
                                    value={data.name}
                                    onChange={(e) =>
                                        setData('name', e.target.value)
                                    }
                                    className={fieldInputClass}
                                />
                                <ErrorText message={errors.name} />
                            </label>
                            <label
                                className={`flex flex-col gap-2 sm:w-[160px] ${fieldLabelClass}`}
                            >
                                {t('Short code')}
                                <input
                                    type="text"
                                    placeholder="F1"
                                    maxLength={10}
                                    value={data.code}
                                    onChange={(e) =>
                                        setData(
                                            'code',
                                            e.target.value.toUpperCase(),
                                        )
                                    }
                                    className={`${fieldInputClass} font-mono`}
                                />
                                <ErrorText message={errors.code} />
                            </label>
                        </div>
                    </section>

                    <section className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                            <p className={capsLabelClass}>
                                {t('Cycle and subsystem')}
                            </p>
                            <p className="text-[13px] leading-4 text-text-muted">
                                {t(
                                    'Secondary levels share one subject list. High school levels can use series.',
                                )}
                            </p>
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <div
                                role="radiogroup"
                                aria-label={t('Cycle')}
                                className={`flex flex-1 flex-col gap-2 ${fieldLabelClass}`}
                            >
                                {t('Cycle')}
                                <div className="flex gap-2">
                                    {[
                                        {
                                            value: 'secondary',
                                            label: t('Secondary'),
                                        },
                                        {
                                            value: 'high_school',
                                            label: t('High school'),
                                        },
                                    ].map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            role="radio"
                                            aria-checked={
                                                data.cycle === option.value
                                            }
                                            onClick={() =>
                                                choose({ cycle: option.value })
                                            }
                                            className={segmentClass(
                                                data.cycle === option.value,
                                            )}
                                        >
                                            {t(option.label)}
                                        </button>
                                    ))}
                                </div>
                                <ErrorText message={errors.cycle} />
                            </div>
                            <div
                                role="radiogroup"
                                aria-label={t('Subsystem')}
                                className={`flex flex-1 flex-col gap-2 ${fieldLabelClass}`}
                            >
                                {t('Subsystem')}
                                <div className="flex gap-2">
                                    {[
                                        {
                                            value: 'anglophone',
                                            label: t('Anglophone (GCE)'),
                                        },
                                        {
                                            value: 'francophone',
                                            label: t('Francophone'),
                                        },
                                    ].map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            role="radio"
                                            aria-checked={
                                                data.subsystem === option.value
                                            }
                                            onClick={() =>
                                                choose({
                                                    subsystem: option.value,
                                                })
                                            }
                                            className={segmentClass(
                                                data.subsystem === option.value,
                                            )}
                                        >
                                            {t(option.label)}
                                        </button>
                                    ))}
                                </div>
                                <ErrorText message={errors.subsystem} />
                            </div>
                        </div>
                    </section>

                    <section className="flex flex-col gap-3">
                        <p className={capsLabelClass}>{t('Series')}</p>
                        <div className="flex items-center justify-between gap-4 rounded-md border border-solid border-border bg-surface px-4 py-[14px]">
                            <div className="flex flex-col gap-1">
                                <span
                                    className={`flex items-center gap-2 text-[14px] leading-[18px] font-semibold ${seriesAllowed ? 'text-text' : 'text-text-muted'}`}
                                >
                                    {!seriesAllowed && <LockIcon size={13} />}
                                    {t('Uses series')}
                                </span>
                                <span className="text-[13px] leading-[19px] text-text-muted">
                                    {seriesAllowed
                                        ? t(
                                              'Students pick a series, then electives. You set the series up after adding the level.',
                                          )
                                        : t(
                                              'Not available here. Choose High school with the GCE subsystem to turn series on.',
                                          )}
                                </span>
                            </div>
                            <Toggle
                                checked={data.uses_series}
                                disabled={!seriesAllowed}
                                label={t('Uses series')}
                                onChange={(next) =>
                                    setData('uses_series', next)
                                }
                            />
                        </div>
                        <ErrorText message={errors.uses_series} />
                    </section>

                    <section className="flex flex-col gap-3">
                        <p className={capsLabelClass}>{t('Classes')}</p>
                        <div className="flex flex-wrap items-end gap-4">
                            <label
                                className={`flex w-[160px] shrink-0 flex-col gap-2 ${fieldLabelClass}`}
                            >
                                {t('Number of classes')}
                                <span className="flex h-10 items-center justify-between rounded-md border border-solid border-border px-3 focus-within:border-primary">
                                    <input
                                        type="number"
                                        min={0}
                                        max={12}
                                        disabled={!hasYear}
                                        value={data.class_count}
                                        onChange={(e) =>
                                            setData(
                                                'class_count',
                                                e.target.value,
                                            )
                                        }
                                        className="w-14 bg-transparent font-mono text-[16px] leading-5 font-normal text-text outline-none"
                                    />
                                    <span className="text-[13px] leading-4 font-normal text-text-muted">
                                        {t('classes')}
                                    </span>
                                </span>
                            </label>
                            {count > 0 && (
                                <div className="flex min-h-10 flex-wrap items-center gap-2">
                                    <span className="text-[13px] leading-4 text-text-muted">
                                        {t('Named')}
                                    </span>
                                    {LETTERS.slice(0, count).map(
                                        (letter, position) => (
                                            <span
                                                key={letter}
                                                className="flex h-[26px] items-center rounded-sm border border-solid border-border bg-surface px-[10px] text-[13px] leading-4 font-medium text-text"
                                            >
                                                {position === 0
                                                    ? `${data.name.trim() || t('Level')} ${letter}`
                                                    : letter}
                                            </span>
                                        ),
                                    )}
                                </div>
                            )}
                        </div>
                        {!hasYear && (
                            <p className="text-[13px] leading-[19px] text-warning">
                                {t(
                                    'Classes belong to an academic year. Make a year active in School Setup, then add classes from the level.',
                                )}
                            </p>
                        )}
                        <ErrorText message={errors.class_count} />
                    </section>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <p className="text-[13px] leading-4 text-text-muted">
                            {t(
                                'Classes can be added, renamed or removed later from the level.',
                            )}
                        </p>
                        <div className="flex gap-2">
                            <Link
                                href={index.url()}
                                className={outlineButtonClass}
                            >
                                {t('Cancel')}
                            </Link>
                            <button
                                type="submit"
                                disabled={processing}
                                className={solidButtonClass}
                            >
                                {t('Add level')}
                            </button>
                        </div>
                    </div>
                </div>

                <aside className="flex shrink-0 flex-col gap-5 border-solid border-border lg:w-[328px] lg:border-l lg:pl-8">
                    <div className="flex flex-col gap-3 rounded-lg border border-solid border-border bg-surface p-4">
                        <p className={capsLabelClass}>
                            {t('When series apply')}
                        </p>
                        <ul className="flex flex-col">
                            {RULES.map((rule) => (
                                <li
                                    key={rule.label}
                                    className="flex items-center justify-between border-t border-solid border-border py-[10px] text-[13px] leading-4 text-text last:border-b"
                                >
                                    {t(rule.label)}
                                    {rule.series ? (
                                        <span className="flex h-[22px] items-center gap-[6px] rounded-full bg-success-tint px-2 text-[12px] font-medium text-success">
                                            <span className="h-[6px] w-[6px] rounded-full bg-success" />
                                            {t('Series')}
                                        </span>
                                    ) : (
                                        <span className="flex h-[22px] items-center rounded-full border border-solid border-border bg-white px-2 text-[12px] font-medium text-text-muted">
                                            {t('No series')}
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="flex flex-col gap-[10px] rounded-lg border border-solid border-border bg-white p-4">
                        <p className="text-[14px] leading-[18px] font-semibold text-text">
                            {t('If you turn series on')}
                        </p>
                        <p className="text-[13px] leading-[19px] text-text-muted">
                            {t(
                                'Students pick a series, then electives. For each series you set the core subjects and the elective pool in Levels and series.',
                            )}
                        </p>
                    </div>
                </aside>
            </div>
        </form>
    );
}

export default withAppShell(LevelCreate);
