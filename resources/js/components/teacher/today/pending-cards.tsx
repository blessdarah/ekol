import { t } from '../../../lib/i18n';
import { Card, Pending } from './card';

/** The teaching log and lesson notes, which are not built yet. */
export function PendingCards() {
    return (
        <div className="flex flex-col gap-6 xl:flex-row">
            <Card title={t('Teaching log')} className="xl:flex-[1.75]">
                <Pending>
                    {t(
                        'Lessons you have taught but not logged will be listed here, with the topic and homework to fill in. The teaching log is not built yet.',
                    )}
                </Pending>
            </Card>
            <Card title={t('Lesson notes')} className="xl:flex-1">
                <Pending>
                    {t(
                        'Notes that are due will be listed here. Lesson notes are not built yet.',
                    )}
                </Pending>
            </Card>
        </div>
    );
}
