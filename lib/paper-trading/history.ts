/**
 * PAPER TRADING ONLY — validate dated daily closes before any SMA cross.
 * Invalid, short, or stale history is not executable. Demo series never is.
 */

import { MIN_DATED_CLOSES } from '@/lib/paper-trading/constants';
import {
    calendarDaysBetween,
    isNyseTradingDay,
    latestCompletedSession,
} from '@/lib/paper-trading/calendar';
import { historyIssueMessage, type DataIssue } from '@/lib/paper-trading/messages';

export type DailyBar = { date: string; close: number };
export type HistorySource = 'finnhub-candle' | 'demo' | 'unavailable';

export type HistoryAssessment = {
    ok: boolean;
    executable: boolean;
    closes: number[];
    dates: string[];
    source: HistorySource;
    latestBarDate: string | null;
    expectedSession: string;
    issue: DataIssue | null;
    message: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function assessDailyHistory(input: {
    bars: DailyBar[] | null;
    now: Date;
    source: HistorySource;
    issue?: DataIssue | null;
}): HistoryAssessment {
    const expectedSession = latestCompletedSession(input.now);
    const base = {
        closes: [] as number[],
        dates: [] as string[],
        source: input.source,
        latestBarDate: null as string | null,
        expectedSession,
        executable: false,
    };

    const fail = (issue: DataIssue, source: HistorySource = input.source): HistoryAssessment => ({
        ...base,
        ok: false,
        source,
        issue,
        message: historyIssueMessage(issue),
    });

    if (input.issue && input.issue !== 'demo') return fail(input.issue, input.source === 'demo' ? 'demo' : 'unavailable');
    if (input.source === 'demo' || input.issue === 'demo') {
        const demo = assessSeries(input.bars, expectedSession);
        return {
            ...base,
            ...demo.partial,
            ok: false,
            executable: false,
            source: 'demo',
            issue: 'demo',
            message: historyIssueMessage('demo'),
        };
    }
    if (input.source !== 'finnhub-candle') return fail('missing', 'unavailable');
    if (!input.bars) return fail('missing');

    const series = assessSeries(input.bars, expectedSession);
    if (series.issue) {
        return {
            ...base,
            ...series.partial,
            ok: false,
            issue: series.issue,
            message: historyIssueMessage(series.issue),
        };
    }

    return {
        ok: true,
        executable: true,
        closes: series.partial.closes,
        dates: series.partial.dates,
        source: 'finnhub-candle',
        latestBarDate: series.partial.latestBarDate,
        expectedSession,
        issue: null,
        message: `已核對 ${series.partial.closes.length} 根日線，最新是 ${series.partial.latestBarDate}（紐約最近一個已完成交易日）。`,
    };
}

function assessSeries(bars: DailyBar[] | null, expectedSession: string): {
    issue: DataIssue | null;
    partial: { closes: number[]; dates: string[]; latestBarDate: string | null };
} {
    const empty = { closes: [] as number[], dates: [] as string[], latestBarDate: null as string | null };
    if (!bars) return { issue: 'missing', partial: empty };

    const cleaned: DailyBar[] = [];
    for (const bar of bars) {
        if (!bar || !DATE_RE.test(bar.date) || !Number.isFinite(bar.close)) {
            return { issue: 'invalid', partial: empty };
        }
        cleaned.push({ date: bar.date, close: bar.close });
    }
    cleaned.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    const farFuture = cleaned.filter((bar) => calendarDaysBetween(expectedSession, bar.date) > 4);
    if (farFuture.length > 0) return { issue: 'future', partial: empty };

    const usable = cleaned.filter((bar) => bar.date <= expectedSession);
    const dates: string[] = [];
    const closes: number[] = [];
    for (const bar of usable) {
        if (dates.length > 0 && dates[dates.length - 1] === bar.date) {
            const previous = closes[closes.length - 1];
            if (previous !== bar.close) return { issue: 'duplicate_date', partial: empty };
            continue;
        }
        if (!(bar.close > 0)) return { issue: 'non_positive', partial: empty };
        if (!isNyseTradingDay(bar.date)) return { issue: 'non_trading_day', partial: empty };
        if (dates.length > 0 && calendarDaysBetween(dates[dates.length - 1], bar.date) > 10) {
            return { issue: 'gap', partial: empty };
        }
        dates.push(bar.date);
        closes.push(bar.close);
    }

    const latestBarDate = dates.length ? dates[dates.length - 1] : null;
    const partial = { closes, dates, latestBarDate };
    if (closes.length < MIN_DATED_CLOSES) return { issue: 'insufficient', partial };
    if (latestBarDate !== expectedSession) return { issue: 'stale', partial };
    return { issue: null, partial };
}
