import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import {
    createLevel,
    storeLevelTemplates,
} from '@/actions/App/Http/Controllers/LevelController';
import { index } from '@/actions/App/Http/Controllers/StructureController';
import {
    CYCLE_LABELS,
    ErrorText,
    StructureHeader,
    capsLabelClass,
    outlineButtonClass,
    solidButtonClass,
    levelsCrumb,
} from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface TemplateLevel {
    name: string;
    code: string;
    cycle: string;
    uses_series: boolean;
    exists: boolean;
}

interface TemplateSet {
    key: string;
    name: string;
    description: string;
    levels: TemplateLevel[];
}

const MAX_CLASSES = 12;

function LevelTemplates({
    yearLabel,
    hasYear,
    sets,
}: {
    yearLabel: string | null;
    hasYear: boolean;
    sets: TemplateSet[];
}) {
    const [setKey, setSetKey] = useState(sets[0]?.key ?? '');
    const set = sets.find((option) => option.key === setKey) ?? sets[0];
    const [unticked, setUnticked] = useState<string[]>([]);
    const [perLevel, setPerLevel] = useState(hasYear ? 3 : 0);
    const [overrides, setOverrides] = useState<Record<string, string>>({});
    const [error, setError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    const available = set.levels.filter((level) => !level.exists);
    const picked = available.filter((level) => !unticked.includes(level.code));
    const existing = set.levels.length - available.length;

    function countFor(code: string): number {
        const own = overrides[code];
        const value = own === undefined || own === '' ? perLevel : Number(own);

        return Math.max(0, Math.min(MAX_CLASSES, value || 0));
    }

    function chooseSet(key: string) {
        setSetKey(key);
        setUnticked([]);
        setOverrides({});
    }

    function changeAll(next: number) {
        setPerLevel(Math.max(0, Math.min(MAX_CLASSES, next)));
        setOverrides({});
    }

    function create() {
        setCreating(true);
        router.post(
            storeLevelTemplates.url(),
            {
                set: set.key,
                levels: picked.map((level) => ({
                    code: level.code,
                    class_count: countFor(level.code),
                })),
            },
            {
                onError: (failed) => setError(Object.values(failed)[0] ?? null),
                onFinish: () => setCreating(false),
            },
        );
    }

    return (
        <div className="flex flex-col gap-7 lg:min-h-[calc(100vh-56px)]">
            <Head title={t('Start from a standard structure')} />
            <StructureHeader
                trail={[levelsCrumb, { label: t('Standard structure') }]}
                title={t('Start from a standard structure')}
                tag={t('Structure:year_label', {
                    year_label: yearLabel ? ` · ${yearLabel}` : '',
                })}
                meta={t('create every level and its classes in one go')}
            />

            <div className="flex flex-1 flex-col gap-8 lg:flex-row">
                <div className="flex shrink-0 flex-col gap-3 lg:w-[340px]">
                    <p className={capsLabelClass}>{t('Standard structures')}</p>
                    <div
                        role="radiogroup"
                        aria-label={t('Standard structures')}
                        className="flex flex-col gap-[10px]"
                    >
                        {sets.map((option) => {
                            const selected = option.key === set.key;

                            return (
                                <button
                                    key={option.key}
                                    type="button"
                                    role="radio"
                                    aria-checked={selected}
                                    onClick={() => chooseSet(option.key)}
                                    className={`flex gap-3 rounded-lg border border-solid p-[14px] text-left ${
                                        selected
                                            ? 'border-primary bg-primary-tint'
                                            : 'border-border bg-white hover:bg-surface'
                                    }`}
                                >
                                    <span
                                        className={`mt-px h-[18px] w-[18px] shrink-0 rounded-full border-solid bg-white ${
                                            selected
                                                ? 'border-[5px] border-primary'
                                                : 'border border-border'
                                        }`}
                                    />
                                    <span className="flex flex-1 flex-col gap-1">
                                        <span className="text-[14px] leading-[18px] font-semibold text-text">
                                            {option.name}
                                        </span>
                                        <span className="text-[13px] leading-[18px] text-text-muted">
                                            {t(option.description)}
                                        </span>
                                        <span
                                            className={`pt-[2px] font-mono text-[12px] leading-4 ${selected ? 'text-primary' : 'text-text-muted'}`}
                                        >
                                            {t(':levels levels', {
                                                levels: option.levels.length,
                                            })}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    <p className="flex items-center gap-[6px] pt-1 text-[13px] leading-[18px] text-text-muted">
                        {t('Need just one level?')}
                        <Link
                            href={createLevel.url()}
                            className="font-medium text-primary hover:underline"
                        >
                            {t('Add it yourself')}
                        </Link>
                    </p>
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-3">
                    <div className="flex flex-col gap-1">
                        <p className={capsLabelClass}>
                            {t('Levels in this structure')}
                        </p>
                        <p className="text-[13px] leading-4 text-text-muted">
                            {t(
                                'Untick any you do not run. Classes can be added, renamed or removed afterwards from each level.',
                            )}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 rounded-md bg-surface px-3 py-[10px]">
                        <span className="text-[13px] leading-4 font-medium text-text">
                            {t('Classes in each level')}
                        </span>
                        <div className="flex h-[30px] items-center rounded-md border border-solid border-border bg-white">
                            <button
                                type="button"
                                aria-label={t('Fewer classes in each level')}
                                disabled={!hasYear || perLevel <= 0}
                                onClick={() => changeAll(perLevel - 1)}
                                className="flex h-7 w-[30px] items-center justify-center border-r border-solid border-border text-[16px] leading-5 text-text enabled:hover:bg-surface disabled:text-text-muted disabled:opacity-60"
                            >
                                −
                            </button>
                            <span className="w-10 text-center font-mono text-[14px] leading-[18px] text-text">
                                {perLevel}
                            </span>
                            <button
                                type="button"
                                aria-label={t('More classes in each level')}
                                disabled={!hasYear || perLevel >= MAX_CLASSES}
                                onClick={() => changeAll(perLevel + 1)}
                                className="flex h-7 w-[30px] items-center justify-center border-l border-solid border-border text-[16px] leading-5 text-text enabled:hover:bg-surface disabled:opacity-40"
                            >
                                +
                            </button>
                        </div>
                        <span
                            className={`text-[13px] leading-4 ${hasYear ? 'text-text-muted' : 'text-warning'}`}
                        >
                            {hasYear
                                ? t(
                                      'Named A, B, C. Set here for all, or change one level in the Classes column.',
                                  )
                                : t(
                                      'Classes belong to an academic year. Make a year active in School Setup to add them.',
                                  )}
                        </span>
                    </div>

                    <div className="flex flex-col overflow-clip rounded-md border border-solid border-border">
                        <div className="flex h-8 shrink-0 items-center gap-3 bg-surface px-3 text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase">
                            <span className="w-[18px] shrink-0" />
                            <span className="flex-1">{t('Level')}</span>
                            <span className="w-16 shrink-0">{t('Code')}</span>
                            <span className="w-[150px] shrink-0">
                                {t('Cycle')}
                            </span>
                            <span className="w-16 shrink-0">
                                {t('Classes')}
                            </span>
                        </div>
                        {set.levels.map((level, position) => {
                            const on =
                                !level.exists && !unticked.includes(level.code);
                            const tone = on ? 'text-text' : 'text-text-muted';

                            return (
                                <div
                                    key={level.code}
                                    className={`flex h-[38px] shrink-0 items-center gap-3 border-t border-solid border-border px-3 ${position % 2 === 1 || level.exists ? 'bg-row-alt' : ''}`}
                                >
                                    <input
                                        type="checkbox"
                                        aria-label={t('Create :level', {
                                            level: level.name,
                                        })}
                                        checked={on}
                                        disabled={level.exists}
                                        onChange={() =>
                                            setUnticked(
                                                on
                                                    ? [...unticked, level.code]
                                                    : unticked.filter(
                                                          (code) =>
                                                              code !==
                                                              level.code,
                                                      ),
                                            )
                                        }
                                        className="h-[18px] w-[18px] shrink-0 accent-primary"
                                    />
                                    <span className="flex min-w-0 flex-1 items-center gap-2">
                                        <span
                                            className={`truncate text-[14px] leading-[18px] font-medium ${tone}`}
                                        >
                                            {level.name}
                                        </span>
                                        {level.exists && (
                                            <span className="flex h-5 shrink-0 items-center rounded-full border border-solid border-border bg-surface px-2 text-[11px] leading-[14px] font-medium text-text-muted">
                                                {t('Already exists')}
                                            </span>
                                        )}
                                    </span>
                                    <span
                                        className={`w-16 shrink-0 font-mono text-[12px] leading-4 ${tone}`}
                                    >
                                        {level.code}
                                    </span>
                                    <span className="w-[150px] shrink-0 text-[13px] leading-4 text-text-muted">
                                        {t(CYCLE_LABELS[level.cycle])}
                                        {level.uses_series
                                            ? t(' · series')
                                            : ''}
                                    </span>
                                    <span className="w-16 shrink-0">
                                        {on && hasYear ? (
                                            <input
                                                type="number"
                                                min={0}
                                                max={MAX_CLASSES}
                                                aria-label={t(
                                                    'Classes in :level',
                                                    { level: level.name },
                                                )}
                                                value={
                                                    overrides[level.code] ??
                                                    String(perLevel)
                                                }
                                                onChange={(e) =>
                                                    setOverrides({
                                                        ...overrides,
                                                        [level.code]:
                                                            e.target.value,
                                                    })
                                                }
                                                className="h-7 w-12 rounded-sm border border-solid border-border bg-white px-1 font-mono text-[13px] text-text outline-none focus:border-primary"
                                            />
                                        ) : (
                                            <span className="font-mono text-[13px] leading-4 text-text-muted">
                                                {level.exists ? '—' : 0}
                                            </span>
                                        )}
                                    </span>
                                </div>
                            );
                        })}
                        <div className="flex h-9 shrink-0 items-center justify-between border-t border-solid border-border bg-surface px-3">
                            <span className="text-[13px] leading-4 text-text-muted">
                                {t(':levels levels in this structure', {
                                    levels: set.levels.length,
                                })}
                            </span>
                            <span className="flex items-baseline gap-[6px]">
                                <span className="font-mono text-[13px] leading-4 text-text">
                                    {t(':picked selected', {
                                        picked: picked.length,
                                    })}
                                </span>
                                <span className="text-[13px] leading-4 text-text-muted">
                                    · {existing} {t('already')}{' '}
                                    {existing === 1 ? t('exists') : t('exist')}
                                </span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <p className="text-[13px] leading-4 text-text-muted">
                        {t(
                            'Levels you already have are left alone. Classes are named A, B, C and can be changed afterwards.',
                        )}
                    </p>
                    <ErrorText message={error} />
                </div>
                <div className="flex gap-2">
                    <Link href={index.url()} className={outlineButtonClass}>
                        {t('Cancel')}
                    </Link>
                    <button
                        type="button"
                        disabled={creating || picked.length === 0}
                        onClick={create}
                        className={solidButtonClass}
                    >
                        {t('Create')} {picked.length}{' '}
                        {picked.length === 1 ? t('level') : t('levels')}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default withAppShell(LevelTemplates);
