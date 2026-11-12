import { t } from '../../../lib/i18n';
import { shortDate } from '../ui';
import { type StudentAcademics } from './model';

/** What the marks mean and what can still change. */
export function MarksNote({ academics }: { academics: StudentAcademics }) {
    const { term, columns, termAverage, termComplete, open, coming } =
        academics;

    return (
        <p className="text-[13px] leading-[19px] text-text-muted">
            {t('Marks are out of 20.')}{' '}
            {open
                ? t(
                      ':open marks are open until :window_ends_on, so the average and position can still change. ',
                      {
                          open: open.name,
                          window_ends_on: shortDate(open.window_ends_on),
                      },
                  )
                : ''}
            {coming
                ? t(':coming has not been held yet. ', {
                      coming: coming.name,
                  })
                : ''}
            {termComplete
                ? t('Every :term assessment is published:average', {
                      term: term?.label ?? 'term',
                      average:
                          termAverage !== null
                              ? `: the term average is ${termAverage.toFixed(2)}.`
                              : ', but a mark is missing so there is no term average.',
                  })
                : t(
                      'The term average comes once every assessment of the term is published.',
                  )}
            {columns.some(
                (column) => column.average !== null && !column.complete,
            )
                ? t(' * An average so far: a mark is still missing.')
                : ''}
        </p>
    );
}
