import { index as applications } from '@/actions/App/Http/Controllers/ApplicationController';
import { progress } from '@/actions/App/Http/Controllers/AssessmentController';
import { index as fees } from '@/actions/App/Http/Controllers/FeeController';
import { index as schemes } from '@/actions/App/Http/Controllers/SchemeController';
import { dayMonth } from '../fees/ui';
import { t } from '../../lib/i18n';
import {
    type AttendancePoint,
    type ClassResult,
    type FeePoint,
    type LevelCount,
    compact,
} from './charts';

export interface Attention {
    key: 'schemes' | 'marks' | 'fees' | 'registers' | 'applications';
    tone: 'science' | 'warning' | 'danger' | 'muted';
    count: number;
    detail: unknown;
}

export interface DashboardProps {
    date?: string;
    greeting?: string;
    name?: string;
    schoolName?: string;
    currency?: string;
    range?: 'term' | 'year';
    term?: {
        label: string;
        week: number | null;
        weeks: number;
        ends_on: string;
    } | null;
    yearLabel?: string | null;
    counts?: { students: number; classes: number; staff: number };
    fees?: {
        due: number;
        collected: number;
        overdue: number;
        overdue_students: number;
        series: FeePoint[];
        today: number | false;
    } | null;
    attendance?: {
        today: { rate: number | null; present: number; marked: number };
        series: AttendancePoint[];
        lowest: { class: string; rate: number } | null;
        unmarked: string[];
    };
    marks?: {
        plan: string;
        submitted: number;
        total: number;
        missing: number;
        teachers: number;
        closes_on: string | null;
        days_left: number | null;
    } | null;
    schemes?: {
        all: number;
        on_track: number;
        behind: number;
        to_approve: number;
        not_submitted: number;
    } | null;
    results?: {
        plan_id: string;
        plan: string;
        published_on: string | null;
        pass_mark: number;
        classes: ClassResult[];
    } | null;
    levels?: LevelCount[];
    admissions?: {
        year: string;
        applied: number;
        reviewed: number;
        admitted: number;
        placed: number;
    } | null;
    attention?: Attention[];
}

export const TONES: Record<Attention['tone'], string> = {
    science: 'bg-science',
    warning: 'bg-warning',
    danger: 'bg-danger',
    muted: 'bg-text-disabled',
};

/** One line of "Needs you today": what it says and where it leads. */
export function attentionLine(item: Attention, currency: string) {
    const detail = item.detail as Record<string, unknown>;

    switch (item.key) {
        case 'schemes':
            return {
                title: t(':count schemes to approve', { count: item.count }),
                sub: (item.detail as string[]).join(', '),
                href: schemes.url({ query: { state: 'to_approve' } }),
            };
        case 'marks':
            return {
                title: t(':count mark sheets missing', { count: item.count }),
                sub: t(':plan closes :date · :teachers teachers', {
                    plan: String(detail.plan),
                    date: dayMonth((detail.closes_on as string) ?? null, false),
                    teachers: Number(detail.teachers),
                }),
                href: progress.url(),
            };
        case 'fees':
            return {
                title: t(':count students overdue', { count: item.count }),
                sub: `${compact(Number(detail.amount))} ${currency}`,
                href: fees.url({ query: { state: 'overdue' } }),
            };
        case 'registers':
            return {
                title: t(':count registers not taken', { count: item.count }),
                sub: (detail.classes as string[]).slice(0, 4).join(', '),
                href: null,
            };
        default:
            return {
                title: t(':count applications to review', {
                    count: item.count,
                }),
                sub:
                    detail.oldest !== null
                        ? t('for :year · oldest waiting :days days', {
                              year: String(detail.year),
                              days: Number(detail.oldest),
                          })
                        : t('for :year', { year: String(detail.year) }),
                href: applications.url({
                    query: { stage: 'to_review' },
                }),
            };
    }
}
