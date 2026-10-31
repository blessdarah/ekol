import { create } from '@/actions/App/Http/Controllers/SubjectRegistrationController';
import { Link } from '@inertiajs/react';
import { t } from '../../../lib/i18n';
import { capsLabelClass } from '../../structure/ui';
import { type TemplateWizard } from './model';

/** Step 1: the template set, and which of its subjects to create. */
export function ChooseSet({ wizard }: { wizard: TemplateWizard }) {
    const {
        sets,
        classes,
        set,
        unticked,
        setUnticked,
        picked,
        alreadyRegistered,
        chooseSet,
    } = wizard;

    return (
        <div className="flex flex-1 flex-col gap-8 lg:flex-row">
            <div className="flex shrink-0 flex-col gap-3 lg:w-[340px]">
                <p className={capsLabelClass}>{t('Template sets')}</p>
                <div
                    role="radiogroup"
                    aria-label={t('Template sets')}
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
                                        {t(':subjects subjects', {
                                            subjects: option.subjects.length,
                                        })}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>
                <p className="flex items-center gap-[6px] pt-1 text-[13px] leading-[18px] text-text-muted">
                    {t('Need just one subject?')}
                    <Link
                        href={create.url()}
                        className="font-medium text-primary hover:underline"
                    >
                        {t('Register it from scratch')}
                    </Link>
                </p>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="flex flex-col gap-1">
                    <p className={capsLabelClass}>
                        {t('Subjects in this set')}
                    </p>
                    <p className="text-[13px] leading-4 text-text-muted">
                        {t(
                            'Untick any you do not need. Coefficients and levels come from the template. You can change the levels next.',
                        )}
                    </p>
                </div>
                <div className="flex flex-col overflow-clip rounded-md border border-solid border-border">
                    <div className="flex h-8 shrink-0 items-center gap-3 bg-surface px-3 text-[12px] leading-4 font-semibold tracking-[0.06em] text-text-muted uppercase">
                        <span className="w-[18px] shrink-0" />
                        <span className="flex-1">{t('Subject')}</span>
                        <span className="w-[84px] shrink-0">{t('Code')}</span>
                        <span className="w-16 shrink-0">{t('Levels')}</span>
                        <span className="w-11 shrink-0">{t('Coeff')}</span>
                    </div>
                    {set.subjects.map((subject, position) => {
                        const on =
                            !subject.registered &&
                            !unticked.includes(subject.code);
                        const tone = on ? 'text-text' : 'text-text-muted';

                        return (
                            <label
                                key={subject.code}
                                className={`flex h-[38px] shrink-0 items-center gap-3 border-t border-solid border-border px-3 ${
                                    subject.registered ? '' : 'cursor-pointer'
                                } ${position % 2 === 1 || subject.registered ? 'bg-row-alt' : ''}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={on}
                                    disabled={subject.registered}
                                    onChange={() =>
                                        setUnticked(
                                            on
                                                ? [...unticked, subject.code]
                                                : unticked.filter(
                                                      (code) =>
                                                          code !== subject.code,
                                                  ),
                                        )
                                    }
                                    className="h-[18px] w-[18px] shrink-0 accent-primary"
                                />
                                <span className="flex min-w-0 flex-1 items-center gap-2">
                                    <span
                                        className={`truncate text-[14px] leading-[18px] font-medium ${tone}`}
                                    >
                                        {subject.name}
                                    </span>
                                    {subject.registered && (
                                        <span className="flex h-5 shrink-0 items-center rounded-full border border-solid border-border bg-surface px-2 text-[11px] leading-[14px] font-medium text-text-muted">
                                            {t('Already registered')}
                                        </span>
                                    )}
                                </span>
                                <span
                                    className={`w-[84px] shrink-0 font-mono text-[12px] leading-4 ${tone}`}
                                >
                                    {subject.code}
                                </span>
                                <span className="w-16 shrink-0 text-[13px] leading-4 text-text-muted">
                                    {subject.levels_label}
                                </span>
                                <span
                                    className={`w-11 shrink-0 font-mono text-[13px] leading-4 ${tone}`}
                                >
                                    {subject.coefficient}
                                </span>
                            </label>
                        );
                    })}
                    <div className="flex h-9 shrink-0 items-center justify-between border-t border-solid border-border bg-surface px-3">
                        <span className="text-[13px] leading-4 text-text-muted">
                            {t(':subjects subjects in the set', {
                                subjects: set.subjects.length,
                            })}
                        </span>
                        <span className="flex items-baseline gap-[6px]">
                            <span className="font-mono text-[13px] leading-4 text-text">
                                {t(':picked selected', {
                                    picked: picked.length,
                                })}
                            </span>
                            <span className="text-[13px] leading-4 text-text-muted">
                                {t('· :already_registered already registered', {
                                    already_registered: alreadyRegistered,
                                })}
                            </span>
                        </span>
                    </div>
                </div>
                {classes.length === 0 && (
                    <p className="text-[13px] leading-[19px] text-warning">
                        {t(
                            'There are no classes yet, so subjects will be created as drafts with no classes. Add levels and classes first to assign teachers here.',
                        )}
                    </p>
                )}
            </div>
        </div>
    );
}
