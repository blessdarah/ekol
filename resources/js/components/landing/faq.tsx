import { t } from '../../lib/i18n';
import { type LandingModel, QUESTIONS } from './model';

/** Questions schools ask, one open at a time. */
export function Faq({ landing }: { landing: LandingModel }) {
    const { open, setOpen } = landing;

    return (
        <div id="faq" className="flex min-w-0 flex-1 scroll-mt-6 flex-col">
            <h2 className="pb-3 text-[13px] leading-4 font-semibold tracking-[0.08em] text-brand-accent uppercase">
                {t('Questions schools ask')}
            </h2>
            {QUESTIONS.map((item, position) => (
                <div
                    key={item.question}
                    className="flex flex-col gap-[10px] border-t border-solid border-brand-border py-[22px] last:border-b"
                >
                    <button
                        type="button"
                        aria-expanded={open === position}
                        onClick={() =>
                            setOpen(open === position ? -1 : position)
                        }
                        className="flex justify-between gap-4 text-left text-[17px] leading-[22px] font-semibold text-primary-soft"
                    >
                        {t(item.question)}
                        <span
                            aria-hidden="true"
                            className={
                                open === position
                                    ? 'text-brand-accent'
                                    : 'text-primary-muted'
                            }
                        >
                            {open === position ? '−' : '+'}
                        </span>
                    </button>
                    {open === position && (
                        <p className="text-[15px] leading-[23px] text-primary-muted">
                            {t(item.answer)}
                        </p>
                    )}
                </div>
            ))}
        </div>
    );
}
