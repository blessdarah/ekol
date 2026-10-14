import { Head, Link, useForm } from '@inertiajs/react';
import {
    index,
    store,
    update,
} from '@/actions/App/Http/Controllers/AssessmentController';
import {
    AssessmentHeader,
    type AssessmentTabs,
    type PlanSummary,
    amberText,
    primaryClass,
    quietClass,
    range,
} from '../../components/assessments/ui';
import {
    ErrorText,
    capsLabelClass,
    fieldInputClass,
    fieldLabelClass,
    segmentClass,
} from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface FormProps {
    yearLabel: string;
    tabs: AssessmentTabs;
    outOf: number;
    terms: {
        id: string;
        label: string;
        starts_on: string;
        ends_on: string;
        current: boolean;
    }[];
    levels: { id: string; name: string }[];
    defaultTerm: string | null;
    unstaffed: { level_id: string | null; text: string }[];
    plan: (PlanSummary & { term_id: string; level_ids: string[] }) | null;
}

function Check({
    ok,
    children,
}: {
    ok: boolean | null;
    children: React.ReactNode;
}) {
    return (
        <li className="flex items-start gap-2 text-[13px] leading-[18px] text-text-muted">
            <span
                className={`mt-[6px] h-[6px] w-[6px] shrink-0 rounded-full ${ok === null ? 'bg-border' : ok ? 'bg-success' : 'bg-warning'}`}
            />
            <span>{children}</span>
        </li>
    );
}

function AssessmentForm({
    yearLabel,
    tabs,
    outOf,
    terms,
    levels,
    defaultTerm,
    unstaffed,
    plan,
}: FormProps) {
    const form = useForm({
        name: plan?.name ?? '',
        kind: plan?.kind ?? 'sequence',
        term_id: plan?.term_id ?? defaultTerm ?? '',
        held_from: plan?.held_from ?? '',
        held_until: plan?.held_until ?? '',
        window_starts_on: plan?.window_starts_on ?? '',
        window_ends_on: plan?.window_ends_on ?? '',
        level_ids: plan?.level_ids ?? levels.map((level) => level.id),
    });
    const { data, setData, processing } = form;
    const errors = form.errors as Record<string, string | undefined>;
    const term = terms.find((option) => option.id === data.term_id);
    const scheduled = plan?.state === 'scheduled';
    const dates = [
        data.held_from,
        data.held_until,
        data.window_starts_on,
        data.window_ends_on,
    ];
    const allSet = dates.every(Boolean);
    const inside =
        term && allSet
            ? dates.every(
                  (date) => date >= term.starts_on && date <= term.ends_on,
              )
            : null;
    const opensWith =
        data.held_from && data.window_starts_on
            ? data.window_starts_on >= data.held_from &&
              data.window_starts_on <=
                  (data.held_until || data.window_starts_on)
            : null;
    const closesAfter =
        data.held_until && data.window_ends_on
            ? data.window_ends_on >= data.held_until
            : null;
    const warnings = unstaffed.filter(
        (item) =>
            item.level_id !== null && data.level_ids.includes(item.level_id),
    );

    function submit(schedule: boolean) {
        form.transform((values) => ({
            ...values,
            held_from: values.held_from || null,
            held_until: values.held_until || null,
            window_starts_on: values.window_starts_on || null,
            window_ends_on: values.window_ends_on || null,
            schedule,
        }));

        if (plan) {
            form.patch(update.url(plan.id));
        } else {
            form.post(store.url());
        }
    }

    function toggleLevel(id: string) {
        setData(
            'level_ids',
            data.level_ids.includes(id)
                ? data.level_ids.filter((item) => item !== id)
                : [...data.level_ids, id],
        );
    }

    const dateField = (
        key: 'held_from' | 'held_until' | 'window_starts_on' | 'window_ends_on',
        label: string,
    ) => (
        <label
            className={`flex min-w-[150px] flex-1 flex-col gap-[6px] ${fieldLabelClass}`}
        >
            {label}
            <input
                type="date"
                value={data[key]}
                min={term?.starts_on}
                max={term?.ends_on}
                onChange={(e) => setData(key, e.target.value)}
                className={`${fieldInputClass} font-mono text-[14px]`}
            />
            <ErrorText message={errors[key]} />
        </label>
    );

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                submit(true);
            }}
            className="flex flex-col gap-5 lg:min-h-[calc(100vh-56px)]"
        >
            <Head
                title={
                    plan
                        ? t('Edit :plan', { plan: plan.name })
                        : t('Add an assessment')
                }
            />
            <AssessmentHeader
                active="calendar"
                tabs={tabs}
                trail={[
                    { label: t('Calendar'), href: index.url() },
                    { label: plan ? plan.name : t('Add an assessment') },
                ]}
                title={plan ? plan.name : t('Add an assessment')}
                meta={
                    <>
                        <span className="font-mono uppercase">
                            {yearLabel}
                            {term ? ` · ${term.label}` : ''}
                        </span>
                        <span>{t('· one page: what, when and who')}</span>
                    </>
                }
            />

            <div className="flex flex-1 flex-col gap-8 lg:flex-row">
                <div className="flex min-w-0 flex-1 flex-col gap-6">
                    <section className="flex flex-col gap-3">
                        <p className={capsLabelClass}>{t('What')}</p>
                        <div className="flex flex-wrap gap-3">
                            <label
                                className={`flex min-w-[200px] flex-[2] flex-col gap-[6px] ${fieldLabelClass}`}
                            >
                                {t('Name')}
                                <input
                                    type="text"
                                    value={data.name}
                                    onChange={(e) =>
                                        setData('name', e.target.value)
                                    }
                                    placeholder={t('Sequence 1')}
                                    className={fieldInputClass}
                                />
                                <ErrorText message={errors.name} />
                            </label>
                            <div className="flex min-w-[200px] flex-[1.4] flex-col gap-[6px]">
                                <span className={fieldLabelClass}>
                                    {t('Type')}
                                </span>
                                <div
                                    role="radiogroup"
                                    aria-label={t('Type')}
                                    className="flex gap-2"
                                >
                                    {(['sequence', 'exam'] as const).map(
                                        (kind) => (
                                            <button
                                                key={kind}
                                                type="button"
                                                role="radio"
                                                aria-checked={
                                                    data.kind === kind
                                                }
                                                onClick={() =>
                                                    setData('kind', kind)
                                                }
                                                className={segmentClass(
                                                    data.kind === kind,
                                                )}
                                            >
                                                {kind === 'sequence'
                                                    ? t('Sequence')
                                                    : t('Exam')}
                                            </button>
                                        ),
                                    )}
                                </div>
                                <ErrorText message={errors.kind} />
                            </div>
                            <label
                                className={`flex min-w-[140px] flex-1 flex-col gap-[6px] ${fieldLabelClass}`}
                            >
                                {t('Term')}
                                <select
                                    value={data.term_id}
                                    onChange={(e) =>
                                        setData('term_id', e.target.value)
                                    }
                                    className={fieldInputClass}
                                >
                                    {terms.map((option) => (
                                        <option
                                            key={option.id}
                                            value={option.id}
                                        >
                                            {t(option.label)}
                                        </option>
                                    ))}
                                </select>
                                <ErrorText message={errors.term_id} />
                            </label>
                        </div>
                    </section>

                    <section className="flex flex-col gap-3">
                        <p className={capsLabelClass}>{t('When')}</p>
                        <div className="flex flex-wrap gap-3">
                            {dateField('held_from', t('Held from'))}
                            {dateField('held_until', t('Held until'))}
                            {dateField('window_starts_on', t('Marks open'))}
                            {dateField('window_ends_on', t('Marks close'))}
                        </div>
                    </section>

                    <section className="flex flex-col gap-3">
                        <p className={capsLabelClass}>{t('Who')}</p>
                        <div className="flex flex-col gap-[6px]">
                            <span className={fieldLabelClass}>
                                {t('Levels')}
                            </span>
                            <div className="flex flex-wrap gap-2">
                                {levels.map((level) => {
                                    const on = data.level_ids.includes(
                                        level.id,
                                    );

                                    return (
                                        <button
                                            key={level.id}
                                            type="button"
                                            aria-pressed={on}
                                            onClick={() =>
                                                toggleLevel(level.id)
                                            }
                                            className={`flex h-8 items-center rounded-full border border-solid px-[14px] text-[13px] leading-4 ${
                                                on
                                                    ? 'border-primary bg-primary-tint font-semibold text-primary'
                                                    : 'border-border font-medium text-text-muted hover:bg-surface'
                                            }`}
                                        >
                                            {level.name}
                                        </button>
                                    );
                                })}
                            </div>
                            <ErrorText message={errors.level_ids} />
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <div
                                className={`flex min-w-[240px] flex-[2] flex-col gap-[6px] ${fieldLabelClass}`}
                            >
                                {t('Subjects')}
                                <span className="flex h-10 items-center rounded-md border border-solid border-border bg-surface px-3 text-[14px] leading-[18px] font-normal text-text">
                                    {t('Every subject each class takes')}
                                </span>
                            </div>
                            <div
                                className={`flex min-w-[160px] flex-1 flex-col gap-[6px] ${fieldLabelClass}`}
                            >
                                {t('Marks are out of')}
                                <span className="flex h-10 items-center justify-between rounded-md border border-solid border-border bg-surface px-3 font-normal">
                                    <span className="font-mono text-[14px] leading-[18px] text-text">
                                        {outOf}
                                    </span>
                                    <span className="text-[12px] leading-4 text-text-muted">
                                        {t('School-wide')}
                                    </span>
                                </span>
                            </div>
                        </div>
                    </section>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[13px] leading-4 text-text-muted">
                            {scheduled
                                ? t(
                                      'Scheduled already: saving keeps it scheduled.',
                                  )
                                : t('After saving you return to the calendar.')}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Link href={index.url()} className={quietClass}>
                                {t('Cancel')}
                            </Link>
                            {!scheduled && (
                                <button
                                    type="button"
                                    disabled={processing}
                                    onClick={() => submit(false)}
                                    className={quietClass}
                                >
                                    {t('Save as draft')}
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={processing}
                                className={primaryClass}
                            >
                                {scheduled
                                    ? t('Save changes')
                                    : t('Schedule assessment')}
                            </button>
                        </div>
                    </div>
                </div>

                <aside className="flex shrink-0 flex-col gap-5 border-solid border-border lg:w-[328px] lg:border-l lg:pl-8">
                    <div className="flex flex-col gap-3 rounded-lg border border-solid border-border bg-surface p-4">
                        <p className={capsLabelClass}>
                            {t('What teachers will see')}
                        </p>
                        <div className="flex flex-col gap-1 rounded-md border border-solid border-border bg-white p-3">
                            <p className="text-[14px] leading-[18px] font-semibold text-text">
                                {data.name || t('This assessment')}{' '}
                                {t('· enter your marks')}
                            </p>
                            <p className="text-[13px] leading-[18px] text-text-muted">
                                {data.window_starts_on && data.window_ends_on
                                    ? t(
                                          'Open :window_ends_on, out of :out_of.',
                                          {
                                              window_ends_on: range(
                                                  data.window_starts_on,
                                                  data.window_ends_on,
                                              ),
                                              out_of: outOf,
                                          },
                                      )
                                    : t(
                                          'Out of :out_of. The window is not set yet.',
                                          { out_of: outOf },
                                      )}{' '}
                                {t('Use ABS if a student was absent.')}
                            </p>
                        </div>
                        <p className="text-[13px] leading-[19px] text-text-muted">
                            {t(
                                'This shows on each teacher’s mark sheet while the window is open.',
                            )}
                        </p>
                    </div>
                    <div className="flex flex-col gap-[10px] rounded-lg border border-solid border-border bg-white p-4">
                        <p className="text-[14px] leading-[18px] font-semibold text-text">
                            {t('Checks')}
                        </p>
                        <ul className="flex flex-col gap-2">
                            <Check ok={inside}>
                                {t('Dates are inside')}{' '}
                                {term?.label ?? t('the term')}
                            </Check>
                            <Check ok={opensWith}>
                                {t('The marks window opens with the tests')}
                            </Check>
                            <Check ok={closesAfter}>
                                {t('It closes after the last test')}
                            </Check>
                            {warnings.slice(0, 3).map((warning) => (
                                <li
                                    key={warning.text}
                                    className={`flex items-start gap-2 text-[13px] leading-[18px] ${amberText}`}
                                >
                                    <span className="mt-[6px] h-[6px] w-[6px] shrink-0 rounded-full bg-warning" />
                                    <span>{t(warning.text)}</span>
                                </li>
                            ))}
                            {warnings.length > 3 && (
                                <li className="pl-[14px] text-[12px] leading-4 text-text-muted">
                                    {t('and :warnings more with no teacher', {
                                        warnings: warnings.length - 3,
                                    })}
                                </li>
                            )}
                        </ul>
                    </div>
                </aside>
            </div>
        </form>
    );
}

export default withAppShell(AssessmentForm);
