import { Head, useForm } from '@inertiajs/react';
import { update } from '@/actions/App/Http/Controllers/GradingController';
import {
    AssessmentHeader,
    type AssessmentTabs,
    quietClass,
} from '../../components/assessments/ui';
import { ErrorText, capsLabelClass } from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface Band {
    letter: string;
    from: number;
    to: number;
    meaning: string;
    remark: string;
}

interface GradingProps {
    tabs: AssessmentTabs;
    outOf: number;
    passMark: number;
    bands: Band[];
    standard: Band[];
    isStandard: boolean;
    canEdit: boolean;
}

interface Draft {
    letter: string;
    from: string;
    to: string;
    meaning: string;
    remark: string;
}

const TONES = [
    'bg-primary',
    'bg-success',
    'bg-[#8FB79B]',
    'bg-[#D2B55B]',
    'bg-warning',
    'bg-danger',
];
const cellClass =
    'h-8 rounded-sm border border-solid border-transparent bg-transparent px-2 text-[13px] leading-4 text-text outline-none hover:border-border focus:border-primary focus:bg-white disabled:hover:border-transparent';

const draftOf = (band: Band): Draft => ({
    ...band,
    from: band.from.toFixed(2),
    to: band.to.toFixed(2),
});

function Grading({
    tabs,
    outOf,
    passMark,
    bands,
    standard,
    isStandard,
    canEdit,
}: GradingProps) {
    const form = useForm({
        pass_mark: passMark.toFixed(2),
        bands: bands.map(draftOf),
    });
    const { data, setData } = form;
    const errors = form.errors as Record<string, string | undefined>;
    const error = Object.entries(errors).find(([key]) =>
        key.startsWith('bands'),
    )?.[1];
    const sample = 12.78;
    const reads = data.bands.find(
        (band) => sample >= Number(band.from) && sample <= Number(band.to),
    );

    function setBand(position: number, patch: Partial<Draft>) {
        setData(
            'bands',
            data.bands.map((band, index) =>
                index === position ? { ...band, ...patch } : band,
            ),
        );
    }

    function submit() {
        form.transform((values) => ({
            pass_mark: Number(values.pass_mark),
            bands: values.bands.map((band) => ({
                ...band,
                from: Number(band.from),
                to: Number(band.to),
            })),
        }));
        form.put(update.url(), { preserveScroll: true });
    }

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                submit();
            }}
            className="flex flex-col gap-5 lg:min-h-[calc(100vh-56px)]"
        >
            <Head title={t('Grading and remarks')} />
            <AssessmentHeader
                active="grading"
                tabs={tabs}
                trail={[{ label: t('Grading') }]}
                title={t('Grading and remarks')}
                meta={t('One scale for every assessment, term and year.')}
            />

            <div className="flex flex-1 flex-col gap-7 lg:flex-row">
                <div className="flex min-w-0 flex-1 flex-col gap-6">
                    <section className="flex flex-col gap-3">
                        <p className={capsLabelClass}>{t('Pass mark')}</p>
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="flex h-10 w-[140px] items-center gap-2 rounded-md border border-solid border-border px-3 focus-within:border-primary">
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    aria-label={t('Pass mark')}
                                    disabled={!canEdit}
                                    value={data.pass_mark}
                                    onChange={(e) =>
                                        setData(
                                            'pass_mark',
                                            e.target.value.replace(
                                                /[^\d.]/g,
                                                '',
                                            ),
                                        )
                                    }
                                    className="w-full min-w-0 bg-transparent font-mono text-[16px] leading-5 text-text outline-none"
                                />
                                <span className="shrink-0 font-mono text-[12px] leading-4 text-text-muted">
                                    / {outOf}
                                </span>
                            </span>
                            <p className="text-[13px] leading-4 text-text-muted">
                                {t('An average at or above this passes.')}
                            </p>
                        </div>
                        <ErrorText message={errors.pass_mark} />
                    </section>

                    <section className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-3">
                            <p className={capsLabelClass}>
                                {t('Grade bands and remarks')}
                            </p>
                            <p className="text-[13px] leading-4 text-text-muted">
                                {t(
                                    'Bands must cover 0 to :out_of with no gap',
                                    { out_of: outOf },
                                )}
                            </p>
                        </div>
                        <div className="flex h-[6px] overflow-clip rounded-full">
                            {[...data.bands]
                                .reverse()
                                .map((band, position, list) => (
                                    <span
                                        key={band.letter || position}
                                        className={
                                            TONES[
                                                Math.min(
                                                    TONES.length - 1,
                                                    list.length - 1 - position,
                                                )
                                            ]
                                        }
                                        style={{
                                            flexGrow: Math.max(
                                                0.1,
                                                Number(band.to) -
                                                    Number(band.from),
                                            ),
                                            flexBasis: 0,
                                        }}
                                    />
                                ))}
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-solid border-border">
                            <div className="flex min-w-[560px] flex-col">
                                <div
                                    className={`flex h-8 items-center gap-3 border-b border-solid border-border bg-surface px-[14px] ${capsLabelClass}`}
                                >
                                    <span className="w-12 shrink-0">
                                        {t('Grade')}
                                    </span>
                                    <span className="w-[160px] shrink-0">
                                        {t('From – to')}
                                    </span>
                                    <span className="w-[130px] shrink-0">
                                        {t('Meaning')}
                                    </span>
                                    <span className="flex-1">
                                        {t('Standard remark')}
                                    </span>
                                </div>
                                {data.bands.map((band, position) => (
                                    <div
                                        key={position}
                                        className={`flex h-[42px] shrink-0 items-center gap-3 border-b border-solid border-border px-[14px] last:border-b-0 ${position % 2 === 1 ? 'bg-row-alt' : ''}`}
                                    >
                                        <input
                                            aria-label={t('Grade letter')}
                                            disabled={!canEdit}
                                            value={band.letter}
                                            maxLength={2}
                                            onChange={(e) =>
                                                setBand(position, {
                                                    letter: e.target.value.toUpperCase(),
                                                })
                                            }
                                            className={`${cellClass} w-12 shrink-0 text-center font-display text-[16px] font-bold`}
                                        />
                                        <span className="flex w-[160px] shrink-0 items-center gap-1">
                                            <input
                                                aria-label={t(
                                                    'Grade :letter from',
                                                    { letter: band.letter },
                                                )}
                                                disabled={!canEdit}
                                                inputMode="decimal"
                                                value={band.from}
                                                onChange={(e) =>
                                                    setBand(position, {
                                                        from: e.target.value.replace(
                                                            /[^\d.]/g,
                                                            '',
                                                        ),
                                                    })
                                                }
                                                className={`${cellClass} w-full min-w-0 font-mono`}
                                            />
                                            <span className="text-text-muted">
                                                –
                                            </span>
                                            <input
                                                aria-label={t(
                                                    'Grade :letter to',
                                                    { letter: band.letter },
                                                )}
                                                disabled={!canEdit}
                                                inputMode="decimal"
                                                value={band.to}
                                                onChange={(e) =>
                                                    setBand(position, {
                                                        to: e.target.value.replace(
                                                            /[^\d.]/g,
                                                            '',
                                                        ),
                                                    })
                                                }
                                                className={`${cellClass} w-full min-w-0 font-mono`}
                                            />
                                        </span>
                                        <input
                                            aria-label={t(
                                                'Grade :letter meaning',
                                                { letter: band.letter },
                                            )}
                                            disabled={!canEdit}
                                            value={band.meaning}
                                            onChange={(e) =>
                                                setBand(position, {
                                                    meaning: e.target.value,
                                                })
                                            }
                                            className={`${cellClass} w-[130px] shrink-0`}
                                        />
                                        <input
                                            aria-label={t(
                                                'Grade :letter remark',
                                                { letter: band.letter },
                                            )}
                                            disabled={!canEdit}
                                            value={band.remark}
                                            onChange={(e) =>
                                                setBand(position, {
                                                    remark: e.target.value,
                                                })
                                            }
                                            className={`${cellClass} min-w-0 flex-1`}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                        <ErrorText message={error} />
                    </section>

                    <section className="flex flex-col gap-2">
                        <p className={capsLabelClass}>
                            {t('Averages and ranking')}
                        </p>
                        <ul className="flex flex-col border-t border-solid border-border">
                            {[
                                t('Equal averages share a rank'),
                                t(
                                    'A student with a missing mark is not ranked',
                                ),
                                t(
                                    'A student marked ABS in a subject is left out of that subject’s average',
                                ),
                            ].map((rule) => (
                                <li
                                    key={rule}
                                    className="flex items-center gap-[10px] border-b border-solid border-border py-[10px] text-[14px] leading-[18px] text-text"
                                >
                                    <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-sm border border-solid border-primary bg-primary-tint">
                                        <svg
                                            width="12"
                                            height="12"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                d="M5 12.5l4.5 4.5L19 7.5"
                                                fill="none"
                                                stroke="#0E4D3A"
                                                strokeWidth="3"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                    </span>
                                    {rule}
                                </li>
                            ))}
                        </ul>
                        <p className="text-[12px] leading-[17px] text-text-muted">
                            {t(
                                'These three rules always apply; they cannot be switched off yet.',
                            )}
                        </p>
                    </section>
                </div>

                <aside className="flex shrink-0 flex-col gap-4 border-solid border-border lg:w-[300px] lg:border-l lg:pl-7">
                    <div className="flex flex-col gap-2 rounded-lg border border-solid border-border bg-surface p-4">
                        <p className={capsLabelClass}>{t('How it reads')}</p>
                        <p className="flex items-baseline gap-2">
                            <span className="font-mono text-[24px] leading-[30px] text-text">
                                {sample.toFixed(2)}
                            </span>
                            <span className="font-display text-[18px] leading-6 font-bold text-text">
                                {reads
                                    ? `${reads.letter} · ${reads.meaning}`
                                    : t('No grade')}
                            </span>
                        </p>
                        <p className="text-[13px] leading-[19px] text-text-muted">
                            {reads
                                ? t(
                                      'A report card for this average carries: “:remark”',
                                      { remark: reads.remark },
                                  )
                                : t('No band covers this average yet.')}
                        </p>
                    </div>
                    <div className="flex flex-col gap-2 rounded-lg border border-solid border-border bg-white p-4">
                        <p className="text-[14px] leading-[18px] font-semibold text-text">
                            {t('Before you change it')}
                        </p>
                        <p className="text-[13px] leading-[19px] text-text-muted">
                            {t(
                                'A change applies wherever grades are read from now on, including report cards opened again for results already published. Only the principal or an administrator can change the scale.',
                            )}
                        </p>
                    </div>
                    {canEdit && (
                        <>
                            <button
                                type="submit"
                                disabled={form.processing || !form.isDirty}
                                className="flex h-10 items-center justify-center rounded-md bg-primary text-[14px] leading-[18px] font-semibold text-white hover:bg-primary-hover disabled:opacity-40"
                            >
                                {t('Save changes')}
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    setData({
                                        pass_mark: '10.00',
                                        bands: standard.map(draftOf),
                                    })
                                }
                                className={quietClass}
                            >
                                {t('Reset to the standard scale')}
                            </button>
                            {isStandard && (
                                <p className="text-[12px] leading-[17px] text-text-muted">
                                    {t('The school is on the standard scale.')}
                                </p>
                            )}
                        </>
                    )}
                </aside>
            </div>
        </form>
    );
}

export default withAppShell(Grading);
