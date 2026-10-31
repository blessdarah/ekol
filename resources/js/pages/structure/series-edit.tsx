import { tableRowClass } from '../../components/table/ui';
import { Head, Link, useForm } from '@inertiajs/react';
import type { FormEvent, ReactNode } from 'react';
import {
    index,
    store,
    update,
} from '@/actions/App/Http/Controllers/SeriesController';
import {
    ChipPicker,
    ErrorText,
    LockIcon,
    RemoveIcon,
    StructureHeader,
    capsLabelClass,
    fieldInputClass,
    fieldLabelClass,
    outlineButtonClass,
    solidButtonClass,
} from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface SubjectProp {
    id: string;
    code: string;
    name: string;
    teachers: number;
}

interface SeriesEditProps {
    yearLabel: string | null;
    level: { id: string; name: string };
    levels: { id: string; name: string }[];
    series: {
        id: string;
        code: string;
        name: string;
        stream: string;
        min_subjects: number | null;
        max_subjects: number | null;
        core: string[];
        electives: string[];
        level_ids: string[];
    } | null;
    subjects: SubjectProp[];
    others: {
        id: string;
        label: string;
        core: string[];
        electives: string[];
    }[];
}

function Check({
    tone,
    children,
}: {
    tone: 'success' | 'warning';
    children: ReactNode;
}) {
    return (
        <li className="flex items-start gap-2 text-[13px] leading-[18px] text-text-muted">
            <span
                className={`mt-[6px] h-[6px] w-[6px] shrink-0 rounded-full ${tone === 'success' ? 'bg-success' : 'bg-warning'}`}
            />
            {children}
        </li>
    );
}

function SeriesEdit({
    yearLabel,
    level,
    levels,
    series,
    subjects,
    others,
}: SeriesEditProps) {
    const form = useForm({
        level_id: level.id,
        code: series?.code ?? '',
        name: series?.name ?? '',
        stream: series?.stream ?? 'science',
        min_subjects: String(series?.min_subjects ?? 2),
        max_subjects: String(series?.max_subjects ?? 5),
        level_ids: series?.level_ids ?? [level.id],
        core: series?.core ?? [],
        electives: series?.electives ?? [],
    });
    const { data, setData, errors, processing } = form;
    const code = data.code.trim() || 'this series';
    const byId = new Map(subjects.map((subject) => [subject.id, subject]));
    const core = data.core.flatMap((id) => byId.get(id) ?? []);
    const pool = subjects.filter((subject) => !data.core.includes(subject.id));
    const inPool = pool.filter((subject) =>
        data.electives.includes(subject.id),
    );
    const electivesAllowed = Math.max(
        0,
        (Number(data.max_subjects) || 0) - core.length,
    );
    const unstaffed = [...core, ...inPool].filter(
        (subject) => subject.teachers === 0,
    );

    function toggleElective(id: string) {
        setData(
            'electives',
            data.electives.includes(id)
                ? data.electives.filter((other) => other !== id)
                : [...data.electives, id],
        );
    }

    function copyFrom(id: string) {
        const source = others.find((other) => other.id === id);

        if (source) {
            setData({
                ...data,
                core: source.core,
                electives: source.electives,
            });
        }
    }

    function submit(event: FormEvent) {
        event.preventDefault();

        if (series) {
            form.patch(update.url(series.id));
        } else {
            form.post(store.url());
        }
    }

    return (
        <form onSubmit={submit} className="flex flex-col gap-6">
            <Head
                title={
                    series
                        ? t('Configure series :code', { code: series.code })
                        : t('Add a series')
                }
            />
            <StructureHeader
                section="series"
                trail={[
                    {
                        label: level.name,
                        href: index.url({ query: { level: level.id } }),
                    },
                    { label: series?.code ?? t('New series') },
                ]}
                title={
                    series
                        ? t('Configure series :code', { code: series.code })
                        : t('Add a series')
                }
                tag={t('Series:year_label', {
                    year_label: yearLabel ? ` · ${yearLabel}` : '',
                })}
                meta={t(
                    'choose the core subjects and the electives students can pick from',
                )}
            />

            <div className="flex flex-col gap-8 lg:flex-row">
                <div className="flex min-w-0 flex-1 flex-col gap-5">
                    <section className="flex flex-col gap-3">
                        <p className={capsLabelClass}>{t('Series')}</p>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <label
                                className={`flex flex-col gap-2 sm:w-[100px] ${fieldLabelClass}`}
                            >
                                {t('Code')}
                                <input
                                    type="text"
                                    placeholder="S1"
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
                            </label>
                            <label
                                className={`flex flex-1 flex-col gap-2 ${fieldLabelClass}`}
                            >
                                {t('Name')}
                                <input
                                    type="text"
                                    placeholder={t('Science 1')}
                                    value={data.name}
                                    onChange={(e) =>
                                        setData('name', e.target.value)
                                    }
                                    className={fieldInputClass}
                                />
                            </label>
                            <div
                                role="radiogroup"
                                aria-label={t('Stream')}
                                className={`flex flex-col gap-2 sm:w-[220px] ${fieldLabelClass}`}
                            >
                                {t('Stream')}
                                <div className="flex gap-2">
                                    {[
                                        {
                                            value: 'science',
                                            label: t('Science'),
                                            on: 'border-science bg-science-tint text-science',
                                        },
                                        {
                                            value: 'arts',
                                            label: t('Arts'),
                                            on: 'border-arts bg-arts-tint text-arts',
                                        },
                                    ].map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            role="radio"
                                            aria-checked={
                                                data.stream === option.value
                                            }
                                            onClick={() =>
                                                setData('stream', option.value)
                                            }
                                            className={`flex h-10 flex-1 items-center justify-center rounded-md border border-solid text-[14px] leading-[18px] ${
                                                data.stream === option.value
                                                    ? `font-semibold ${option.on}`
                                                    : 'border-border font-medium text-text hover:bg-surface'
                                            }`}
                                        >
                                            {t(option.label)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <ErrorText
                            message={
                                errors.code ?? errors.name ?? errors.stream
                            }
                        />
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <div className="flex min-w-0 flex-1 flex-col gap-2">
                                <p className="flex items-baseline gap-2">
                                    <span className={fieldLabelClass}>
                                        {t('Applies to levels')}
                                    </span>
                                    <span className="text-[12px] leading-4 text-text-muted">
                                        {t('GCE high school only')}
                                    </span>
                                </p>
                                <ChipPicker
                                    label={t('Add a level')}
                                    addLabel={t('Add a level')}
                                    chosen={data.level_ids.length}
                                    summary={t(':level_ids of :levels', {
                                        level_ids: data.level_ids.length,
                                        levels: levels.length,
                                    })}
                                    options={levels.filter(
                                        (option) =>
                                            !data.level_ids.includes(option.id),
                                    )}
                                    onAdd={(id) =>
                                        setData('level_ids', [
                                            ...data.level_ids,
                                            id,
                                        ])
                                    }
                                >
                                    {levels
                                        .filter((option) =>
                                            data.level_ids.includes(option.id),
                                        )
                                        .map((option) => (
                                            <span
                                                key={option.id}
                                                className="flex h-6 items-center gap-[6px] rounded-sm bg-primary-tint pr-2 pl-[10px] text-[13px] leading-4 font-medium text-primary"
                                            >
                                                {option.name}
                                                {option.id !== level.id && (
                                                    <button
                                                        type="button"
                                                        aria-label={t(
                                                            'Remove :option',
                                                            {
                                                                option: option.name,
                                                            },
                                                        )}
                                                        onClick={() =>
                                                            setData(
                                                                'level_ids',
                                                                data.level_ids.filter(
                                                                    (id) =>
                                                                        id !==
                                                                        option.id,
                                                                ),
                                                            )
                                                        }
                                                    >
                                                        <RemoveIcon tone="var(--color-primary)" />
                                                    </button>
                                                )}
                                            </span>
                                        ))}
                                </ChipPicker>
                            </div>
                            <label
                                className={`flex flex-col gap-2 sm:w-[100px] ${fieldLabelClass}`}
                            >
                                {t('Min subjects')}
                                <input
                                    type="number"
                                    min={1}
                                    max={20}
                                    value={data.min_subjects}
                                    onChange={(e) =>
                                        setData('min_subjects', e.target.value)
                                    }
                                    className={`${fieldInputClass} font-mono`}
                                />
                            </label>
                            <label
                                className={`flex flex-col gap-2 sm:w-[100px] ${fieldLabelClass}`}
                            >
                                {t('Max subjects')}
                                <input
                                    type="number"
                                    min={1}
                                    max={20}
                                    value={data.max_subjects}
                                    onChange={(e) =>
                                        setData('max_subjects', e.target.value)
                                    }
                                    className={`${fieldInputClass} font-mono`}
                                />
                            </label>
                        </div>
                        <ErrorText
                            message={
                                errors.min_subjects ??
                                errors.max_subjects ??
                                errors.level_ids
                            }
                        />
                        {data.level_ids.length > 1 && (
                            <p className="text-[12px] leading-[18px] text-text-muted">
                                {t(
                                    'Saving writes the same series, by code, to each level listed. Removing a level here does not delete the series already on it.',
                                )}
                            </p>
                        )}
                    </section>

                    {subjects.length === 0 ? (
                        <p className="rounded-md bg-surface p-4 text-[13px] leading-[19px] text-text">
                            {t(
                                'No subjects are registered yet, so there is nothing to choose as core or elective. You can save the series now and come back once subjects exist.',
                            )}
                        </p>
                    ) : (
                        <>
                            <section className="flex flex-col gap-3">
                                <div className="flex flex-col gap-1">
                                    <p className={capsLabelClass}>
                                        {t('Core subjects')}
                                    </p>
                                    <p className="text-[13px] leading-4 text-text-muted">
                                        {t(
                                            'Every student in :code takes these. They are locked when students register.',
                                            { code },
                                        )}
                                    </p>
                                </div>
                                <ChipPicker
                                    label={t('Add a core subject')}
                                    addLabel={t('Add a subject')}
                                    chosen={core.length}
                                    summary={t(':core core', {
                                        core: core.length,
                                    })}
                                    options={pool}
                                    onAdd={(id) =>
                                        setData({
                                            ...data,
                                            core: [...data.core, id],
                                            electives: data.electives.filter(
                                                (other) => other !== id,
                                            ),
                                        })
                                    }
                                >
                                    {core.map((subject) => (
                                        <span
                                            key={subject.id}
                                            className="flex h-6 items-center gap-[6px] rounded-sm border border-solid border-border bg-surface px-2 text-[13px] leading-4 font-medium text-text"
                                        >
                                            <LockIcon
                                                size={11}
                                                tone="var(--color-text)"
                                            />
                                            {subject.name}
                                            <button
                                                type="button"
                                                aria-label={t(
                                                    'Remove :subject from core',
                                                    { subject: subject.name },
                                                )}
                                                onClick={() =>
                                                    setData(
                                                        'core',
                                                        data.core.filter(
                                                            (id) =>
                                                                id !==
                                                                subject.id,
                                                        ),
                                                    )
                                                }
                                            >
                                                <RemoveIcon tone="var(--color-text-muted)" />
                                            </button>
                                        </span>
                                    ))}
                                </ChipPicker>
                                <ErrorText message={errors.core} />
                            </section>

                            <section className="flex flex-col gap-3">
                                <div className="flex flex-col gap-1">
                                    <p className={capsLabelClass}>
                                        {t('Elective pool')}
                                    </p>
                                    <p className="text-[13px] leading-4 text-text-muted">
                                        {t(
                                            'Subjects a student can choose from. Core subjects are not repeated here.',
                                        )}
                                    </p>
                                </div>
                                <div className="flex flex-col overflow-clip rounded-md border border-solid border-border">
                                    <div className="flex h-[30px] shrink-0 items-center gap-3 bg-surface px-3 text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase">
                                        <span className="w-[18px] shrink-0" />
                                        <span className="flex-1">
                                            {t('Subject')}
                                        </span>
                                        <span className="w-[84px] shrink-0">
                                            {t('Code')}
                                        </span>
                                        <span className="w-[190px] shrink-0">
                                            {t('Teaching')}
                                        </span>
                                    </div>
                                    {pool.map((subject, position) => {
                                        const chosen = data.electives.includes(
                                            subject.id,
                                        );
                                        const muted = chosen
                                            ? 'text-text'
                                            : 'text-text-muted';

                                        return (
                                            <label
                                                key={subject.id}
                                                className={`flex h-[34px] shrink-0 cursor-pointer items-center gap-3 border-t border-solid border-border px-3 ${tableRowClass({ index: position })}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={chosen}
                                                    onChange={() =>
                                                        toggleElective(
                                                            subject.id,
                                                        )
                                                    }
                                                    className="h-[18px] w-[18px] shrink-0 accent-primary"
                                                />
                                                <span
                                                    className={`flex-1 truncate text-[14px] leading-[18px] font-medium ${muted}`}
                                                >
                                                    {subject.name}
                                                </span>
                                                <span
                                                    className={`w-[84px] shrink-0 font-mono text-[12px] leading-4 ${muted}`}
                                                >
                                                    {subject.code}
                                                </span>
                                                <span className="flex w-[190px] shrink-0 items-center gap-[6px] text-[13px] leading-4">
                                                    {!chosen ? (
                                                        <span className="text-text-muted">
                                                            {t(
                                                                'Not in the pool',
                                                            )}
                                                        </span>
                                                    ) : subject.teachers ===
                                                      0 ? (
                                                        <>
                                                            <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-warning" />
                                                            <span className="text-warning-text">
                                                                {t(
                                                                    'No teacher assigned',
                                                                )}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span className="text-text">
                                                            {subject.teachers}{' '}
                                                            {subject.teachers ===
                                                            1
                                                                ? t('teacher')
                                                                : t('teachers')}
                                                        </span>
                                                    )}
                                                </span>
                                            </label>
                                        );
                                    })}
                                    <div className="flex h-8 shrink-0 items-center justify-between border-t border-solid border-border bg-surface px-3">
                                        <span className="text-[13px] leading-4 text-text-muted">
                                            {t(':pool subjects', {
                                                pool: pool.length,
                                            })}
                                        </span>
                                        <span className="flex items-baseline gap-[6px]">
                                            <span className="font-mono text-[13px] leading-4 text-text">
                                                {t(':in_pool in the pool', {
                                                    in_pool: inPool.length,
                                                })}
                                            </span>
                                            <span className="text-[13px] leading-4 text-text-muted">
                                                {t(
                                                    '· students pick up to :electives_allowed',
                                                    {
                                                        electives_allowed:
                                                            electivesAllowed,
                                                    },
                                                )}
                                            </span>
                                        </span>
                                    </div>
                                </div>
                                <ErrorText message={errors.electives} />
                            </section>
                        </>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[13px] leading-4 text-text-muted">
                            {t(
                                'Students already registered in :code keep their subjects.',
                                { code },
                            )}
                        </p>
                        <div className="flex gap-2">
                            <Link
                                href={index.url({ query: { level: level.id } })}
                                className={outlineButtonClass}
                            >
                                {t('Cancel')}
                            </Link>
                            <button
                                type="submit"
                                disabled={processing}
                                className={solidButtonClass}
                            >
                                {t('Save series')}
                            </button>
                        </div>
                    </div>
                </div>

                <aside className="flex shrink-0 flex-col gap-5 border-solid border-border lg:w-[328px] lg:border-l lg:pl-8">
                    <div className="flex flex-col gap-3 rounded-lg border border-solid border-border bg-surface p-4">
                        <p className={capsLabelClass}>
                            {t('What students see')}
                        </p>
                        {core.length + inPool.length > 0 ? (
                            <ul className="flex flex-col overflow-clip rounded-md border border-solid border-border bg-white">
                                {core.map((subject) => (
                                    <li
                                        key={subject.id}
                                        className="flex h-8 shrink-0 items-center gap-2 border-t border-solid border-border bg-surface px-[10px] first:border-t-0"
                                    >
                                        <LockIcon />
                                        <span className="flex-1 truncate text-[12px] leading-4 text-text">
                                            {subject.name}
                                        </span>
                                        <span className="flex h-[18px] items-center rounded-sm border border-solid border-text px-[5px] text-[9px] leading-3 font-semibold tracking-[0.06em] text-text">
                                            {t('CORE')}
                                        </span>
                                    </li>
                                ))}
                                {inPool.map((subject) => (
                                    <li
                                        key={subject.id}
                                        className="flex h-8 shrink-0 items-center gap-2 border-t border-solid border-border px-[10px] first:border-t-0"
                                    >
                                        <span className="h-[14px] w-[14px] shrink-0 rounded-[3px] border border-solid border-border" />
                                        <span className="flex-1 truncate text-[12px] leading-4 text-text">
                                            {subject.name}
                                        </span>
                                        <span className="flex h-[18px] items-center rounded-sm border border-dashed border-text-muted px-[5px] text-[9px] leading-3 font-semibold tracking-[0.06em] text-text-muted">
                                            {t('ELECTIVE')}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-[12px] leading-4 text-text-muted">
                                {t('Nothing chosen yet.')}
                            </p>
                        )}
                        <p className="text-[12px] leading-4 text-text-muted">
                            {t('Same layout as Series Registration. Min')}{' '}
                            {data.min_subjects || '—'} {t('· Max')}{' '}
                            {data.max_subjects || '—'}.
                        </p>
                    </div>

                    <div className="flex flex-col gap-[10px] rounded-lg border border-solid border-border bg-white p-4">
                        <p className="text-[14px] leading-[18px] font-semibold text-text">
                            {t('Checks')}
                        </p>
                        <ul className="flex flex-col gap-[10px]">
                            <Check
                                tone={core.length > 0 ? 'success' : 'warning'}
                            >
                                {core.length > 0
                                    ? t('At least one core subject')
                                    : t(
                                          'No core subject yet. The series shows as “Needs setup”.',
                                      )}
                            </Check>
                            <Check
                                tone={
                                    inPool.length > electivesAllowed
                                        ? 'success'
                                        : 'warning'
                                }
                            >
                                {inPool.length > electivesAllowed
                                    ? t(
                                          'Pool is larger than the :electives_allowed electives allowed',
                                          {
                                              electives_allowed:
                                                  electivesAllowed,
                                          },
                                      )
                                    : t(
                                          'Pool of :in_pool gives no real choice among the :electives_allowed electives allowed',
                                          {
                                              in_pool: inPool.length,
                                              electives_allowed:
                                                  electivesAllowed,
                                          },
                                      )}
                            </Check>
                            {unstaffed.map((subject) => (
                                <Check key={subject.id} tone="warning">
                                    {t(
                                        ':subject has no teacher. You can still save.',
                                        { subject: subject.name },
                                    )}
                                </Check>
                            ))}
                        </ul>
                    </div>

                    {others.length > 0 && (
                        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border bg-white p-4">
                            <p className="text-[13px] leading-4 font-semibold text-text">
                                {t('Similar to another series?')}
                            </p>
                            <p className="text-[13px] leading-[18px] text-text-muted">
                                {t(
                                    'Copy core subjects and the pool, then adjust.',
                                )}
                            </p>
                            <select
                                aria-label={t('Copy from a series')}
                                value=""
                                onChange={(e) => copyFrom(e.target.value)}
                                className="h-8 w-full rounded-md border border-solid border-border bg-white px-2 text-[13px] font-medium text-text outline-none focus:border-primary"
                            >
                                <option value="">
                                    {t('Copy from a series')}
                                </option>
                                {others.map((other) => (
                                    <option key={other.id} value={other.id}>
                                        {t(other.label)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </aside>
            </div>
        </form>
    );
}

export default withAppShell(SeriesEdit);
