import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { tradingDaysEnding } from '@/lib/paper-trading/calendar';
import {
    classifyFutuRet,
    fetchFutuDailyBars,
    futuUsSecurity,
    klineRowsToBars,
    toFutuUsSymbol,
    FUTU_US_MARKET,
} from '@/lib/paper-trading/futu-history';
import { historySourceLabel } from '@/lib/paper-trading/labels';
import { historyIssueMessage } from '@/lib/paper-trading/messages';
import { fetchDailyBars } from '@/lib/paper-trading/quotes';
import { analyzeFromData } from '@/lib/paper-trading/strategy';
import type { PaperQuote } from '@/lib/paper-trading/quotes';

const NOW = new Date('2026-11-04T21:30:00.000Z');
const savedProvider = process.env.HISTORY_PROVIDER;
const savedFinnhub = process.env.FINNHUB_API_KEY;

afterEach(() => {
    if (savedProvider === undefined) delete process.env.HISTORY_PROVIDER;
    else process.env.HISTORY_PROVIDER = savedProvider;
    if (savedFinnhub === undefined) delete process.env.FINNHUB_API_KEY;
    else process.env.FINNHUB_API_KEY = savedFinnhub;
});

describe('Futu US symbol mapping', () => {
    it('maps tickers to US.AAPL style codes and the US market id', () => {
        expect(toFutuUsSymbol('aapl')).toBe('US.AAPL');
        expect(toFutuUsSymbol('BRK.B')).toBe('US.BRK.B');
        expect(toFutuUsSymbol('bad symbol')).toBeNull();
        expect(futuUsSecurity('MSFT')).toEqual({ market: FUTU_US_MARKET, code: 'MSFT' });
        expect(FUTU_US_MARKET).toBe(11);
    });
});

describe('Futu history errors stay fail-closed', () => {
    it('classifies OpenD outages, missing quote rights, and quota', () => {
        expect(classifyFutuRet('历史K线额度不足')).toBe('futu_quota');
        expect(classifyFutuRet('no quote right for this symbol')).toBe('futu_permission');
        expect(historyIssueMessage('opend_down')).toContain('富途 OpenD');
        expect(historyIssueMessage('opend_down')).toContain('WebSocket');
        expect(historyIssueMessage('futu_permission')).toContain('行情權限');
        expect(historyIssueMessage('futu_quota')).toContain('額度');
        expect(historySourceLabel('futu-opend')).toBe('富途 OpenD');
    });

    it('turns dated kline rows into closes and skips blank rows', () => {
        const bars = klineRowsToBars([
            { time: '2026-11-03 00:00:00', closePrice: '100.5', isBlank: false },
            { time: '2026-11-04', closePrice: 101, isBlank: true },
            { time: 'not-a-date', closePrice: 1 },
        ]);
        expect(bars).toEqual([{ date: '2026-11-03', close: 100.5 }]);
    });

    it('does not call Finnhub when OpenD returns daily bars', async () => {
        process.env.HISTORY_PROVIDER = 'futu';
        let finnhub = 0;
        const dates = tradingDaysEnding('2026-11-04', 30);
        const fetched = await fetchDailyBars('AAPL', NOW, async () => {
            finnhub += 1;
            return new Response('no', { status: 403 });
        }, async (security) => {
            expect(security).toEqual({ market: 11, code: 'AAPL' });
            return { ok: true, rows: dates.map((date, index) => ({ time: date, closePrice: 100 + index })) };
        });
        expect(finnhub).toBe(0);
        expect(fetched.source).toBe('futu-opend');
        expect(fetched.issue).toBeNull();
        expect(fetched.bars?.[0]?.date).toBe(dates[0]);
        expect(fetched.bars?.at(-1)?.date).toBe('2026-11-04');
    });

    it('falls back to Finnhub candles, then keeps the OpenD error if that also fails', async () => {
        process.env.HISTORY_PROVIDER = 'futu';
        process.env.FINNHUB_API_KEY = 'not-a-real-key';
        const down = await fetchDailyBars('AAPL', NOW, async () => new Response('no', { status: 403 }), async () => ({ ok: false, issue: 'opend_down' }));
        expect(down.source).toBe('unavailable');
        expect(down.issue).toBe('opend_down');
        expect(down.bars).toBeNull();

        const permission = await fetchDailyBars('AAPL', NOW, async () => new Response('no', { status: 429 }), async () => ({ ok: false, issue: 'futu_permission' }));
        expect(permission.issue).toBe('futu_permission');

        const quota = await fetchDailyBars('MSFT', NOW, async () => new Response('', { status: 500 }), async () => ({ ok: false, issue: 'futu_quota' }));
        expect(quota.issue).toBe('futu_quota');
    });

    it('uses Finnhub candles when OpenD fails but Finnhub still returns a series', async () => {
        process.env.HISTORY_PROVIDER = 'futu';
        process.env.FINNHUB_API_KEY = 'not-a-real-key';
        const fetched = await fetchDailyBars('AAPL', NOW, async () => new Response(JSON.stringify({
            s: 'ok',
            t: [1_762_300_800],
            c: [123.45],
        }), { status: 200, headers: { 'content-type': 'application/json' } }), async () => ({ ok: false, issue: 'opend_down' }));
        expect(fetched.source).toBe('finnhub-candle');
        expect(fetched.bars?.[0]?.close).toBe(123.45);
    });

    it('still refuses an executable signal without a real Finnhub quote', () => {
        const dates = tradingDaysEnding('2026-11-04', 21);
        const bars = dates.map((date, index) => ({ date, close: index < 20 ? 100 : 160 }));
        const quote: PaperQuote = {
            symbol: 'AAPL',
            price: 160,
            change: 1,
            changePercent: 1,
            source: 'finnhub',
            asOf: '2026-11-04T21:00:00.000Z',
            executable: true,
            issue: null,
            message: 'Finnhub 報價',
        };
        const result = analyzeFromData({
            symbol: 'AAPL',
            bars,
            historySource: 'futu-opend',
            quote,
            recommendation: 'buy',
            recommendationNote: '分析師評級偏向買入，只供參考。',
            now: NOW,
            demo: false,
        });
        expect(result.history.source).toBe('futu-opend');
        expect(result.action).toBe('buy');
        expect(result.executable).toBe(true);
        expect(result.quote.source).toBe('finnhub');

        const blocked = analyzeFromData({
            symbol: 'AAPL',
            bars: null,
            historySource: 'unavailable',
            historyIssue: 'opend_down',
            quote,
            recommendation: 'buy',
            recommendationNote: '',
            now: NOW,
            demo: false,
        });
        expect(blocked.executable).toBe(false);
        expect(blocked.action).toBe('hold');
        expect(blocked.rationale).toContain('富途 OpenD');
    });

    it('keeps the history module to a single read-only kline request', () => {
        const source = readFileSync('lib/paper-trading/futu-history.ts', 'utf8');
        for (const banned of ['PlaceOrder', 'UnlockTrade', 'ModifyOrder', 'GetAccList', 'Trd_', 'place_order', 'unlock_trade']) {
            expect(source).not.toContain(banned);
        }
        expect(source).toContain('RequestHistoryKL');
    });
});
