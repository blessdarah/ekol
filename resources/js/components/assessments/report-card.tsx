import { t } from '../../lib/i18n';
import { ordinal, score } from './ui';

export interface ReportIssuer {
    name: string;
    code: string;
    motto: string | null;
    town: string | null;
    logo_url: string | null;
}

interface GlanceRow {
    label: string;
    average: number | null;
    rank: number | null;
}

export interface ReportCardData {
    id: string;
    name: string;
    matricule: string;
    class: string;
    title: string;
    serial: string;
    columns: { id: string; label: string }[];
    subjects: {
        subject: string;
        coefficient: number;
        scores: (number | null)[];
        score: number | null;
        points: number | null;
        rank: number | null;
        remark: string | null;
        absent: boolean;
    }[];
    total_coefficient: number;
    total_points: number;
    average: number | null;
    position: number | null;
    of: number;
    spread: { average: number; highest: number; lowest: number } | null;
    grade: string | null;
    remark: string | null;
    glance: {
        kind: 'term' | 'year';
        rows: GlanceRow[];
        total: GlanceRow;
    } | null;
    outcome: {
        kind: 'promoted' | 'repeats' | 'leaving' | 'completed' | 'undecided';
        level: string | null;
    } | null;
    class_master: string | null;
    principal: string | null;
}

const PINE = 'var(--color-primary)';
const GOLD = 'var(--color-print-gold)';
const PAPER = 'var(--color-print-paper)';
const INK = 'var(--color-print-ink)';

/** Below this mark a subject is printed in red. */
const PASS = 10;

/** "Form 3 B" prints as "Form 3B": the stream sits on the number. */
function className(name: string): string {
    return name.replace(/(\d)\s+([A-Z])\b/g, '$1$2');
}

function initials(code: string): string {
    return code.slice(0, 2).toUpperCase();
}

/** A rosette drawn from one ellipse turned about its centre. */
function Rosette({
    cx,
    cy,
    rx,
    ry,
    count,
}: {
    cx: number;
    cy: number;
    rx: number;
    ry: number;
    count: number;
}) {
    return (
        <>
            {Array.from({ length: count }, (_, index) => (
                <ellipse
                    key={index}
                    cx={cx}
                    cy={cy}
                    rx={rx}
                    ry={ry}
                    transform={`rotate(${(180 / count) * index} ${cx} ${cy})`}
                />
            ))}
        </>
    );
}

/**
 * The paper every card is printed on: a fine wave mesh behind the
 * text, a rosette watermark and a double frame, which a photocopy
 * does not reproduce cleanly.
 */
function SecurityPaper({ id }: { id: string }) {
    const corners: [number, number][] = [
        [25, 25],
        [815, 25],
        [25, 1163],
        [815, 1163],
    ];

    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 840 1188"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 h-full w-full"
        >
            <defs>
                <pattern
                    id={`mesh-${id}`}
                    width="40"
                    height="8"
                    patternUnits="userSpaceOnUse"
                >
                    <path
                        d="M0 4 Q10 -1 20 4 T40 4 M0 4 Q10 9 20 4 T40 4"
                        fill="none"
                        stroke={PINE}
                        strokeOpacity="0.13"
                        strokeWidth="0.5"
                    />
                </pattern>
            </defs>
            <rect width="840" height="1188" fill={`url(#mesh-${id})`} />
            <g fill="none" stroke={PINE} strokeOpacity="0.12" strokeWidth="0.6">
                <Rosette cx={420} cy={690} rx={190} ry={64} count={30} />
                <circle cx="420" cy="690" r="196" />
                <circle cx="420" cy="690" r="202" />
            </g>
            <g fill="none" stroke={GOLD} strokeOpacity="0.2" strokeWidth="0.5">
                <Rosette cx={420} cy={690} rx={128} ry={40} count={24} />
            </g>
            <rect
                x="18"
                y="18"
                width="804"
                height="1152"
                fill="none"
                stroke={PINE}
                strokeWidth="1.4"
            />
            <rect
                x="25"
                y="25"
                width="790"
                height="1138"
                fill="none"
                stroke={GOLD}
                strokeWidth="0.7"
            />
            {corners.map(([x, y]) => (
                <g key={`${x}-${y}`}>
                    <circle
                        cx={x}
                        cy={y}
                        r="9"
                        fill={PAPER}
                        stroke={GOLD}
                        strokeWidth="0.7"
                    />
                    <g fill="none" stroke={PINE} strokeWidth="0.5">
                        <Rosette cx={x} cy={y} rx={7} ry={2.4} count={6} />
                    </g>
                </g>
            ))}
        </svg>
    );
}

const SEALS = {
    promoted: {
        seal: 'var(--color-primary)',
        deep: 'var(--color-primary-hover)',
        gold: 'var(--color-print-gold)',
        light: 'var(--color-print-cream)',
        accent: 'var(--color-print-accent)',
        mark: '★ ★ ★',
    },
    repeats: {
        seal: 'var(--color-print-amber)',
        deep: 'var(--color-print-amber-deep)',
        gold: 'var(--color-print-amber-gold)',
        light: 'var(--color-print-amber-light)',
        accent: 'var(--color-print-amber-accent)',
        mark: '● ● ●',
    },
    leaving: {
        seal: 'var(--color-print-neutral)',
        deep: 'var(--color-print-neutral-deep)',
        gold: 'var(--color-print-neutral-gold)',
        light: 'var(--color-print-neutral-light)',
        accent: 'var(--color-print-neutral-accent)',
        mark: '· · ·',
    },
    completed: {
        seal: 'var(--color-print-blue)',
        deep: 'var(--color-print-blue-deep)',
        gold: 'var(--color-print-accent)',
        light: 'var(--color-print-cream)',
        accent: 'var(--color-print-blue-gold)',
        mark: '★ ★ ★',
    },
} as const;

/** The scalloped edge of the seal, as one path. */
function scallop(centre: number, outer: number, inner: number, points: number) {
    return (
        Array.from({ length: points * 2 + 1 }, (_, index) => {
            const angle = (index / (points * 2)) * Math.PI * 2 - Math.PI / 2;
            const radius = index % 2 ? inner : outer;
            const x = centre + radius * Math.cos(angle);
            const y = centre + radius * Math.sin(angle);

            return `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
        }).join('') + 'Z'
    );
}

/**
 * The class council's decision as a rosette seal with ribbons, so a
 * family sees the outcome of the year before reading a single mark.
 */
function DecisionSeal({
    id,
    kind,
    word,
    detail,
    meta,
    ring,
}: {
    id: string;
    kind: keyof typeof SEALS;
    word: string;
    detail: string;
    meta: string | null;
    ring: string;
}) {
    const colour = SEALS[kind];
    const size = word.length > 8 ? 15 : word.length > 7 ? 17 : 19;

    return (
        <svg
            viewBox="0 0 220 250"
            className="h-[46mm] w-[40mm]"
            role="img"
            aria-label={`${word} ${detail}`}
        >
            <defs>
                <path
                    id={`ring-${id}`}
                    d="M110 106 m-71 0 a71 71 0 1 1 142 0 a71 71 0 1 1 -142 0"
                />
            </defs>
            <polygon
                points="74,150 108,168 84,248 70,232 50,240"
                fill={colour.deep}
            />
            <polygon
                points="146,150 112,168 136,248 150,232 170,240"
                fill={colour.deep}
            />
            <polygon
                points="74,150 92,160 76,214 64,206"
                fill={colour.gold}
                fillOpacity="0.55"
            />
            <polygon
                points="146,150 128,160 144,214 156,206"
                fill={colour.gold}
                fillOpacity="0.55"
            />
            <path
                transform="translate(10 6)"
                d={scallop(100, 100, 92, 36)}
                fill={colour.seal}
            />
            <circle
                cx="110"
                cy="106"
                r="86"
                fill="none"
                stroke={colour.gold}
                strokeWidth="1.6"
            />
            <circle
                cx="110"
                cy="106"
                r="82"
                fill="none"
                stroke={colour.light}
                strokeOpacity="0.45"
                strokeWidth="0.6"
            />
            <text
                fontFamily="Inter"
                fontSize="8"
                fontWeight="700"
                letterSpacing="2"
                fill={colour.light}
            >
                <textPath href={`#ring-${id}`} startOffset="0">
                    {ring}
                </textPath>
            </text>
            <circle
                cx="110"
                cy="106"
                r="60"
                fill={colour.deep}
                stroke={colour.gold}
                strokeWidth="1.2"
            />
            <circle
                cx="110"
                cy="106"
                r="56"
                fill="none"
                stroke={colour.gold}
                strokeOpacity="0.5"
                strokeWidth="0.5"
                strokeDasharray="1.5 2.5"
            />
            <text
                x="110"
                y="76"
                textAnchor="middle"
                fontFamily="Inter"
                fontSize="9"
                letterSpacing="3"
                fill={colour.accent}
            >
                {colour.mark}
            </text>
            <text
                x="110"
                y="104"
                textAnchor="middle"
                fontFamily="Fraunces"
                fontSize={size}
                fontWeight="700"
                letterSpacing="0.5"
                fill={colour.light}
            >
                {word}
            </text>
            <line
                x1="80"
                y1="113"
                x2="140"
                y2="113"
                stroke={colour.gold}
                strokeWidth="0.8"
            />
            <text
                x="110"
                y="128"
                textAnchor="middle"
                fontFamily="Inter"
                fontSize="10"
                fontWeight="700"
                letterSpacing="2.4"
                fill={colour.accent}
            >
                {detail}
            </text>
            {meta && (
                <text
                    x="110"
                    y="142"
                    textAnchor="middle"
                    fontFamily="JetBrains Mono"
                    fontSize="7.5"
                    fill={colour.light}
                    fillOpacity="0.75"
                >
                    {meta}
                </text>
            )}
        </svg>
    );
}

/** The class position, on the cards that carry no decision. */
function PositionMedallion({
    position,
    of,
}: {
    position: number | null;
    of: number;
}) {
    return (
        <svg
            viewBox="0 0 220 210"
            className="h-[38mm] w-[40mm]"
            role="img"
            aria-label={t('Class position')}
        >
            <circle cx="110" cy="105" r="98" fill={PAPER} />
            <g fill="none" stroke={PINE} strokeOpacity="0.55" strokeWidth="0.5">
                <Rosette cx={110} cy={105} rx={96} ry={62} count={36} />
            </g>
            <circle
                cx="110"
                cy="105"
                r="99"
                fill="none"
                stroke={GOLD}
                strokeWidth="1.4"
            />
            <circle
                cx="110"
                cy="105"
                r="64"
                fill={PAPER}
                stroke={GOLD}
                strokeWidth="1.2"
            />
            <circle
                cx="110"
                cy="105"
                r="59"
                fill="none"
                stroke={PINE}
                strokeWidth="0.6"
                strokeDasharray="1.5 2.5"
            />
            <text
                x="110"
                y="82"
                textAnchor="middle"
                fontFamily="Inter"
                fontSize="8"
                fontWeight="700"
                letterSpacing="2.4"
                fill="var(--color-print-muted)"
            >
                {t('CLASS POSITION')}
            </text>
            <text
                x="110"
                y="120"
                textAnchor="middle"
                fontFamily="Fraunces"
                fontSize="40"
                fontWeight="600"
                fill={PINE}
            >
                {position !== null ? ordinal(position) : '—'}
            </text>
            <text
                x="110"
                y="138"
                textAnchor="middle"
                fontFamily="Inter"
                fontSize="8"
                fontWeight="700"
                letterSpacing="1.6"
                fill={INK}
            >
                {t('OF :of', { of })}
            </text>
        </svg>
    );
}

const labelClass =
    'font-auth text-[5.5pt] leading-[7pt] font-semibold tracking-[0.14em] text-print-muted uppercase';
const boxClass =
    'rounded-[1mm] border border-solid border-print-border bg-print-paper/60';

function Mark({
    value,
    strong = false,
}: {
    value: number | null;
    strong?: boolean;
}) {
    const low = value !== null && value < PASS;

    return (
        <span
            className={`font-mono ${strong ? 'text-[7.5pt] font-bold' : 'text-[7pt]'} ${low ? 'text-danger' : strong ? 'text-print-ink' : 'text-text'}`}
        >
            {score(value)}
        </span>
    );
}

function Glance({ glance }: { glance: NonNullable<ReportCardData['glance']> }) {
    const bar = (row: GlanceRow, total: boolean) => {
        const below = row.average !== null && row.average < PASS;
        const colour = total
            ? below
                ? 'var(--color-print-amber)'
                : PINE
            : below
              ? 'var(--color-print-blue-accent)'
              : 'var(--color-print-line)';

        return (
            <div
                key={row.label}
                className={`flex items-center gap-[2.5mm] ${total ? 'border-t border-solid border-print-divider pt-[1.2mm]' : ''}`}
            >
                <span
                    className={`w-[16mm] shrink-0 truncate font-auth text-[6.5pt] ${total ? 'font-bold text-print-ink' : 'text-text-muted'}`}
                >
                    {t(row.label)}
                </span>
                <span
                    className={`relative flex-1 rounded-full bg-primary/8 ${total ? 'h-[2.2mm]' : 'h-[1.8mm]'}`}
                >
                    <span
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{
                            width: `${Math.min(100, ((row.average ?? 0) / 20) * 100)}%`,
                            backgroundColor: colour,
                        }}
                    />
                    <span className="absolute -top-[0.8mm] -bottom-[0.8mm] left-1/2 border-l border-dashed border-danger" />
                </span>
                <span
                    className={`w-[10mm] shrink-0 text-right font-mono ${total ? 'text-[7.5pt] font-bold' : 'text-[7pt]'}`}
                    style={{ color: total ? colour : undefined }}
                >
                    {score(row.average)}
                </span>
                <span className="w-[8mm] shrink-0 text-right font-mono text-[6.5pt] text-text-muted">
                    {row.rank !== null ? ordinal(row.rank) : '—'}
                </span>
            </div>
        );
    };

    return (
        <div
            className={`flex flex-col gap-[1.4mm] px-[3mm] py-[2.4mm] ${boxClass}`}
        >
            <div className="flex items-baseline justify-between">
                <span className={labelClass}>
                    {glance.kind === 'year'
                        ? t('The year at a glance')
                        : t('This term at a glance')}
                </span>
                <span className="font-auth text-[5.5pt] text-print-subtle">
                    {t('dashed line · :pass / 20', { pass: PASS })}
                </span>
            </div>
            {glance.rows.map((row) => bar(row, false))}
            {bar(glance.total, true)}
        </div>
    );
}

/**
 * One student's report card, laid out as an A5 page. On screen it
 * is scaled to fit; printed, each card fills its own sheet.
 */
export function ReportCard({
    card,
    issuer,
    yearLabel,
}: {
    card: ReportCardData;
    issuer: ReportIssuer;
    yearLabel: string | null;
}) {
    const outcome =
        card.outcome && card.outcome.kind !== 'undecided'
            ? { kind: card.outcome.kind, level: card.outcome.level }
            : null;
    const annual = card.glance?.kind === 'year' ? card.glance.total : null;
    const ring = `${t('CLASS COUNCIL')} • ${yearLabel ?? ''} • ${issuer.code.toUpperCase()} • ${
        outcome?.kind === 'completed' ? t('END OF CYCLE') : t('ANNUAL DECISION')
    } • `;
    const seal = outcome
        ? {
              promoted: {
                  word: t('PROMOTED'),
                  detail: t('TO :level', {
                      level: (outcome.level ?? '').toUpperCase(),
                  }),
              },
              repeats: {
                  word: t('REPEATS'),
                  detail: (outcome.level ?? '').toUpperCase(),
              },
              leaving: { word: t('LEAVING'), detail: t('THE SCHOOL') },
              completed: {
                  word: t('COMPLETED'),
                  detail: (outcome.level ?? '').toUpperCase(),
              },
          }[outcome.kind]
        : null;
    const microtext = Array.from(
        { length: 8 },
        () =>
            `${issuer.name.toUpperCase()} · ${t('AUTHENTIC REPORT CARD')} · ${card.serial}`,
    ).join(' · ');

    return (
        <article className="report-card relative flex h-[210mm] w-[148mm] shrink-0 break-after-page flex-col gap-[2.6mm] overflow-hidden bg-print-paper px-[9.5mm] pt-[8.5mm] pb-[6.5mm] font-auth text-text antialiased [print-color-adjust:exact] last:break-after-auto">
            <SecurityPaper id={card.id} />

            <header className="relative flex items-center gap-[3mm]">
                <span className="flex h-[12mm] w-[12mm] shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary shadow-[0_0_0_0.6mm_var(--color-print-paper),0_0_0_0.8mm_var(--color-print-gold)]">
                    {issuer.logo_url ? (
                        <img
                            src={issuer.logo_url}
                            alt=""
                            className="h-full w-full bg-white object-cover"
                        />
                    ) : (
                        <span className="flex h-[10mm] w-[10mm] items-center justify-center rounded-full border border-solid border-print-gold font-serif text-[11pt] font-semibold text-print-cream">
                            {initials(issuer.code)}
                        </span>
                    )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-[0.4mm]">
                    <span className="font-auth text-[5pt] leading-[6.5pt] font-semibold tracking-[0.16em] text-print-heading">
                        {t('REPUBLIC OF CAMEROON · PEACE – WORK – FATHERLAND')}
                    </span>
                    <span className="truncate font-serif text-[13pt] leading-[15pt] font-semibold tracking-[-0.01em] text-print-ink">
                        {issuer.name}
                    </span>
                    {issuer.motto && (
                        <span className="truncate font-serif text-[7pt] leading-[9pt] text-print-heading italic">
                            “{issuer.motto}”
                        </span>
                    )}
                    {issuer.town && (
                        <span className="text-[6pt] leading-[8pt] text-text-muted">
                            {issuer.town}
                        </span>
                    )}
                </span>
                <span className="flex shrink-0 flex-col items-end gap-[0.4mm] border-l border-solid border-print-border pl-[3mm]">
                    <span className="text-[5pt] leading-[6.5pt] font-bold tracking-[0.2em] text-print-gold">
                        {t('REPORT CARD')}
                    </span>
                    <span className="font-serif text-[10.5pt] leading-[12pt] font-medium text-print-ink italic">
                        {t(card.title)}
                    </span>
                    {yearLabel && (
                        <span className="text-[6pt] leading-[8pt] font-semibold text-print-ink">
                            {yearLabel}
                        </span>
                    )}
                    <span className="font-mono text-[5pt] leading-[6.5pt] text-text-muted">
                        Nº {card.serial}
                    </span>
                </span>
            </header>

            <div className="relative flex flex-col gap-[0.4mm]">
                <span className="h-[0.4mm] bg-primary" />
                <span className="h-[0.15mm] bg-print-gold" />
            </div>

            <section className={`relative flex ${boxClass}`}>
                <span className="flex min-w-0 flex-1 flex-col gap-[0.4mm] border-r border-solid border-print-divider px-[3mm] py-[2mm]">
                    <span className={labelClass}>{t('Student')}</span>
                    <span className="truncate font-serif text-[10.5pt] leading-[12pt] font-semibold text-print-ink">
                        {card.name}
                    </span>
                    <span className="font-mono text-[5.5pt] leading-[7pt] text-text-muted">
                        {card.matricule}
                    </span>
                </span>
                <span className="flex w-[24mm] shrink-0 flex-col gap-[0.4mm] border-r border-solid border-print-divider px-[3mm] py-[2mm]">
                    <span className={labelClass}>{t('Class')}</span>
                    <span className="font-serif text-[10.5pt] leading-[12pt] font-semibold text-print-ink">
                        {className(card.class)}
                    </span>
                </span>
                <span className="flex w-[36mm] shrink-0 flex-col gap-[0.4mm] px-[3mm] py-[2mm]">
                    <span className={labelClass}>{t('Class master')}</span>
                    <span className="truncate text-[7pt] leading-[12pt] font-semibold text-print-ink">
                        {card.class_master ?? '—'}
                    </span>
                </span>
            </section>

            <section className="relative flex flex-col overflow-hidden rounded-[1mm] border border-solid border-print-border bg-print-paper/55">
                <div className="flex h-[5mm] items-center gap-[1mm] bg-primary px-[2.5mm] text-[5pt] font-bold tracking-[0.12em] text-print-cream uppercase">
                    <span className="flex-1">{t('Subject')}</span>
                    <span className="w-[7mm] text-right">{t('Coef')}</span>
                    {card.columns.map((column) => (
                        <span
                            key={column.id}
                            className="w-[9.5mm] truncate text-right"
                            title={column.label}
                        >
                            {t(column.label)}
                        </span>
                    ))}
                    {card.columns.length > 1 && (
                        <span className="w-[10.5mm] text-right">
                            {t('Avg /20')}
                        </span>
                    )}
                    <span className="w-[10.5mm] text-right">{t('× Coef')}</span>
                    <span className="w-[8mm] text-right">{t('Rank')}</span>
                    <span className="w-[15mm] pl-[2.5mm]">{t('Remark')}</span>
                </div>
                {card.subjects.map((subject, index) => (
                    <div
                        key={subject.subject}
                        className={`flex h-[4.4mm] items-center gap-[1mm] border-b border-solid border-print-rule px-[2.5mm] ${index % 2 ? 'bg-primary/[0.035]' : ''}`}
                    >
                        <span className="min-w-0 flex-1 truncate text-[7pt] font-semibold">
                            {subject.subject}
                        </span>
                        <span className="w-[7mm] text-right font-mono text-[6.5pt] text-text-muted">
                            {subject.coefficient}
                        </span>
                        {subject.scores.map((value, position) => (
                            <span
                                key={card.columns[position]?.id ?? position}
                                className="w-[9.5mm] text-right"
                            >
                                <Mark
                                    value={value}
                                    strong={card.columns.length === 1}
                                />
                            </span>
                        ))}
                        {card.columns.length > 1 && (
                            <span className="w-[10.5mm] text-right">
                                {subject.absent ? (
                                    <span className="font-mono text-[7pt] text-text-muted">
                                        {t('ABS')}
                                    </span>
                                ) : (
                                    <Mark value={subject.score} strong />
                                )}
                            </span>
                        )}
                        <span className="w-[10.5mm] text-right font-mono text-[6.5pt] text-text-muted">
                            {score(subject.points)}
                        </span>
                        <span
                            className={`w-[8mm] text-right font-mono text-[6.5pt] ${subject.rank === 1 ? 'font-bold text-print-gold' : ''}`}
                        >
                            {subject.rank !== null
                                ? ordinal(subject.rank)
                                : '—'}
                        </span>
                        <span
                            className={`w-[15mm] truncate pl-[2.5mm] text-[6.5pt] italic ${
                                subject.score !== null && subject.score < PASS
                                    ? 'text-danger'
                                    : 'text-text-muted'
                            }`}
                        >
                            {subject.remark ? t(subject.remark) : ''}
                        </span>
                    </div>
                ))}
                <div className="flex h-[5mm] items-center gap-[1mm] bg-print-gold/12 px-[2.5mm]">
                    <span className="flex-1 text-[5.5pt] font-bold tracking-[0.12em] text-print-heading uppercase">
                        {t('Total · :count subjects', {
                            count: card.subjects.length,
                        })}
                    </span>
                    <span className="w-[7mm] text-right font-mono text-[6.5pt] font-bold text-print-ink">
                        {card.total_coefficient}
                    </span>
                    {card.columns.map((column) => (
                        <span key={column.id} className="w-[9.5mm]" />
                    ))}
                    {card.columns.length > 1 && <span className="w-[10.5mm]" />}
                    <span className="w-[10.5mm] text-right font-mono text-[7pt] font-bold text-print-ink">
                        {score(card.total_points)}
                    </span>
                    <span className="w-[8mm]" />
                    <span className="w-[15mm]" />
                </div>
            </section>

            <section className="relative flex items-stretch gap-[3mm]">
                <div className="flex min-w-0 flex-1 flex-col gap-[2mm]">
                    <div className={`flex ${boxClass}`}>
                        <span className="flex flex-1 flex-col gap-[0.3mm] border-r border-solid border-print-divider px-[3mm] py-[1.8mm]">
                            <span className={labelClass}>{t('Average')}</span>
                            <span className="flex items-baseline gap-[0.6mm] whitespace-nowrap">
                                <span
                                    className={`font-serif text-[16pt] leading-[18pt] font-semibold ${card.average !== null && card.average < PASS ? 'text-print-amber' : 'text-primary'}`}
                                >
                                    {score(card.average)}
                                </span>
                                <span className="text-[6pt] text-text-muted">
                                    / 20
                                </span>
                            </span>
                        </span>
                        <span className="flex w-[22mm] shrink-0 flex-col gap-[0.3mm] border-r border-solid border-print-divider px-[3mm] py-[1.8mm]">
                            <span className={labelClass}>{t('Position')}</span>
                            <span className="flex items-baseline gap-[0.6mm] whitespace-nowrap">
                                <span className="font-serif text-[16pt] leading-[18pt] font-semibold text-print-ink">
                                    {card.position !== null
                                        ? ordinal(card.position)
                                        : '—'}
                                </span>
                                <span className="text-[6pt] text-text-muted">
                                    / {card.of}
                                </span>
                            </span>
                        </span>
                        {card.spread && (
                            <span className="flex w-[22mm] shrink-0 flex-col justify-center gap-[0.6mm] px-[2.5mm] text-[5.5pt] text-text-muted">
                                <span className="flex justify-between">
                                    {t('Class avg')}
                                    <span className="font-mono text-text">
                                        {score(card.spread.average)}
                                    </span>
                                </span>
                                <span className="flex justify-between">
                                    {t('Highest')}
                                    <span className="font-mono text-text">
                                        {score(card.spread.highest)}
                                    </span>
                                </span>
                                <span className="flex justify-between">
                                    {t('Lowest')}
                                    <span className="font-mono text-text">
                                        {score(card.spread.lowest)}
                                    </span>
                                </span>
                            </span>
                        )}
                    </div>
                    {card.glance && <Glance glance={card.glance} />}
                </div>
                <div className="flex w-[42mm] shrink-0 flex-col items-center justify-center gap-[0.6mm]">
                    {outcome && seal ? (
                        <DecisionSeal
                            id={card.id}
                            kind={outcome.kind}
                            word={seal.word}
                            detail={seal.detail}
                            meta={
                                annual && annual.average !== null
                                    ? `${t('annual')} ${score(annual.average)}${annual.rank !== null ? ` · ${ordinal(annual.rank)}` : ''}`
                                    : null
                            }
                            ring={ring}
                        />
                    ) : (
                        <PositionMedallion
                            position={card.position}
                            of={card.of}
                        />
                    )}
                    <span className="text-center text-[5.5pt] leading-[7.5pt] text-text-muted">
                        {outcome
                            ? t('Decided by the class council')
                            : t(
                                  'Moving up is decided at the end of the year, on the last report card.',
                              )}
                    </span>
                </div>
            </section>

            <section className="relative flex gap-[2.5mm]">
                {[
                    { role: t('Class master'), name: card.class_master },
                    { role: t('Principal'), name: card.principal },
                ].map((signer) => (
                    <div
                        key={signer.role}
                        className={`flex flex-1 flex-col gap-[11mm] px-[3mm] py-[2mm] ${boxClass}`}
                    >
                        <span className={labelClass}>{signer.role}</span>
                        <span className="flex items-end justify-between border-t border-solid border-print-border pt-[1mm] text-[6pt] text-text-muted">
                            <span>{signer.name ?? ''}</span>
                            <span>{t('Signature')}</span>
                        </span>
                    </div>
                ))}
            </section>

            <footer className="relative mt-auto flex flex-col gap-[1.2mm] border-t border-solid border-print-gold/70 pt-[1.6mm]">
                <span className="flex items-center justify-between text-[5.5pt] text-text-muted">
                    <span>
                        {t('Nº :serial · printed from Campus', {
                            serial: card.serial,
                        })}
                    </span>
                    <span>A5</span>
                </span>
                <span className="block h-[1.6mm] overflow-hidden text-[3.2pt] leading-[1.6mm] font-semibold tracking-[0.12em] whitespace-nowrap text-print-gold/80">
                    {microtext}
                </span>
            </footer>
        </article>
    );
}

/**
 * A card shrunk to fit beside other content on screen. Printing
 * always uses the full A5 size.
 */
export function ReportCardPreview({
    width,
    ...props
}: {
    width: number;
    card: ReportCardData;
    issuer: ReportIssuer;
    yearLabel: string | null;
}) {
    // 148mm at 96dpi.
    const scale = width / 559.37;

    return (
        <div
            className="overflow-hidden rounded-md shadow-[0_8px_24px_color-mix(in_srgb,var(--color-text)_12%,transparent)]"
            style={{ width, height: 793.7 * scale }}
        >
            <div
                style={{
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                }}
            >
                <ReportCard {...props} />
            </div>
        </div>
    );
}
