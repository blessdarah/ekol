import { moneyNumber, moneyUnits } from '@/lib/money';
import type { ReactNode } from 'react';
import {
    Area,
    Bar,
    BarChart,
    CartesianGrid,
    ComposedChart,
    LabelList,
    Line,
    LineChart,
    ReferenceDot,
    Rectangle,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import type { BarShapeProps } from 'recharts';
import { numberLocale, t } from '../../lib/i18n';

/** The chart palette: pine for single series, status colours for state only. */
export const COLOURS = {
    pine: 'var(--color-primary)',
    pineDark: 'var(--color-primary-hover)',
    muted: 'var(--color-text-muted)',
    grid: 'var(--color-chart-track)',
    axis: 'var(--color-chart-muted)',
    warning: 'var(--color-warning)',
    amber: 'var(--color-warning-text)',
    girls: 'var(--color-arts)',
    boys: 'var(--color-science)',
};

const tick = {
    fill: COLOURS.muted,
    fontSize: 11,
    fontFamily: 'JetBrains Mono, ui-monospace, monospace',
};

/** 18.4M, 950K: short amounts for axes and tooltips. */
export function compact(amount: number): string {
    return new Intl.NumberFormat(numberLocale(), {
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(amount);
}

function TooltipCard({ children }: { children: ReactNode }) {
    return (
        <div className="flex min-w-[190px] flex-col gap-[6px] rounded-[10px] border border-solid border-border bg-white px-[14px] py-3 text-[13px] leading-[18px] text-text shadow-[0_12px_32px_color-mix(in_srgb,var(--color-text)_14%,transparent)]">
            {children}
        </div>
    );
}

function TooltipRow({
    swatch,
    label,
    value,
    tone,
}: {
    swatch?: string;
    label: string;
    value: string;
    tone?: string;
}) {
    return (
        <span className={`flex items-center gap-2 ${tone ?? ''}`}>
            {swatch && (
                <span
                    className="h-[2px] w-[10px] shrink-0"
                    style={{ backgroundColor: swatch }}
                />
            )}
            <span className="flex-1">{label}</span>
            <span className="font-mono text-[12px]">{value}</span>
        </span>
    );
}

export interface FeePoint {
    label: string;
    starts_on: string;
    ends_on: string;
    due: number;
    collected: number | null;
}

/**
 * Fees collected so far, against what the instalments make due by
 * each week or month. Hover a point to see the gap.
 */
export function FeeChart({
    series,
    today,
    rangeLabel,
}: {
    series: FeePoint[];
    today: number | false | null;
    rangeLabel: (point: FeePoint) => string;
}) {
    const now = typeof today === 'number' ? series[today] : undefined;

    return (
        <ResponsiveContainer
            width="100%"
            height={280}
            initialDimension={{ width: 720, height: 280 }}
        >
            <ComposedChart
                data={series}
                margin={{ top: 20, right: 8, bottom: 0, left: 0 }}
            >
                <CartesianGrid vertical={false} stroke={COLOURS.grid} />
                <XAxis
                    dataKey="label"
                    tick={tick}
                    tickLine={false}
                    axisLine={{ stroke: COLOURS.axis }}
                    interval="preserveStartEnd"
                    minTickGap={24}
                />
                <YAxis
                    tick={tick}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value: number) => compact(value)}
                    width={48}
                />
                <Tooltip
                    cursor={{
                        stroke: COLOURS.pine,
                        strokeWidth: 1,
                        strokeDasharray: '2 3',
                    }}
                    content={({ active, payload }) => {
                        const point = payload?.[0]?.payload as
                            | FeePoint
                            | undefined;

                        if (!active || !point) {
                            return null;
                        }

                        const gap =
                            point.collected === null
                                ? null
                                : moneyNumber(
                                      (moneyUnits(point.due) ?? 0n) -
                                          (moneyUnits(point.collected) ?? 0n),
                                  );

                        return (
                            <TooltipCard>
                                <span className="font-semibold">
                                    {rangeLabel(point)}
                                </span>
                                <TooltipRow
                                    swatch={COLOURS.pine}
                                    label={t('Collected')}
                                    value={
                                        point.collected === null
                                            ? '—'
                                            : compact(point.collected)
                                    }
                                />
                                <TooltipRow
                                    swatch={COLOURS.muted}
                                    label={t('Due by then')}
                                    value={compact(point.due)}
                                />
                                {gap !== null && gap > 0 && (
                                    <span className="border-t border-solid border-border pt-[6px]">
                                        <TooltipRow
                                            label={t('Behind by')}
                                            value={compact(gap)}
                                            tone="font-medium text-warning-text"
                                        />
                                    </span>
                                )}
                            </TooltipCard>
                        );
                    }}
                />
                <Area
                    type="linear"
                    dataKey="collected"
                    stroke={COLOURS.pine}
                    strokeWidth={2}
                    fill={COLOURS.pine}
                    fillOpacity={0.08}
                    activeDot={{
                        r: 5,
                        fill: COLOURS.pine,
                        stroke: 'var(--color-bg)',
                        strokeWidth: 2,
                    }}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                />
                <Line
                    type="stepAfter"
                    dataKey="due"
                    stroke={COLOURS.muted}
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                    activeDot={{
                        r: 4,
                        fill: 'var(--color-bg)',
                        stroke: COLOURS.muted,
                        strokeWidth: 2,
                    }}
                    isAnimationActive={false}
                />
                {now && (
                    <ReferenceLine
                        x={now.label}
                        stroke={COLOURS.pine}
                        strokeDasharray="2 3"
                        label={{
                            value: t('Today'),
                            position: 'top',
                            fill: COLOURS.pine,
                            fontSize: 11,
                            fontWeight: 600,
                        }}
                    />
                )}
            </ComposedChart>
        </ResponsiveContainer>
    );
}

export interface AttendancePoint {
    label: string;
    date: string;
    rate: number;
}

/** Students present day by day, the worst day called out. */
export function AttendanceChart({ series }: { series: AttendancePoint[] }) {
    const lowest = series.reduce<AttendancePoint | null>(
        (worst, point) => (!worst || point.rate < worst.rate ? point : worst),
        null,
    );
    const floor = Math.min(
        80,
        Math.floor(Math.min(...series.map((point) => point.rate)) / 10) * 10,
    );

    return (
        <ResponsiveContainer
            width="100%"
            height={208}
            initialDimension={{ width: 512, height: 208 }}
        >
            <LineChart
                data={series}
                margin={{ top: 12, right: 12, bottom: 0, left: 0 }}
            >
                <CartesianGrid vertical={false} stroke={COLOURS.grid} />
                <XAxis
                    dataKey="label"
                    tick={tick}
                    tickLine={false}
                    axisLine={{ stroke: COLOURS.axis }}
                    interval="preserveStartEnd"
                    minTickGap={40}
                />
                <YAxis
                    domain={[floor, 100]}
                    tick={tick}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value: number) => `${value}%`}
                    width={44}
                />
                <Tooltip
                    cursor={{ stroke: COLOURS.axis, strokeWidth: 1 }}
                    content={({ active, payload }) => {
                        const point = payload?.[0]?.payload as
                            | AttendancePoint
                            | undefined;

                        if (!active || !point) {
                            return null;
                        }

                        return (
                            <TooltipCard>
                                <span className="font-semibold">
                                    {point.label}
                                </span>
                                <TooltipRow
                                    swatch={COLOURS.pine}
                                    label={t('Present')}
                                    value={`${point.rate}%`}
                                />
                            </TooltipCard>
                        );
                    }}
                />
                <Line
                    type="linear"
                    dataKey="rate"
                    stroke={COLOURS.pine}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{
                        r: 5,
                        fill: COLOURS.pine,
                        stroke: 'var(--color-bg)',
                        strokeWidth: 2,
                    }}
                    isAnimationActive={false}
                />
                {lowest && series.length > 2 && (
                    <ReferenceDot
                        x={lowest.label}
                        y={lowest.rate}
                        r={5}
                        fill={COLOURS.warning}
                        stroke="var(--color-bg)"
                        strokeWidth={2}
                        label={{
                            value: `${lowest.rate}% · ${lowest.label}`,
                            position: 'bottom',
                            fill: COLOURS.amber,
                            fontSize: 11,
                            fontWeight: 600,
                        }}
                    />
                )}
            </LineChart>
        </ResponsiveContainer>
    );
}

export interface ClassResult {
    id: string;
    name: string;
    average: number;
    passed: number;
    students: number;
}

/**
 * Each class's average (or pass rate) as a bar from zero, with the
 * pass line; a class below it in amber. Click a bar to open it.
 */
export function ResultsChart({
    classes,
    passMark,
    measure,
    onOpen,
}: {
    classes: ClassResult[];
    passMark: number;
    measure: 'average' | 'rate';
    onOpen: (row: ClassResult) => void;
}) {
    const data = classes.map((row) => ({
        ...row,
        rate:
            row.students > 0
                ? Math.round((row.passed / row.students) * 100)
                : 0,
    }));
    const max = measure === 'average' ? 20 : 100;
    const line = measure === 'average' ? passMark : 50;

    return (
        <ResponsiveContainer
            width="100%"
            height={Math.max(160, data.length * 30 + 32)}
            initialDimension={{ width: 552, height: 280 }}
        >
            <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 4, right: 64, bottom: 0, left: 0 }}
                barCategoryGap={8}
            >
                <CartesianGrid horizontal={false} stroke={COLOURS.grid} />
                <XAxis
                    type="number"
                    domain={[0, max]}
                    tick={tick}
                    tickLine={false}
                    axisLine={false}
                    tickCount={5}
                />
                <YAxis
                    type="category"
                    dataKey="name"
                    width={84}
                    tick={{ fill: 'var(--color-text)', fontSize: 13 }}
                    tickLine={false}
                    axisLine={false}
                />
                <Tooltip
                    cursor={{ fill: 'var(--color-surface)' }}
                    content={({ active, payload }) => {
                        const row = payload?.[0]?.payload as
                            | (ClassResult & { rate: number })
                            | undefined;

                        if (!active || !row) {
                            return null;
                        }

                        return (
                            <TooltipCard>
                                <span className="font-semibold">
                                    {t(':class · :count students', {
                                        class: row.name,
                                        count: row.students,
                                    })}
                                </span>
                                <TooltipRow
                                    label={t('Average')}
                                    value={`${row.average} / 20`}
                                />
                                <TooltipRow
                                    label={t('Passed (≥:mark)', {
                                        mark: passMark,
                                    })}
                                    value={`${row.passed} · ${row.rate}%`}
                                />
                                <span className="text-[12px] font-medium text-primary">
                                    {t('Click to open class results →')}
                                </span>
                            </TooltipCard>
                        );
                    }}
                />
                <ReferenceLine
                    x={line}
                    stroke={COLOURS.muted}
                    strokeDasharray="4 3"
                    label={{
                        value:
                            measure === 'average'
                                ? t('pass :mark', { mark: passMark })
                                : '50%',
                        position: 'insideBottomRight',
                        fill: COLOURS.muted,
                        fontSize: 11,
                    }}
                />
                <Bar
                    dataKey={measure}
                    radius={[0, 4, 4, 0]}
                    barSize={12}
                    cursor="pointer"
                    shape={(bar: BarShapeProps) => {
                        const row = bar.payload as ClassResult & {
                            rate: number;
                        };
                        const value =
                            measure === 'average' ? row.average : row.rate;

                        return (
                            <Rectangle
                                {...bar}
                                fill={
                                    value < line
                                        ? COLOURS.warning
                                        : COLOURS.pine
                                }
                            />
                        );
                    }}
                    onClick={(entry) => onOpen(entry.payload as ClassResult)}
                    isAnimationActive={false}
                >
                    <LabelList
                        dataKey={measure}
                        position="right"
                        formatter={(value: unknown) =>
                            measure === 'average'
                                ? String(value)
                                : `${String(value)}%`
                        }
                        style={{
                            ...tick,
                            fill: 'var(--color-text)',
                            fontSize: 12,
                        }}
                    />
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}

export interface LevelCount {
    name: string;
    girls: number;
    boys: number;
}

/** Girls and boys at each level, stacked, with the total at the end. */
export function LevelsChart({ levels }: { levels: LevelCount[] }) {
    const data = levels.map((level) => ({
        ...level,
        total: level.girls + level.boys,
    }));

    return (
        <ResponsiveContainer
            width="100%"
            height={Math.max(140, data.length * 30 + 8)}
            initialDimension={{ width: 512, height: 240 }}
        >
            <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 0, right: 48, bottom: 0, left: 0 }}
                barCategoryGap={8}
            >
                <XAxis type="number" hide />
                <YAxis
                    type="category"
                    dataKey="name"
                    width={96}
                    tick={{ fill: 'var(--color-text)', fontSize: 13 }}
                    tickLine={false}
                    axisLine={false}
                />
                <Tooltip
                    cursor={{ fill: 'var(--color-surface)' }}
                    content={({ active, payload }) => {
                        const row = payload?.[0]?.payload as
                            | (LevelCount & { total: number })
                            | undefined;

                        if (!active || !row) {
                            return null;
                        }

                        return (
                            <TooltipCard>
                                <span className="font-semibold">
                                    {t(':level · :count students', {
                                        level: row.name,
                                        count: row.total,
                                    })}
                                </span>
                                <TooltipRow
                                    swatch={COLOURS.girls}
                                    label={t('Girls')}
                                    value={String(row.girls)}
                                />
                                <TooltipRow
                                    swatch={COLOURS.boys}
                                    label={t('Boys')}
                                    value={String(row.boys)}
                                />
                            </TooltipCard>
                        );
                    }}
                />
                <Bar
                    dataKey="girls"
                    stackId="students"
                    fill={COLOURS.girls}
                    barSize={12}
                    radius={[4, 0, 0, 4]}
                    stroke="var(--color-bg)"
                    strokeWidth={1}
                    isAnimationActive={false}
                />
                <Bar
                    dataKey="boys"
                    stackId="students"
                    fill={COLOURS.boys}
                    barSize={12}
                    radius={[0, 4, 4, 0]}
                    stroke="var(--color-bg)"
                    strokeWidth={1}
                    isAnimationActive={false}
                >
                    <LabelList
                        dataKey="total"
                        position="right"
                        style={{
                            ...tick,
                            fill: 'var(--color-text)',
                            fontSize: 12,
                        }}
                    />
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}

/** A small trend line for a headline number. */
export function Sparkline({ values }: { values: number[] }) {
    if (values.length < 2) {
        return <span className="block h-8" />;
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const points = values.map((value, index) => [
        (index / (values.length - 1)) * 222 + 4,
        30 - ((value - min) / span) * 24 - 2,
    ]);
    const last = points[points.length - 1];

    return (
        <svg width="230" height="32" viewBox="0 0 230 32" aria-hidden>
            <polyline
                points={points.map(([x, y]) => `${x},${y}`).join(' ')}
                fill="none"
                stroke={COLOURS.pine}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <circle cx={last[0]} cy={last[1]} r="3" fill={COLOURS.pine} />
        </svg>
    );
}

/** A thin bar split into parts, for a headline number. */
export function SplitBar({
    parts,
}: {
    parts: { count: number; tone: string }[];
}) {
    const shown = parts.filter((part) => part.count > 0);

    return (
        <span className="flex h-8 max-w-[230px] items-center gap-[2px]">
            {shown.length === 0 ? (
                <span className="h-[6px] flex-1 rounded-full bg-border" />
            ) : (
                shown.map((part, position) => (
                    <span
                        key={part.tone}
                        className={`h-[6px] ${part.tone} ${position === 0 ? 'rounded-l-full' : ''} ${position === shown.length - 1 ? 'rounded-r-full' : ''}`}
                        style={{ flexGrow: part.count }}
                    />
                ))
            )}
        </span>
    );
}
