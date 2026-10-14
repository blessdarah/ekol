import { Form, Head, useHttp } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { find, schools } from '@/actions/App/Http/Controllers/ParentController';
import { ErrorBanner } from '../../components/auth/field';
import {
    PayHeading,
    PayShell,
    SERVICES,
    ServiceIcon,
    payButtonClass,
    payInputClass,
} from '../../components/pay/ui';
import { useT } from '../../lib/i18n';

interface SchoolOption {
    slug: string;
    name: string;
    place: string | null;
}

export default function ParentStart({
    school,
    services,
}: {
    school: SchoolOption | null;
    services: string[];
}) {
    const t = useT();
    const [chosen, setChosen] = useState<SchoolOption | null>(school);
    const [search, setSearch] = useState('');
    const [matches, setMatches] = useState<SchoolOption[]>([]);
    const lookup = useHttp<{ q: string }, { schools: SchoolOption[] }>({
        q: '',
    });
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(
        () => () => {
            if (timer.current) {
                clearTimeout(timer.current);
            }
        },
        [],
    );

    function onSearch(value: string) {
        setSearch(value);
        if (timer.current) {
            clearTimeout(timer.current);
        }
        if (value.trim().length < 2) {
            setMatches([]);
            return;
        }
        timer.current = setTimeout(() => {
            lookup.transform(() => ({ q: value.trim() }));
            lookup
                .get(schools.url())
                .then((response) => setMatches(response.schools))
                .catch(() => setMatches([]));
        }, 250);
    }

    return (
        <PayShell>
            <Head title={t('Parent services')} />
            <PayHeading
                title={t('Parent services')}
                sub={t(
                    'Follow your child at school from your phone. No account or password needed.',
                )}
            />
            <ul className="flex flex-col gap-2">
                {services.map((service) => (
                    <li
                        key={service}
                        className="flex items-center gap-3 rounded-xl border border-solid border-border bg-white px-4 py-3"
                    >
                        <ServiceIcon service={service} />
                        <span className="flex min-w-0 flex-1 flex-col">
                            <span className="text-[15px] leading-5 font-semibold">
                                {t(SERVICES[service]?.title ?? service)}
                            </span>
                            <span className="text-[13px] leading-[18px] text-text-muted">
                                {t(SERVICES[service]?.body ?? '')}
                            </span>
                        </span>
                        {SERVICES[service]?.soon && (
                            <span className="shrink-0 rounded-full bg-surface px-[10px] py-1 text-[12px] leading-4 text-text-muted">
                                {t('Coming soon')}
                            </span>
                        )}
                    </li>
                ))}
            </ul>

            <div className="flex flex-col gap-1 border-t border-border pt-6">
                <h2 className="font-display text-[20px] leading-6 font-bold">
                    {t('Find your child')}
                </h2>
                <p className="text-[14px] text-text-muted">
                    {t(
                        'We check the matricule against the phone number the school has for you.',
                    )}
                </p>
            </div>
            <Form
                action={find.url()}
                method="post"
                className="flex flex-col gap-4"
            >
                {({ errors, processing }) => (
                    <>
                        {errors.matricule && (
                            <ErrorBanner
                                title={t('We could not find your child')}
                                body={errors.matricule}
                            />
                        )}
                        <input
                            type="hidden"
                            name="school"
                            value={chosen?.slug ?? ''}
                        />
                        <div className="flex flex-col gap-[6px] text-[14px] font-medium">
                            <label htmlFor="school-search">{t('School')}</label>
                            {chosen ? (
                                <span className="flex items-center gap-3 rounded-xl border border-solid border-primary bg-white px-4 py-3">
                                    <span className="flex min-w-0 flex-1 flex-col">
                                        <span className="truncate text-[15px] font-semibold">
                                            {chosen.name}
                                        </span>
                                        {chosen.place && (
                                            <span className="text-[13px] font-normal text-text-muted">
                                                {chosen.place}
                                            </span>
                                        )}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setChosen(null);
                                            setSearch('');
                                            setMatches([]);
                                        }}
                                        className="shrink-0 text-[13px] font-medium text-primary hover:underline"
                                    >
                                        {t('Change')}
                                    </button>
                                </span>
                            ) : (
                                <>
                                    <input
                                        id="school-search"
                                        value={search}
                                        onChange={(event) =>
                                            onSearch(event.target.value)
                                        }
                                        autoComplete="off"
                                        placeholder={t(
                                            'Type the school’s name or town',
                                        )}
                                        className={payInputClass}
                                    />
                                    {matches.length > 0 && (
                                        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-solid border-border bg-white">
                                            {matches.map((option) => (
                                                <li key={option.slug}>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setChosen(option)
                                                        }
                                                        className="flex w-full flex-col px-4 py-3 text-left hover:bg-surface"
                                                    >
                                                        <span className="text-[15px] font-semibold">
                                                            {option.name}
                                                        </span>
                                                        {option.place && (
                                                            <span className="text-[13px] font-normal text-text-muted">
                                                                {option.place}
                                                            </span>
                                                        )}
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    {search.trim().length >= 2 &&
                                        matches.length === 0 &&
                                        !lookup.processing && (
                                            <span className="text-[13px] font-normal text-text-muted">
                                                {t(
                                                    'No school matches. Check the spelling, or try the town.',
                                                )}
                                            </span>
                                        )}
                                    {errors.school && (
                                        <span className="text-[13px] font-normal text-danger">
                                            {errors.school}
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                        <label className="flex flex-col gap-[6px] text-[14px] font-medium">
                            {t('Student’s matricule')}
                            <input
                                name="matricule"
                                autoComplete="off"
                                autoCapitalize="characters"
                                placeholder="GBHS-2025-0142"
                                className={`${payInputClass} font-mono uppercase`}
                            />
                            <span className="text-[13px] font-normal text-text-muted">
                                {t(
                                    'It is on the report card and on every fee receipt.',
                                )}
                            </span>
                        </label>
                        <label className="flex flex-col gap-[6px] text-[14px] font-medium">
                            {t('Your phone number')}
                            <span className="flex items-center gap-2">
                                <span className="flex h-12 shrink-0 items-center rounded-xl border border-solid border-border bg-surface px-3 font-mono text-[15px] text-text-muted">
                                    +237
                                </span>
                                <input
                                    name="phone"
                                    type="tel"
                                    inputMode="numeric"
                                    autoComplete="tel-national"
                                    placeholder="6 77 12 34 56"
                                    className={payInputClass}
                                />
                            </span>
                            {errors.phone ? (
                                <span className="text-[13px] font-normal text-danger">
                                    {errors.phone}
                                </span>
                            ) : (
                                <span className="text-[13px] font-normal text-text-muted">
                                    {t(
                                        'The number the school has for you as a parent or guardian.',
                                    )}
                                </span>
                            )}
                        </label>
                        <button
                            type="submit"
                            disabled={processing || !chosen}
                            className={`${payButtonClass} mt-2`}
                        >
                            {t('Find my child')}
                        </button>
                    </>
                )}
            </Form>
        </PayShell>
    );
}
