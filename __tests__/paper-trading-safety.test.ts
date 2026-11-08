import { afterEach, describe, expect, it } from 'vitest';
import { latestCompletedSession, tradingDaysEnding } from '@/lib/paper-trading/calendar';
import { decideFill, defaultExposureLimits, exposureLimitsFromEnv, sizeAutoBuy, sizeAutoSell } from '@/lib/paper-trading/exposure';
import { buildIdempotencyKey, createSerializedBook, MemoryClaimStore } from '@/lib/paper-trading/idempotency';
import { PaperIdempotency } from '@/database/models/paper-idempotency.model';
import { StrategySignal } from '@/database/models/strategy-signal.model';
import { FILL_MESSAGES } from '@/lib/paper-trading/messages';
import { assessQuote, demoQuote, fetchDailyBars, isExplicitDemoMode, resolvePaperQuote } from '@/lib/paper-trading/quotes';
import { analyzeFromData, shouldAutoOrder, type StrategyResult } from '@/lib/paper-trading/strategy';
import type { PaperQuote } from '@/lib/paper-trading/quotes';

const NOW = new Date('2026-11-04T21:30:00.000Z'); // 16:30 America/New_York, after the close
const SESSION = '2026-11-04';

const savedEnv = {
    FINNHUB_API_KEY: process.env.FINNHUB_API_KEY,
    FINNHUB_API_KEYS: process.env.FINNHUB_API_KEYS,
    NEXT_PUBLIC_FINNHUB_API_KEY: process.env.NEXT_PUBLIC_FINNHUB_API_KEY,
    PAPER_TRADING_DEMO: process.env.PAPER_TRADING_DEMO,
};

afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
});

function clearProviderEnv() {
    delete process.env.FINNHUB_API_KEY;
    delete process.env.FINNHUB_API_KEYS;
    delete process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
    delete process.env.PAPER_TRADING_DEMO;
}

function bars(closes: number[], end = SESSION) {
    const dates = tradingDaysEnding(end, closes.length);
    return dates.map((date, index) => ({ date, close: closes[index] }));
}

function liveQuote(overrides: Partial<PaperQuote> = {}): PaperQuote {
    const quote: PaperQuote = {
        symbol: 'AAPL',
        price: 160,
        change: 1,
        changePercent: 0.6,
        source: 'finnhub',
        asOf: '2026-11-04T21:00:00.000Z',
        executable: true,
        issue: null,
        message: 'Finnhub 報價',
        ...overrides,
    };
    return quote;
}

function analyze(overrides: Partial<Parameters<typeof analyzeFromData>[0]> = {}): StrategyResult {
    const closes = Array.from({ length: 21 }, (_, index) => (index < 20 ? 100 : 160));
    return analyzeFromData({
        symbol: 'AAPL',
        bars: bars(closes),
        historySource: 'finnhub-candle',
        quote: liveQuote(),
        recommendation: null,
        recommendationNote: '',
        now: NOW,
        demo: false,
        ...overrides,
    });
}

describe('calendar freshness', () => {
    it('uses the completed NYSE session, including weekends and the July 3 2026 holiday', () => {
        expect(latestCompletedSession(NOW)).toBe(SESSION);
        expect(latestCompletedSession(new Date('2026-11-07T15:00:00.000Z'))).toBe('2026-11-06');
        expect(latestCompletedSession(new Date('2026-11-04T14:00:00.000Z'))).toBe('2026-11-03');
        expect(latestCompletedSession(new Date('2026-07-03T16:00:00.000Z'))).toBe('2026-07-02');
    });
});

describe('real-data failure modes do not create an executable signal', () => {
    it('does not substitute fictional history when the key is missing', async () => {
        clearProviderEnv();
        let called = false;
        const fetched = await fetchDailyBars('AAPL', NOW, async () => {
            called = true;
            return new Response('no');
        });
        expect(called).toBe(false);
        expect(fetched.source).toBe('unavailable');
        expect(fetched.issue).toBe('missing');
        const result = analyze({ bars: null, historySource: 'unavailable', historyIssue: 'missing', recommendation: 'buy' });
        expect(result.action).toBe('hold');
        expect(result.executable).toBe(false);
        expect(result).not.toHaveProperty('confidence');
        expect(shouldAutoOrder(result, true, false)).toBe(false);
    });

    it('classifies 403, 429, and timeouts without echoing the key or pretending the source is Finnhub', async () => {
        process.env.FINNHUB_API_KEY = 'super-secret-key';
        delete process.env.PAPER_TRADING_DEMO;
        const denied = await fetchDailyBars('AAPL', NOW, async () => new Response('no', { status: 403 }));
        const limited = await resolvePaperQuote('AAPL', NOW, async () => new Response('no', { status: 429 }));
        const timedOut = await fetchDailyBars('MSFT', NOW, async () => {
            throw Object.assign(new Error('timed out'), { name: 'TimeoutError' });
        });
        expect(denied).toMatchObject({ source: 'unavailable', issue: 'permission', bars: null });
        expect(limited.source).toBe('unavailable');
        expect(limited.issue).toBe('rate_limit');
        expect(limited.executable).toBe(false);
        expect(timedOut.issue).toBe('network');
        const result = analyze({
            bars: null,
            historySource: 'unavailable',
            historyIssue: 'permission',
            quote: limited,
            recommendation: 'buy',
            recommendationNote: '分析師評級偏向買入，只供參考。',
        });
        expect(result.action).toBe('hold');
        expect(result.executable).toBe(false);
        expect(JSON.stringify(result)).not.toContain('super-secret-key');
        expect(result.history.source).not.toBe('finnhub-candle');
        expect(result.quote.source).not.toBe('finnhub');
    });

    it('rejects short, stale, gapped, and non-trading history', () => {
        expect(analyze({ bars: bars(Array.from({ length: 10 }, () => 100)) }).executable).toBe(false);
        const stale = analyze({ bars: bars(Array.from({ length: 21 }, () => 100), '2026-11-03') });
        expect(stale.executable).toBe(false);
        expect(stale.action).toBe('hold');
        expect(stale.history.issue).toBe('stale');
        const gapped = analyze({
            bars: [
                { date: '2026-10-01', close: 10 },
                { date: '2026-10-20', close: 11 },
            ],
        });
        expect(gapped.history.issue).toBe('gap');
        expect(analyze({ bars: [{ date: '2026-11-01', close: 10 }] }).history.issue).toBe('non_trading_day');
        expect(shouldAutoOrder(stale, true, false)).toBe(false);
    });

    it('ignores an unfinished session bar and still accepts the previous close', () => {
        const duringSession = new Date('2026-11-04T15:00:00.000Z');
        const closes = Array.from({ length: 22 }, (_, index) => (index < 21 ? 100 : 180));
        const dated = tradingDaysEnding(SESSION, 22).map((date, index) => ({ date, close: closes[index] }));
        const result = analyzeFromData({
            symbol: 'AAPL',
            bars: dated,
            historySource: 'finnhub-candle',
            quote: liveQuote({ asOf: '2026-11-03T21:00:00.000Z' }),
            recommendation: null,
            recommendationNote: '',
            now: duringSession,
            demo: false,
        });
        expect(result.history.expectedSession).toBe('2026-11-03');
        expect(result.history.latestBarDate).toBe('2026-11-03');
        expect(result.history.issue).toBeNull();
        expect(result.quote.executable).toBe(false);
        expect(result.executable).toBe(false);
    });

    it('does not trade a mocked or stale quote even when the cross is real', () => {
        const mocked = analyze({ quote: { ...demoQuote('AAPL', NOW), source: 'demo' } });
        expect(mocked.action).toBe('buy');
        expect(mocked.executable).toBe(false);
        expect(mocked.quote.source).not.toBe('finnhub');
        const staleQuote = liveQuote({ asOf: '2026-11-03T21:00:00.000Z' });
        const judged = assessQuote(staleQuote, NOW);
        expect(judged.executable).toBe(false);
        const result = analyze({ quote: { ...staleQuote, ...judged } });
        expect(result.action).toBe('buy');
        expect(result.executable).toBe(false);
        expect(shouldAutoOrder(result, true, false)).toBe(false);
    });
});

describe('analyst bias never creates a trade without a cross', () => {
    it('keeps an uptrend without a fresh cross on hold', () => {
        const closes = Array.from({ length: 21 }, (_, index) => (index < 11 ? 100 : 110));
        const result = analyze({
            bars: bars(closes),
            quote: liveQuote({ price: 110 }),
            recommendation: 'buy',
            recommendationNote: '分析師評級偏向買入，只供參考，不會在沒有均線交叉時落單。',
        });
        expect(result.action).toBe('hold');
        expect(result.executable).toBe(false);
        expect(result.blockReason).toBe(FILL_MESSAGES.no_cross);
        expect(result.rationale).toContain('只供參考');
        expect(result.rationale).not.toMatch(/\d+(\.\d+)?%/);
        expect(shouldAutoOrder(result, true, false)).toBe(false);
    });
});

describe('valid SMA cross', () => {
    it('buys on a golden cross and sells on a death cross', () => {
        const buy = analyze();
        expect(buy.action).toBe('buy');
        expect(buy.executable).toBe(true);
        expect(buy.strategy).toBe('sma10_sma20_cross');
        expect(buy.barTimestamp).toBe(SESSION);
        expect(buy.history.source).toBe('finnhub-candle');
        expect(buy.quote.source).toBe('finnhub');
        expect(buy.metrics.seriesSource).not.toBe(buy.metrics.quoteSource);
        expect(shouldAutoOrder(buy, true, false)).toBe(true);
        expect(shouldAutoOrder(buy, false, false)).toBe(false);

        const sellCloses = Array.from({ length: 21 }, (_, index) => (index < 20 ? 100 : 40));
        const sell = analyze({ bars: bars(sellCloses), quote: liveQuote({ price: 40 }) });
        expect(sell.action).toBe('sell');
        expect(sell.executable).toBe(true);
    });

    it('accepts the same closes when the provider lists them out of order', () => {
        const ordered = bars(Array.from({ length: 21 }, (_, index) => (index < 20 ? 100 : 160)));
        const reversed = [...ordered].reverse();
        expect(analyze({ bars: reversed }).action).toBe('buy');
    });
});

describe('demo mode is isolated', () => {
    it('only the exact value 1 enables demo, and demo cannot auto-order', async () => {
        expect(isExplicitDemoMode({ PAPER_TRADING_DEMO: 'true' })).toBe(false);
        expect(isExplicitDemoMode({ PAPER_TRADING_DEMO: '1' })).toBe(true);
        process.env.PAPER_TRADING_DEMO = '1';
        process.env.FINNHUB_API_KEY = 'super-secret-key';
        let called = false;
        const fetched = await fetchDailyBars('AAPL', NOW, async () => {
            called = true;
            return new Response('no');
        });
        expect(called).toBe(false);
        expect(fetched.source).toBe('demo');
        const result = analyzeFromData({
            symbol: 'AAPL',
            bars: fetched.bars,
            historySource: 'demo',
            quote: demoQuote('AAPL', NOW),
            recommendation: 'buy',
            recommendationNote: '',
            now: NOW,
            demo: true,
        });
        expect(result.executable).toBe(false);
        expect(result.history.source).toBe('demo');
        expect(shouldAutoOrder(result, true, true)).toBe(false);
        expect(JSON.stringify(result)).not.toContain('super-secret-key');
    });
});

describe('duplicate and concurrent same-bar fills', () => {
    it('lets only one claim win for the same account, symbol, strategy, direction, and bar', async () => {
        const key = buildIdempotencyKey({
            accountId: 'acct-1',
            symbol: 'AAPL',
            strategy: 'sma10_sma20_cross',
            direction: 'buy',
            barTimestamp: SESSION,
        });
        const otherWay = buildIdempotencyKey({
            accountId: 'acct-1',
            symbol: 'AAPL',
            strategy: 'sma10_sma20_cross',
            direction: 'sell',
            barTimestamp: SESSION,
        });
        expect(otherWay).not.toBe(key);
        const store = new MemoryClaimStore();
        const book = createSerializedBook({ cash: 100_000, positions: [] as { symbol: string; qty: number; avgCost: number }[] });
        const limits = defaultExposureLimits();

        const once = () => book.run(async (state) => {
            const claim = await store.claim(key);
            if (claim === 'duplicate') return 'duplicate' as const;
            const decision = decideFill(state, {
                symbol: 'AAPL',
                side: 'buy',
                qty: 10,
                price: 100,
                quoteExecutable: true,
                limits,
                marks: {},
            });
            if (!decision.ok) return decision.code;
            state.cash = decision.book.cash;
            state.positions = decision.book.positions;
            return 'filled' as const;
        });

        const results = await Promise.all(Array.from({ length: 8 }, () => once()));
        expect(results.filter((result) => result === 'filled')).toHaveLength(1);
        expect(results.filter((result) => result === 'duplicate')).toHaveLength(7);
        expect(book.state.cash).toBe(99_000);
        expect(book.state.positions).toEqual([{ symbol: 'AAPL', qty: 10, avgCost: 100 }]);
        expect(await store.claim(otherWay)).toBe('claimed');
    });

    it('persists the claim as a unique key and marks signals as history', () => {
        const key = PaperIdempotency.schema.path('key') as { options: { unique?: boolean } };
        expect(key.options.unique).toBe(true);
        expect(PaperIdempotency.schema.get('collection')).toBe('paper_idempotency');
        expect(StrategySignal.schema.path('confidence').isRequired).toBeFalsy();
        expect(StrategySignal.schema.path('recordKind').options.default).toBe('history');
        expect(StrategySignal.schema.path('executable').options.default).toBe(false);
    });
});

describe('exposure caps', () => {
    const limits = { perSymbolUsd: 10_000, totalUsd: 14_000, autoFraction: 0.05, autoMaxUsd: 5_000 };

    it('rejects a manual buy past the symbol cap and a second symbol past the total cap', () => {
        const start = { cash: 100_000, positions: [] as { symbol: string; qty: number; avgCost: number }[] };
        const tooBig = decideFill(start, {
            symbol: 'AAPL', side: 'buy', qty: 101, price: 100, quoteExecutable: true, limits, marks: {},
        });
        expect(tooBig.ok).toBe(false);
        if (!tooBig.ok) expect(tooBig.code).toBe('exposure_cap');
        expect(start.cash).toBe(100_000);

        const first = decideFill(start, {
            symbol: 'AAPL', side: 'buy', qty: 100, price: 100, quoteExecutable: true, limits, marks: { AAPL: 100 },
        });
        expect(first.ok).toBe(true);
        if (!first.ok) return;
        const second = decideFill(first.book, {
            symbol: 'MSFT', side: 'buy', qty: 50, price: 100, quoteExecutable: true, limits, marks: { AAPL: 100, MSFT: 100 },
        });
        expect(second.ok).toBe(false);
        const fitted = decideFill(first.book, {
            symbol: 'MSFT', side: 'buy', qty: 40, price: 100, quoteExecutable: true, limits, marks: { AAPL: 100, MSFT: 100 },
        });
        expect(fitted.ok).toBe(true);
    });

    it('sizes auto buys inside the fraction, order cap, and remaining room', () => {
        const book = { cash: 100_000, positions: [{ symbol: 'AAPL', qty: 80, avgCost: 100 }] };
        expect(sizeAutoBuy({ book, symbol: 'AAPL', price: 100, limits, marks: { AAPL: 100 } }).qty).toBe(20);
        expect(sizeAutoBuy({
            book: { cash: 100_000, positions: [] },
            symbol: 'AAPL',
            price: 100,
            limits,
            marks: {},
        }).qty).toBe(50);
        expect(sizeAutoBuy({
            book: { cash: 100_000, positions: [{ symbol: 'MSFT', qty: 1, avgCost: 50 }] },
            symbol: 'AAPL',
            price: 100,
            limits,
            marks: { MSFT: null },
        }).code).toBe('exposure_unverified');
        expect(sizeAutoSell(10)).toBe(2);
        expect(sizeAutoSell(0)).toBe(0);
    });

    it('keeps invalid env values on the conservative defaults', () => {
        const parsed = exposureLimitsFromEnv({
            PAPER_MAX_SYMBOL_EXPOSURE_USD: '0',
            PAPER_MAX_TOTAL_EXPOSURE_USD: 'nope',
            PAPER_AUTO_TRADE_FRACTION: '-1',
            PAPER_AUTO_TRADE_MAX_USD: '',
        });
        expect(parsed).toEqual(defaultExposureLimits());
        expect(exposureLimitsFromEnv({
            PAPER_MAX_SYMBOL_EXPOSURE_USD: '80000',
            PAPER_MAX_TOTAL_EXPOSURE_USD: '40000',
        }).perSymbolUsd).toBe(40_000);
    });

    it('refuses a non-executable quote and a sell larger than the position', () => {
        const book = { cash: 1_000, positions: [{ symbol: 'AAPL', qty: 2, avgCost: 50 }] };
        const blocked = decideFill(book, {
            symbol: 'AAPL', side: 'buy', qty: 1, price: 100, quoteExecutable: false, limits, marks: { AAPL: 100 },
        });
        expect(blocked.ok).toBe(false);
        const short = decideFill(book, {
            symbol: 'AAPL', side: 'sell', qty: 3, price: 100, quoteExecutable: true, limits, marks: { AAPL: 100 },
        });
        expect(short.ok).toBe(false);
        if (!short.ok) expect(short.code).toBe('insufficient_shares');
    });
});
