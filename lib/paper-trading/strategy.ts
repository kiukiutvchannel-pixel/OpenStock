/**
 * PAPER TRADING ONLY — SMA(10)/SMA(20) cross on validated daily closes.
 * Analyst text is descriptive. It never turns a hold into a buy or sell.
 * There is no win-probability score. Not financial advice.
 *
 * Upstream: Open-Dev-Society/OpenStock (AGPL-3.0). See PAPER-TRADING-NOTICE.md.
 */

import { SMA_FAST, SMA_SLOW, STRATEGY_ID } from '@/lib/paper-trading/constants';
import { assessDailyHistory, type DailyBar, type HistorySource } from '@/lib/paper-trading/history';
import { FILL_MESSAGES, type DataIssue } from '@/lib/paper-trading/messages';
import {
    assessQuote,
    fetchAnalystBias,
    fetchDailyBars,
    isExplicitDemoMode,
    resolvePaperQuote,
    type AnalystBias,
    type PaperQuote,
} from '@/lib/paper-trading/quotes';

export type StrategyAction = 'buy' | 'sell' | 'hold';

export type StrategyResult = {
    symbol: string;
    action: StrategyAction;
    strategy: string;
    executable: boolean;
    blockReason: string | null;
    rationale: string;
    barTimestamp: string | null;
    quote: PaperQuote;
    history: {
        source: HistorySource;
        latestBarDate: string | null;
        expectedSession: string;
        barCount: number;
        issue: DataIssue | null;
        message: string;
    };
    recommendation: AnalystBias;
    recommendationNote: string;
    metrics: Record<string, number | string | null>;
};

function sma(values: number[], period: number): number | null {
    if (values.length < period) return null;
    let sum = 0;
    for (let i = values.length - period; i < values.length; i += 1) sum += values[i];
    return sum / period;
}

function roundMetric(value: number | null): number | null {
    if (value == null || !Number.isFinite(value)) return null;
    return Math.round(value * 100) / 100;
}

export function analyzeFromData(input: {
    symbol: string;
    bars: DailyBar[] | null;
    historySource: HistorySource;
    historyIssue?: DataIssue | null;
    quote: PaperQuote;
    recommendation: AnalystBias;
    recommendationNote: string;
    now: Date;
    demo?: boolean;
}): StrategyResult {
    const ticker = input.symbol.trim().toUpperCase();
    const demo = input.demo ?? isExplicitDemoMode();
    const history = assessDailyHistory({
        bars: input.bars,
        now: input.now,
        source: input.historySource,
        issue: input.historyIssue,
    });

    let action: StrategyAction = 'hold';
    let cross: 'up' | 'down' | 'none' = 'none';
    let fast: number | null = null;
    let slow: number | null = null;
    let prevFast: number | null = null;
    let prevSlow: number | null = null;

    if (history.ok && history.executable) {
        const closes = history.closes;
        fast = sma(closes, SMA_FAST);
        slow = sma(closes, SMA_SLOW);
        const previous = closes.slice(0, -1);
        prevFast = sma(previous, SMA_FAST);
        prevSlow = sma(previous, SMA_SLOW);
        if (fast != null && slow != null && prevFast != null && prevSlow != null) {
            if (prevFast <= prevSlow && fast > slow) {
                action = 'buy';
                cross = 'up';
            } else if (prevFast >= prevSlow && fast < slow) {
                action = 'sell';
                cross = 'down';
            }
        }
    }

    const judgedQuote = assessQuote(input.quote, input.now);
    const quote: PaperQuote = { ...input.quote, ...judgedQuote };
    const quoteExecutable = quote.source === 'finnhub' && quote.executable && !demo;
    const realHistory = history.source === 'finnhub-candle' || history.source === 'futu-opend';
    const historyExecutable = history.ok && history.executable && realHistory && !demo;
    const executable = historyExecutable && quoteExecutable && (action === 'buy' || action === 'sell');

    let blockReason: string | null = null;
    if (!historyExecutable) blockReason = history.message;
    else if (!quoteExecutable) blockReason = quote.message || input.quote.message;
    else if (action === 'hold') blockReason = FILL_MESSAGES.no_cross;
    if (demo) blockReason = history.message;

    let rationale: string;
    if (!history.ok || !history.executable) {
        rationale = history.message;
    } else if (cross === 'up' && fast != null && slow != null) {
        rationale = `SMA(10) 向上穿越 SMA(20)（${fast.toFixed(2)} > ${slow.toFixed(2)}）。K 線日期 ${history.latestBarDate}。`;
    } else if (cross === 'down' && fast != null && slow != null) {
        rationale = `SMA(10) 向下穿越 SMA(20)（${fast.toFixed(2)} < ${slow.toFixed(2)}）。K 線日期 ${history.latestBarDate}。`;
    } else if (fast != null && slow != null && fast > slow) {
        rationale = `升勢仍在（SMA10 ${fast.toFixed(2)} > SMA20 ${slow.toFixed(2)}），但沒有新的交叉，所以維持觀望，不會落單。`;
    } else if (fast != null && slow != null) {
        rationale = `沒有新的交叉（SMA10 ${fast.toFixed(2)}，SMA20 ${slow.toFixed(2)}），維持觀望，不會落單。`;
    } else {
        rationale = '均線未能計算，維持觀望，不會落單。';
    }
    if (input.recommendationNote) rationale = `${rationale} ${input.recommendationNote}`;

    return {
        symbol: ticker,
        action,
        strategy: STRATEGY_ID,
        executable,
        blockReason: executable ? null : blockReason,
        rationale: `[只限模擬] ${rationale}`,
        barTimestamp: history.latestBarDate,
        quote,
        history: {
            source: history.source,
            latestBarDate: history.latestBarDate,
            expectedSession: history.expectedSession,
            barCount: history.closes.length,
            issue: history.issue,
            message: history.message,
        },
        recommendation: input.recommendation,
        recommendationNote: input.recommendationNote,
        metrics: {
            price: input.quote.price,
            sma10: roundMetric(fast),
            sma20: roundMetric(slow),
            prevSma10: roundMetric(prevFast),
            prevSma20: roundMetric(prevSlow),
            seriesSource: history.source,
            quoteSource: input.quote.source,
            historyAsOf: history.latestBarDate,
            quoteAsOf: input.quote.asOf,
            expectedSession: history.expectedSession,
            recommendation: input.recommendation,
            cross,
        },
    };
}

export function shouldAutoOrder(result: StrategyResult, autoEnabled: boolean, demo = isExplicitDemoMode()): boolean {
    if (!autoEnabled || demo) return false;
    if (!result.executable) return false;
    return result.action === 'buy' || result.action === 'sell';
}

export async function analyzeSymbol(symbol: string, now = new Date(), fetcher: typeof fetch = fetch): Promise<StrategyResult> {
    const ticker = symbol.trim().toUpperCase();
    const [bars, quote, analyst] = await Promise.all([
        fetchDailyBars(ticker, now, fetcher),
        resolvePaperQuote(ticker, now, fetcher),
        fetchAnalystBias(ticker, fetcher),
    ]);
    return analyzeFromData({
        symbol: ticker,
        bars: bars.bars,
        historySource: bars.source,
        historyIssue: bars.issue,
        quote,
        recommendation: analyst.bias,
        recommendationNote: analyst.note,
        now,
        demo: isExplicitDemoMode(),
    });
}
