import { Form, Head, Link } from '@inertiajs/react';
import { useState } from 'react';
import { open } from '@/actions/App/Http/Controllers/SchemeController';
import { show as syllabus } from '@/actions/App/Http/Controllers/SyllabusController';
import { dayMonth } from '../../components/fees/ui';
import {
    SchemesHeader,
    StepBar,
    type Steps,
} from '../../components/schemes/ui';
import { StructureTabs, capsLabelClass } from '../../components/structure/ui';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface OpenProps {
    steps: Steps;
    term: {
        id: string;
        label: string;
        starts_on: string;
        ends_on: string;
        weeks: number;
    };
    opening: {
        due_on: string;
        approval: string;
        starts_from: string;
        free_changes: boolean;
    } | null;
    suggestedDueOn: string;
    creates: {
        schemes: number;
        classes: number;
        with_teacher: number;
        without_teacher: string[];
        empty_syllabus: string[];
    };
}

const APPROVALS = [
    { key: 'head_of_department', label: 'Head of department' },
    { key: 'principal', label: 'Principal only' },
    { key: 'none', label: 'No approval' },
];

const STARTS = [
    { key: 'syllabus', label: 'The syllabus, with its weeks' },
    { key: 'last_year', label: 'Last year’s scheme, same teacher' },
];

function choiceClass(selected: boolean): string {
    return `flex h-10 items-center rounded-md border border-solid px-4 text-[14px] ${
        selected
            ? 'border-primary bg-primary-tint font-semibold text-primary'
            : 'border-border font-medium text-text hover:bg-surface'
    }`;
}

function OpenSchemes({
    steps,
    term,
    opening,
    suggestedDueOn,
    creates,
}: OpenProps) {
    const [approval, setApproval] = useState(
        opening?.approval ?? 'head_of_department',
    );
    const [startsFrom, setStartsFrom] = useState(
        opening?.starts_from ?? 'syllabus',
    );
    const [freeChanges, setFreeChanges] = useState(
        opening?.free_changes ?? false,
    );
    const fixes =
        creates.without_teacher.length > 0 || creates.empty_syllabus.length > 0;

    return (
        <div className="flex flex-col gap-5">
            <Head title={t('Open schemes')} />
            <StructureTabs active="schemes" />
            <SchemesHeader
                trail={[{ label: t('Open schemes') }]}
                title={t('Open schemes for :term', { term: t(term.label) })}
                sub={t(
                    'Creates one scheme for each subject and class, given to the teacher who teaches it there.',
                )}
            />
            <StepBar steps={steps} active="open" />

            <Form
                action={open.url()}
                method="post"
                className="flex flex-col gap-8 lg:flex-row"
            >
                {({ errors, processing }) => (
                    <>
                        <div className="flex min-w-0 flex-1 flex-col gap-5">
                            <div className="flex flex-wrap gap-4">
                                <div className="flex min-w-[240px] flex-1 flex-col gap-[6px] text-[13px] font-medium text-text">
                                    {t('Term')}
                                    <span className="flex h-10 items-center rounded-md border border-solid border-border bg-surface px-3 text-[14px] font-normal">
                                        {t(term.label)} ·{' '}
                                        {dayMonth(term.starts_on, false)} –{' '}
                                        {dayMonth(term.ends_on, false)} ·{' '}
                                        {t(':count weeks', {
                                            count: term.weeks,
                                        })}
                                    </span>
                                </div>
                                <label className="flex flex-col gap-[6px] text-[13px] font-medium text-text">
                                    {t('Teachers submit by')}
                                    <input
                                        type="date"
                                        name="due_on"
                                        defaultValue={
                                            opening?.due_on ?? suggestedDueOn
                                        }
                                        className="h-10 rounded-md border border-solid border-border bg-white px-3 font-mono text-[14px] font-normal outline-none focus:border-primary"
                                    />
                                    {errors.due_on && (
                                        <span className="font-normal text-danger">
                                            {errors.due_on}
                                        </span>
                                    )}
                                </label>
                            </div>
                            <div className="flex flex-col gap-2">
                                <span className="text-[13px] font-medium text-text">
                                    {t('Who approves a scheme')}
                                </span>
                                <input
                                    type="hidden"
                                    name="approval"
                                    value={approval}
                                />
                                <div className="flex flex-wrap gap-2">
                                    {APPROVALS.map((option) => (
                                        <button
                                            key={option.key}
                                            type="button"
                                            aria-pressed={
                                                approval === option.key
                                            }
                                            onClick={() =>
                                                setApproval(option.key)
                                            }
                                            className={choiceClass(
                                                approval === option.key,
                                            )}
                                        >
                                            {t(option.label)}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[13px] text-text-muted">
                                    {approval === 'none'
                                        ? t(
                                              'A scheme counts as approved as soon as the teacher submits it.',
                                          )
                                        : t(
                                              'The principal can approve any scheme. Heads of department approve the subjects of their department; schemes without a head go to the principal.',
                                          )}
                                </p>
                            </div>
                            <div className="flex flex-col gap-2">
                                <span className="text-[13px] font-medium text-text">
                                    {t('Each scheme starts from')}
                                </span>
                                <input
                                    type="hidden"
                                    name="starts_from"
                                    value={startsFrom}
                                />
                                <div className="flex flex-wrap gap-2">
                                    {STARTS.map((option) => (
                                        <button
                                            key={option.key}
                                            type="button"
                                            aria-pressed={
                                                startsFrom === option.key
                                            }
                                            onClick={() =>
                                                setStartsFrom(option.key)
                                            }
                                            className={choiceClass(
                                                startsFrom === option.key,
                                            )}
                                        >
                                            {t(option.label)}
                                        </button>
                                    ))}
                                </div>
                                {startsFrom === 'last_year' && (
                                    <p className="text-[13px] text-text-muted">
                                        {t(
                                            'Where a teacher has no scheme from last year for the same subject and level, theirs starts from the syllabus.',
                                        )}
                                    </p>
                                )}
                            </div>
                            <label className="flex items-center gap-3 border-y border-solid border-border py-3 text-[14px] text-text">
                                <input
                                    type="hidden"
                                    name="free_changes"
                                    value={freeChanges ? '1' : '0'}
                                />
                                <input
                                    type="checkbox"
                                    checked={freeChanges}
                                    onChange={(e) =>
                                        setFreeChanges(e.target.checked)
                                    }
                                    className="h-4 w-4 accent-primary"
                                />
                                {t(
                                    'Teachers can change an approved scheme without asking again',
                                )}
                            </label>
                        </div>

                        <aside className="flex shrink-0 flex-col gap-4 lg:w-[310px] lg:border-l lg:border-solid lg:border-border lg:pl-8">
                            <span className={capsLabelClass}>
                                {t('What will be created')}
                            </span>
                            <p className="flex items-baseline gap-2">
                                <span className="font-display text-[36px] leading-10 font-extrabold text-text">
                                    {creates.schemes}
                                </span>
                                <span className="text-[14px] text-text-muted">
                                    {t('schemes · :count classes', {
                                        count: creates.classes,
                                    })}
                                </span>
                            </p>
                            <dl className="flex flex-col divide-y divide-border border-y border-solid border-border text-[13px]">
                                <div className="flex justify-between py-2">
                                    <dt>{t('Given to a teacher')}</dt>
                                    <dd className="font-mono">
                                        {creates.with_teacher}
                                    </dd>
                                </div>
                                <div
                                    className={`flex justify-between py-2 ${creates.without_teacher.length > 0 ? 'text-[#8A5A12]' : ''}`}
                                >
                                    <dt>{t('No teacher yet')}</dt>
                                    <dd className="font-mono">
                                        {creates.without_teacher.length}
                                    </dd>
                                </div>
                                <div
                                    className={`flex justify-between py-2 ${creates.empty_syllabus.length > 0 ? 'text-[#8A5A12]' : ''}`}
                                >
                                    <dt>{t('Syllabus still empty')}</dt>
                                    <dd className="font-mono">
                                        {t(':count subjects', {
                                            count: creates.empty_syllabus
                                                .length,
                                        })}
                                    </dd>
                                </div>
                            </dl>
                            {fixes && (
                                <div className="flex flex-col gap-2 rounded-lg bg-warning-tint px-4 py-3 text-[13px] leading-[19px] text-text">
                                    <p className="font-semibold text-[#8A5A12]">
                                        {t('Worth fixing first')}
                                    </p>
                                    {creates.without_teacher.length > 0 && (
                                        <p>
                                            {t(
                                                ':list have no teacher. Their schemes wait until one is assigned.',
                                                {
                                                    list:
                                                        creates.without_teacher
                                                            .slice(0, 4)
                                                            .join(', ') +
                                                        (creates.without_teacher
                                                            .length > 4
                                                            ? ` +${creates.without_teacher.length - 4}`
                                                            : ''),
                                                },
                                            )}
                                        </p>
                                    )}
                                    {creates.empty_syllabus.length > 0 && (
                                        <p>
                                            {t(
                                                ':list have no syllabus for this term, so those schemes start blank.',
                                                {
                                                    list:
                                                        creates.empty_syllabus
                                                            .slice(0, 4)
                                                            .join(', ') +
                                                        (creates.empty_syllabus
                                                            .length > 4
                                                            ? ` +${creates.empty_syllabus.length - 4}`
                                                            : ''),
                                                },
                                            )}
                                        </p>
                                    )}
                                    <Link
                                        href={syllabus.url()}
                                        className="font-medium text-primary hover:underline"
                                    >
                                        {t('Back to the syllabus →')}
                                    </Link>
                                </div>
                            )}
                            <button
                                type="submit"
                                disabled={processing}
                                className="flex h-11 items-center justify-center rounded-md bg-primary px-4 text-[14px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
                            >
                                {creates.schemes > 0
                                    ? t('Open :count schemes', {
                                          count: creates.schemes,
                                      })
                                    : t('Save settings')}
                            </button>
                            <p className="text-[12px] leading-[17px] text-text-muted">
                                {t(
                                    'You can still change the deadline afterwards. Opening again later only adds schemes for new classes.',
                                )}
                            </p>
                        </aside>
                    </>
                )}
            </Form>
        </div>
    );
}

export default withAppShell(OpenSchemes);
