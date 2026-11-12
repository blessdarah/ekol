import { t, tChoice } from '../../../lib/i18n';
import type { MarkSheetModel } from './model';

/** What is left to do before submitting, or why marks are locked. */
export function SheetFooter({ model }: { model: MarkSheetModel }) {
    const { open, rows, invalid, empty, published, firstError } = model;

    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <p
                className={`text-[13px] leading-4 ${invalid > 0 || firstError ? 'text-danger' : 'text-text-muted'}`}
            >
                {firstError ??
                    (open
                        ? invalid > 0 && empty > 0
                            ? empty === 1
                                ? tChoice(
                                      '{1} Fix :count invalid mark and fill 1 empty mark before submitting.|[2,*] Fix :count invalid marks and fill 1 empty mark before submitting.',
                                      invalid,
                                  )
                                : tChoice(
                                      '{1} Fix :count invalid mark and fill :empty empty marks before submitting.|[2,*] Fix :count invalid marks and fill :empty empty marks before submitting.',
                                      invalid,
                                      { empty },
                                  )
                            : invalid > 0
                              ? tChoice(
                                    '{1} Fix :count invalid mark before submitting.|[2,*] Fix :count invalid marks before submitting.',
                                    invalid,
                                )
                              : empty > 0
                                ? tChoice(
                                      '{1} Fill :count empty mark before submitting.|[2,*] Fill :count empty marks before submitting.',
                                      empty,
                                  )
                                : t(
                                      'Every mark is in. Submit when you are done.',
                                  )
                        : published
                          ? t(
                                'These marks are published and locked. A change needs a correction approved by the principal.',
                            )
                          : t('Marks cannot be entered now.'))}
            </p>
            <p className="text-[13px] leading-4 text-text-muted">
                {tChoice(
                    '{1} :count student · Enter moves to the next student|[2,*] :count students · Enter moves to the next student',
                    rows.length,
                )}
            </p>
        </div>
    );
}
