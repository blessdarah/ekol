import { t } from '../../../lib/i18n';
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
                        ? invalid > 0 || empty > 0
                            ? t(':and:marks before submitting.', {
                                  and:
                                      invalid > 0
                                          ? `Fix ${invalid} invalid ${invalid === 1 ? 'mark' : 'marks'}${empty > 0 ? ' and ' : ''}`
                                          : '',
                                  marks:
                                      empty > 0
                                          ? `${invalid > 0 ? 'fill' : 'Fill'} ${empty} empty ${empty === 1 ? 'mark' : 'marks'}`
                                          : '',
                              })
                            : t('Every mark is in. Submit when you are done.')
                        : published
                          ? t(
                                'These marks are published and locked. A change needs a correction approved by the principal.',
                            )
                          : t('Marks cannot be entered now.'))}
            </p>
            <p className="text-[13px] leading-4 text-text-muted">
                {rows.length} {rows.length === 1 ? t('student') : t('students')}{' '}
                {t('· Enter moves to the next student')}
            </p>
        </div>
    );
}
