import { Head, Link, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { index, show } from '@/actions/App/Http/Controllers/SubjectController';
import {
    store,
    update,
} from '@/actions/App/Http/Controllers/SubjectRegistrationController';
import { templates } from '@/actions/App/Http/Controllers/SubjectTemplateController';
import {
    ErrorText,
    StructureHeader,
    capsLabelClass,
    fieldInputClass,
    fieldLabelClass,
    outlineButtonClass,
    solidButtonClass,
    subjectsCrumb,
} from '../../components/structure/ui';
import {
    ClassTable,
    LevelPicker,
    toRows,
    unstaffedCount,
    type Assignments,
    type ClassOption,
    type LevelOption,
    type StaffOption,
} from '../../components/subjects/class-table';
import { withAppShell } from '../../layouts/app-layout';
import { t } from '../../lib/i18n';

interface RegisterProps {
    yearLabel: string | null;
    departments: string[];
    levels: LevelOption[];
    classes: ClassOption[];
    staff: StaffOption[];
    subject: {
        id: string;
        name: string;
        code: string;
        coefficient: number;
        department: string;
        note: string | null;
        classes: {
            class_id: string;
            staff_id: string | null;
            weekly_periods: number;
        }[];
    } | null;
}

function Dot({ done }: { done: boolean }) {
    return (
        <span
            className={`h-[6px] w-[6px] shrink-0 rounded-full ${done ? 'bg-success' : 'bg-border'}`}
        />
    );
}

function Register({
    yearLabel,
    departments,
    levels,
    classes,
    staff,
    subject,
}: RegisterProps) {
    const initial: Assignments = {};

    for (const row of subject?.classes ?? []) {
        initial[row.class_id] = {
            staff_id: row.staff_id ?? '',
            weekly_periods: String(row.weekly_periods),
        };
    }

    const form = useForm({
        name: subject?.name ?? '',
        code: subject?.code ?? '',
        coefficient: subject ? String(subject.coefficient) : '',
        department: subject?.department ?? departments[0] ?? '',
        note: subject?.note ?? '',
    });
    const { data, setData, processing } = form;
    const errors = form.errors as Record<string, string>;
    const [assignments, setAssignments] = useState<Assignments>(initial);
    const [levelIds, setLevelIds] = useState<string[]>(() =>
        levels
            .filter((level) =>
                classes.some(
                    (option) =>
                        option.level_id === level.id && initial[option.id],
                ),
            )
            .map((level) => level.id),
    );
    const shown = classes.filter((option) =>
        levelIds.includes(option.level_id),
    );
    const chosen = Object.keys(assignments).length;
    const periodsSet = Object.values(assignments).every(
        (row) => Number(row.weekly_periods) > 0,
    );
    const classError = Object.entries(errors).find(([key]) =>
        key.startsWith('classes'),
    )?.[1];

    function changeLevels(next: string[]) {
        const kept: Assignments = {};

        for (const option of classes) {
            if (next.includes(option.level_id) && assignments[option.id]) {
                kept[option.id] = assignments[option.id];
            }
        }

        setLevelIds(next);
        setAssignments(kept);
    }

    function submit(mode: 'draft' | 'register') {
        form.transform((values) => ({
            ...values,
            note: values.note || null,
            mode,
            classes: toRows(assignments),
        }));

        if (subject) {
            form.patch(update.url(subject.id));
        } else {
            form.post(store.url());
        }
    }

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                submit('register');
            }}
            className="flex flex-col gap-7"
        >
            <Head
                title={
                    subject
                        ? t('Edit :subject', { subject: subject.name })
                        : t('Register a subject')
                }
            />
            <StructureHeader
                section="subjects"
                trail={
                    subject
                        ? [
                              subjectsCrumb,
                              {
                                  label: subject.name,
                                  href: show.url(subject.id),
                              },
                              { label: t('Edit') },
                          ]
                        : [subjectsCrumb, { label: t('Register') }]
                }
                title={subject ? t('Edit a subject') : t('Register a subject')}
                tag={t('Subject setup:year_label', {
                    year_label: yearLabel ? ` · ${yearLabel}` : '',
                })}
                meta={t(
                    'identity, coefficient and who teaches it in each class',
                )}
            />

            <div className="flex flex-col gap-8 lg:flex-row">
                <div className="flex min-w-0 flex-1 flex-col gap-6">
                    <section className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                            <p className={capsLabelClass}>
                                {t('Subject identity')}
                            </p>
                            <p className="text-[13px] leading-4 text-text-muted">
                                {t(
                                    'Define how this subject appears everywhere: roster, reports, and marks entry.',
                                )}
                            </p>
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <label
                                className={`flex flex-1 flex-col gap-2 ${fieldLabelClass}`}
                            >
                                {t('Subject name')}
                                <input
                                    type="text"
                                    value={data.name}
                                    onChange={(e) =>
                                        setData('name', e.target.value)
                                    }
                                    className={fieldInputClass}
                                />
                                <ErrorText message={errors.name} />
                            </label>
                            <label
                                className={`flex flex-col gap-2 sm:w-[168px] ${fieldLabelClass}`}
                            >
                                {t('Code')}
                                <input
                                    type="text"
                                    placeholder={t('MATH-101')}
                                    maxLength={20}
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
                            <label
                                className={`flex flex-col gap-2 sm:w-[196px] ${fieldLabelClass}`}
                            >
                                {t('Coefficient')}
                                <span className="flex h-10 items-center justify-between rounded-md border border-solid border-border bg-white px-3 focus-within:border-primary">
                                    <input
                                        type="number"
                                        min={0.5}
                                        max={10}
                                        step={0.5}
                                        value={data.coefficient}
                                        onChange={(e) =>
                                            setData(
                                                'coefficient',
                                                e.target.value,
                                            )
                                        }
                                        className="w-16 bg-transparent font-mono text-[16px] leading-5 font-normal text-text outline-none"
                                    />
                                    <span className="text-[13px] leading-4 font-medium text-text-muted">
                                        {t('tests & exams')}
                                    </span>
                                </span>
                                <ErrorText message={errors.coefficient} />
                            </label>
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <label
                                className={`flex flex-col gap-2 sm:w-[300px] ${fieldLabelClass}`}
                            >
                                {t('Department')}
                                <select
                                    value={data.department}
                                    onChange={(e) =>
                                        setData('department', e.target.value)
                                    }
                                    className={fieldInputClass}
                                >
                                    {departments.map((department) => (
                                        <option key={department}>
                                            {department}
                                        </option>
                                    ))}
                                </select>
                                <ErrorText message={errors.department} />
                            </label>
                            <label
                                className={`flex flex-1 flex-col gap-2 ${fieldLabelClass}`}
                            >
                                {t('Internal note (optional)')}
                                <input
                                    type="text"
                                    placeholder={t(
                                        'Keep grouped with Further Maths in reports.',
                                    )}
                                    maxLength={255}
                                    value={data.note}
                                    onChange={(e) =>
                                        setData('note', e.target.value)
                                    }
                                    className={`${fieldInputClass} text-[14px]`}
                                />
                                <ErrorText message={errors.note} />
                            </label>
                        </div>
                    </section>

                    <section className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                            <p className={capsLabelClass}>
                                {t('Classes & teachers')}
                            </p>
                            <p className="text-[13px] leading-4 text-text-muted">
                                {t(
                                    'Pick the levels, then tick the classes that take this subject. Each class has its own teacher and weekly periods.',
                                )}
                            </p>
                        </div>
                        <LevelPicker
                            levels={levels}
                            value={levelIds}
                            onChange={changeLevels}
                        />
                        <ClassTable
                            classes={shown}
                            staff={staff}
                            value={assignments}
                            defaultPeriods={4}
                            onChange={setAssignments}
                        />
                        <ErrorText message={classError} />
                    </section>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <p className="text-[13px] leading-4 text-text-muted">
                            {t(
                                'Every selected class needs a teacher before you can register.',
                            )}
                        </p>
                        <div className="flex gap-2">
                            <Link
                                href={
                                    subject ? show.url(subject.id) : index.url()
                                }
                                className="flex h-9 items-center px-3 text-[13px] font-medium text-text-muted hover:underline"
                            >
                                {t('Cancel')}
                            </Link>
                            <button
                                type="button"
                                disabled={processing}
                                onClick={() => submit('draft')}
                                className={outlineButtonClass}
                            >
                                {t('Save draft')}
                            </button>
                            <button
                                type="submit"
                                disabled={processing}
                                className={solidButtonClass}
                            >
                                {subject
                                    ? t('Save subject')
                                    : t('Register subject')}
                            </button>
                        </div>
                    </div>
                </div>

                <aside className="flex shrink-0 flex-col gap-6 border-solid border-border lg:w-[328px] lg:border-l lg:pl-8">
                    <div className="flex flex-col gap-2 rounded-lg border border-solid border-border bg-surface p-4">
                        <p className={capsLabelClass}>{t('One coefficient')}</p>
                        <p className="font-display text-[16px] leading-[22px] font-bold text-text">
                            {t('Same weight for sequences and exams.')}
                        </p>
                        <p className="text-[13px] leading-[19px] text-text-muted">
                            {t(
                                'The coefficient is set once on the subject. There is no separate exam coefficient to enter.',
                            )}
                        </p>
                    </div>
                    <div className="flex flex-col gap-[10px] rounded-lg border border-solid border-border bg-white p-4">
                        <p className="text-[14px] leading-[18px] font-semibold text-text">
                            {t('Before you register')}
                        </p>
                        {[
                            [
                                t('Subject name and coefficient'),
                                !!data.name.trim() &&
                                    Number(data.coefficient) > 0,
                            ],
                            [t('At least one class selected'), chosen > 0],
                            [
                                t('A teacher for every selected class'),
                                chosen > 0 && unstaffedCount(assignments) === 0,
                            ],
                            [
                                t('Weekly periods for every selected class'),
                                chosen > 0 && periodsSet,
                            ],
                        ].map(([label, done]) => (
                            <p
                                key={label as string}
                                className="flex items-center gap-2 text-[13px] leading-4 text-text-muted"
                            >
                                <Dot done={done as boolean} />
                                {label}
                            </p>
                        ))}
                    </div>
                    {!subject && (
                        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border bg-white p-4">
                            <p className="text-[13px] leading-4 font-semibold text-text">
                                {t('Setting up many subjects?')}
                            </p>
                            <p className="text-[13px] leading-4 text-text-muted">
                                {t(
                                    'Start from a prepared set, then choose classes and teachers for all of them in one go.',
                                )}
                            </p>
                            <Link
                                href={templates.url()}
                                className="flex h-8 w-fit items-center rounded-md border border-solid border-border bg-white px-3 text-[13px] leading-4 font-medium text-text hover:bg-surface"
                            >
                                {t('Use a template')}
                            </Link>
                        </div>
                    )}
                </aside>
            </div>
        </form>
    );
}

export default withAppShell(Register);
