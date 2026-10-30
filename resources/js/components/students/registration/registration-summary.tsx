import { capsLabelClass } from '../../structure/ui';
import { t } from '../../../lib/i18n';
import { type StudentRegistrationModel, Check } from './model';
export function RegistrationSummary({
    props,
    canSeePrivate,
    data,
    sibling,
    linked,
    setLinked,
    dismissed,
    setDismissed,
    level,
    chosenClass,
    main,
    mainPhone,
    classHasRoom,
}: Pick<
    StudentRegistrationModel,
    | 'props'
    | 'canSeePrivate'
    | 'data'
    | 'sibling'
    | 'linked'
    | 'setLinked'
    | 'dismissed'
    | 'setDismissed'
    | 'level'
    | 'chosenClass'
    | 'main'
    | 'mainPhone'
    | 'classHasRoom'
>) {
    return (
        <aside className="flex shrink-0 flex-col gap-5 border-solid border-border lg:w-[328px] lg:border-l lg:pl-8">
            <div className="flex flex-col gap-2 rounded-lg border border-solid border-border bg-surface p-4">
                <p className={capsLabelClass}>{t('Matricule')}</p>
                <p className="font-mono text-[22px] leading-7 text-text">
                    {props.matricule}
                </p>
                <p className="text-[13px] leading-[19px] text-text-muted">
                    {t(
                        'School prefix, admission year and the next free number. It never changes.',
                    )}
                </p>
            </div>

            {sibling && linked === sibling.id && (
                <div className="flex flex-col gap-[10px] rounded-lg border border-solid border-border bg-white p-4">
                    <p className="text-[14px] leading-[18px] font-semibold text-text">
                        {t('Linked as siblings')}
                    </p>
                    <p className="text-[13px] leading-[19px] text-text-muted">
                        {t('With :sibling (:matricule).', {
                            sibling: sibling.name,
                            matricule: sibling.matricule,
                        })}
                    </p>
                    <button
                        type="button"
                        onClick={() => setLinked(null)}
                        className="self-start text-[13px] leading-4 font-medium text-primary hover:underline"
                    >
                        {t('Undo')}
                    </button>
                </div>
            )}
            {sibling && linked !== sibling.id && dismissed !== sibling.id && (
                <div className="flex flex-col gap-[10px] rounded-lg border border-solid border-warning bg-warning-tint p-4">
                    <p className="text-[14px] leading-[18px] font-semibold text-warning-text">
                        {t('Possible sibling')}
                    </p>
                    <p className="text-[13px] leading-[19px] text-text">
                        {t(
                            ':sibling (:matricule) has a :relation with the same phone number.',
                            {
                                sibling: sibling.name,
                                matricule: sibling.matricule,
                                relation: sibling.relation,
                            },
                        )}
                    </p>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setLinked(sibling.id)}
                            className="flex h-[30px] items-center rounded-md border border-solid border-border bg-white px-3 text-[13px] leading-4 font-medium text-text"
                        >
                            {t('Link as siblings')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setDismissed(sibling.id)}
                            className="flex h-[30px] items-center px-[10px] text-[13px] leading-4 font-medium text-primary hover:underline"
                        >
                            {t('Not related')}
                        </button>
                    </div>
                </div>
            )}

            {canSeePrivate && (
                <div className="flex flex-col gap-2 rounded-lg border border-solid border-border bg-white p-4">
                    <p className="text-[14px] leading-[18px] font-semibold text-text">
                        {t('Private details')}
                    </p>
                    <p className="text-[13px] leading-[19px] text-text-muted">
                        {t(
                            'Religion and disability are visible only to the principal and the administrator. They never appear on report cards or receipts.',
                        )}
                    </p>
                </div>
            )}

            <div className="flex flex-col gap-[10px] rounded-lg border border-solid border-border bg-white p-4">
                <p className="text-[14px] leading-[18px] font-semibold text-text">
                    {t('Before you register')}
                </p>
                <ul className="flex flex-col gap-[10px]">
                    <Check
                        tone={
                            data.surname.trim() &&
                            data.given_names.trim() &&
                            data.date_of_birth
                                ? 'done'
                                : 'todo'
                        }
                    >
                        {t('Surname, name and date of birth')}
                    </Check>
                    <Check
                        tone={
                            !chosenClass
                                ? 'todo'
                                : classHasRoom
                                  ? 'done'
                                  : 'warn'
                        }
                    >
                        {chosenClass
                            ? t(':chosen_class :full: :students of :capacity', {
                                  chosen_class: chosenClass.name,
                                  full: classHasRoom ? 'has room' : 'is full',
                                  students: chosenClass.students,
                                  capacity: chosenClass.capacity,
                              })
                            : t('A class with room')}
                    </Check>
                    <Check
                        tone={main.name.trim() && mainPhone ? 'done' : 'todo'}
                    >
                        {t('A main contact with a phone number')}
                    </Check>
                    {data.transferred && !data.last_report_received && (
                        <Check tone="warn">
                            {t('Last report card')}
                            {data.previous_school
                                ? t(' from :previous_school', {
                                      previous_school: data.previous_school,
                                  })
                                : ''}{' '}
                            {t('not received yet.')}
                        </Check>
                    )}
                    {level?.uses_series && !data.series_id && (
                        <Check tone="warn">
                            {t(
                                'No series yet. The student shows under No series until one is chosen.',
                            )}
                        </Check>
                    )}
                </ul>
            </div>
        </aside>
    );
}
