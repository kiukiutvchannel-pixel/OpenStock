/**
 * PAPER TRADING ONLY — real Finnhub quotes and daily candles.
 * Missing keys, 401/403, 429, timeouts, and bad payloads fail closed.
 * Fictional series are returned only when PAPER_TRADING_DEMO=1, and they are
 * labeled demo so they cannot be mistaken for Finnhub or sent as auto orders.
 * Not financial advice. Never routes to a live broker.
 */

import { MAX_OPEN_QUOTE_AGE_MS } from '@/lib/paper-trading/constants';
import {
    isRegularSessionOpen,
    latestCompletedSession,
    sessionDateFromUnix,
    tradingDaysEnding,
    zonedParts,
} from '@/lib/paper-trading/calendar';
import type { DailyBar } from '@/lib/paper-trading/history';
import {
    classifyFetchError,
    classifyHttpStatus,
    quoteIssueMessage,
    type DataIssue,
} from '@/lib/paper-trading/messages';

export type QuoteSource = 'finnhub' | 'demo' | 'unavailable';

export type PaperQuote = {
    symbol: string;
    price: number | null;
    change: number | null;
    changePercent: number | null;
    source: QuoteSource;
    /** ISO time of the provider trade, distinct from the daily-bar session date. */
    asOf: string | null;
    executable: boolean;
    issue: DataIssue | null;
    message: string;
};

export type FetchedBars = {
    bars: DailyBar[] | null;
    source: 'finnhub-candle' | 'demo' | 'unavailable';
    issue: DataIssue | null;
};

const FETCH_TIMEOUT_MS = 8000;

export function isExplicitDemoMode(env: Record<string, string | undefined> = process.env): boolean {
    return env.PAPER_TRADING_DEMO === '1';
}

export function finnhubKeys(env: NodeJS.ProcessEnv = process.env): string[] {
    return (env.FINNHUB_API_KEYS || env.FINNHUB_API_KEY || env.NEXT_PUBLIC_FINNHUB_API_KEY || '')
        .split(',')
        .map((key) => key.trim())
        .filter(Boolean);
}

function hash01(input: string): number {
    let h = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 0xffffffff;
}

export function assessQuote(quote: Pick<PaperQuote, 'source' | 'price' | 'asOf'>, now: Date): Pick<PaperQuote, 'executable' | 'issue' | 'message'> {
    if (quote.source === 'demo') {
        return { executable: false, issue: 'demo', message: quoteIssueMessage('demo') };
    }
    if (quote.source !== 'finnhub' || quote.price == null || !(quote.price > 0) || !quote.asOf) {
        return { executable: false, issue: 'missing', message: quoteIssueMessage('missing') };
    }
    const asOf = new Date(quote.asOf);
    if (Number.isNaN(asOf.getTime()) || asOf.getTime() > now.getTime() + 5 * 60 * 1000) {
        return { executable: false, issue: 'invalid', message: quoteIssueMessage('invalid') };
    }
    const quoteDay = zonedParts(asOf).ymd;
    const expected = latestCompletedSession(now);
    if (isRegularSessionOpen(now)) {
        const today = zonedParts(now).ymd;
        if (quoteDay !== today || now.getTime() - asOf.getTime() > MAX_OPEN_QUOTE_AGE_MS) {
            return { executable: false, issue: 'stale', message: quoteIssueMessage('stale') };
        }
        return { executable: true, issue: null, message: 'Finnhub 報價（盤中，已核對時間）' };
    }
    if (quoteDay !== expected) {
        return { executable: false, issue: 'stale', message: quoteIssueMessage('stale') };
    }
    return { executable: true, issue: null, message: 'Finnhub 報價（對應最近一個已完成交易日）' };
}

function unavailableQuote(symbol: string, issue: DataIssue): PaperQuote {
    return {
        symbol,
        price: null,
        change: null,
        changePercent: null,
        source: 'unavailable',
        asOf: null,
        executable: false,
        issue,
        message: quoteIssueMessage(issue),
    };
}

export function demoQuote(symbol: string, now: Date): PaperQuote {
    const ticker = symbol.toUpperCase();
    const base = 50 + hash01(ticker) * 450;
    const dayFrac = hash01(`${ticker}:${zonedParts(now).ymd}`);
    const changePercent = (dayFrac - 0.5) * 4;
    const price = Math.round(base * (1 + changePercent / 100) * 100) / 100;
    const change = Math.round((price - base) * 100) / 100;
    return {
        symbol: ticker,
        price,
        change,
        changePercent: Math.round(changePercent * 100) / 100,
        source: 'demo',
        asOf: now.toISOString(),
        executable: false,
        issue: 'demo',
        message: quoteIssueMessage('demo'),
    };
}

export function demoDailyBars(symbol: string, now: Date): DailyBar[] {
    const end = latestCompletedSession(now);
    const dates = tradingDaysEnding(end, 40);
    const quote = demoQuote(symbol, now);
    let price = quote.price ?? 100;
    const closes: number[] = [];
    for (let i = dates.length - 1; i >= 0; i -= 1) {
        const wobble = (hash01(`${symbol}:${dates[i]}`) - 0.5) * 0.02;
        price = Math.max(1, price * (1 + wobble));
        closes.push(Math.round(price * 100) / 100);
    }
    closes.reverse();
    closes[closes.length - 1] = quote.price ?? closes[closes.length - 1];
    return dates.map((date, index) => ({ date, close: closes[index] }));
}

async function readResponse(url: string, key: string, fetcher: typeof fetch): Promise<{ ok: true; status: number; body: unknown } | { ok: false; issue: DataIssue }> {
    try {
        const response = await fetcher(url, {
            headers: { 'X-Finnhub-Token': key },
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            cache: 'no-store',
        });
        if (!response.ok) return { ok: false, issue: classifyHttpStatus(response.status) };
        return { ok: true, status: response.status, body: await response.json() };
    } catch (error) {
        return { ok: false, issue: classifyFetchError(error) };
    }
}

export async function fetchDailyBars(symbol: string, now = new Date(), fetcher: typeof fetch = fetch): Promise<FetchedBars> {
    const ticker = symbol.trim().toUpperCase();
    if (isExplicitDemoMode()) {
        return { bars: demoDailyBars(ticker, now), source: 'demo', issue: null };
    }
    const keys = finnhubKeys();
    if (keys.length === 0) return { bars: null, source: 'unavailable', issue: 'missing' };

    const to = Math.floor(now.getTime() / 1000);
    const from = to - 60 * 60 * 24 * 160;
    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(ticker)}&resolution=D&from=${from}&to=${to}`;
    const result = await readResponse(url, keys[0], fetcher);
    if (!result.ok) {
        console.error(`[paper] candle unavailable symbol=${ticker} issue=${result.issue}`);
        return { bars: null, source: 'unavailable', issue: result.issue };
    }
    const data = result.body as { s?: string; c?: unknown; t?: unknown };
    if (data.s === 'no_data') return { bars: [], source: 'finnhub-candle', issue: null };
    if (data.s !== 'ok' || !Array.isArray(data.c) || !Array.isArray(data.t)) {
        return { bars: null, source: 'unavailable', issue: 'invalid' };
    }
    const bars: DailyBar[] = [];
    for (let i = 0; i < data.c.length; i += 1) {
        const close = data.c[i];
        const stamp = data.t[i];
        if (typeof close !== 'number' || typeof stamp !== 'number') continue;
        const date = sessionDateFromUnix(stamp);
        if (!date) continue;
        bars.push({ date, close });
    }
    return { bars, source: 'finnhub-candle', issue: null };
}

export async function resolvePaperQuote(symbol: string, now = new Date(), fetcher: typeof fetch = fetch): Promise<PaperQuote> {
    const ticker = symbol.trim().toUpperCase();
    if (isExplicitDemoMode()) return demoQuote(ticker, now);
    const keys = finnhubKeys();
    if (keys.length === 0) return unavailableQuote(ticker, 'missing');

    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}`;
    const result = await readResponse(url, keys[0], fetcher);
    if (!result.ok) {
        console.error(`[paper] quote unavailable symbol=${ticker} issue=${result.issue}`);
        return unavailableQuote(ticker, result.issue);
    }
    const data = result.body as { c?: number; d?: number; dp?: number; t?: number };
    if (typeof data.c !== 'number' || !(data.c > 0) || typeof data.t !== 'number' || !(data.t > 0)) {
        return unavailableQuote(ticker, 'invalid');
    }
    const draft: PaperQuote = {
        symbol: ticker,
        price: data.c,
        change: typeof data.d === 'number' ? data.d : null,
        changePercent: typeof data.dp === 'number' ? data.dp : null,
        source: 'finnhub',
        asOf: new Date(data.t * 1000).toISOString(),
        executable: false,
        issue: null,
        message: '',
    };
    const assessed = assessQuote(draft, now);
    return { ...draft, ...assessed };
}

export type AnalystBias = 'buy' | 'sell' | 'hold' | null;

/** Descriptive only. Failures become a note and never a trade. */
export async function fetchAnalystBias(symbol: string, fetcher: typeof fetch = fetch): Promise<{ bias: AnalystBias; note: string }> {
    if (isExplicitDemoMode()) {
        return { bias: null, note: '示範模式不讀取分析師評級。' };
    }
    const keys = finnhubKeys();
    if (keys.length === 0) return { bias: null, note: '未設定供應商，沒有分析師評級。' };
    const ticker = symbol.trim().toUpperCase();
    const url = `https://finnhub.io/api/v1/stock/recommendation?symbol=${encodeURIComponent(ticker)}`;
    const result = await readResponse(url, keys[0], fetcher);
    if (!result.ok) {
        return { bias: null, note: '分析師評級暫時讀不到（供應商拒絕、限速或網絡問題）。這不會改變觀望，也不會因此落單。' };
    }
    const rows = result.body as Array<{ buy?: number; hold?: number; sell?: number; strongBuy?: number; strongSell?: number }>;
    const latest = Array.isArray(rows) ? rows[0] : undefined;
    if (!latest) return { bias: null, note: '供應商沒有分析師評級。' };
    const bull = (latest.buy ?? 0) + (latest.strongBuy ?? 0);
    const bear = (latest.sell ?? 0) + (latest.strongSell ?? 0);
    if (bull > bear + 2) return { bias: 'buy', note: '分析師評級偏向買入，只供參考，不會在沒有均線交叉時落單。' };
    if (bear > bull + 2) return { bias: 'sell', note: '分析師評級偏向賣出，只供參考，不會在沒有均線交叉時落單。' };
    return { bias: 'hold', note: '分析師評級偏向觀望，只供參考。' };
}
