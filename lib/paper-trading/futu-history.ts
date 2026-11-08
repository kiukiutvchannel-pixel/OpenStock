/**
 * PAPER TRADING ONLY — read daily US closes from a local FutuOpenD.
 * Uses the official `futu-api` Node WebSocket client (history kline only).
 * Quotes stay on Finnhub. No brokerage route, and this file must not grow
 * beyond that one history request.
 */

import type { DailyBar } from '@/lib/paper-trading/history';
import type { DataIssue } from '@/lib/paper-trading/messages';

/** Qot_Common.QotMarket.QotMarket_US_Security in futu-api 10.12. */
export const FUTU_US_MARKET = 11;
/** Qot_Common.KLType.KLType_Day */
export const FUTU_KL_DAY = 2;
/** Qot_Common.RehabType.RehabType_Forward (forward-adjusted closes). */
export const FUTU_REHAB_FORWARD = 1;

const LOGIN_TIMEOUT_MS = 8_000;
const HISTORY_TIMEOUT_MS = 12_000;

export type FutuKlineRow = {
    time?: string;
    closePrice?: number | string;
    isBlank?: boolean;
};

export type FutuHistoryResult =
    | { ok: true; rows: FutuKlineRow[] }
    | { ok: false; issue: DataIssue };

export type FutuHistoryRequest = (
    security: { market: number; code: string },
    beginTime: string,
    endTime: string,
) => Promise<FutuHistoryResult>;

type FutuSocket = {
    start: (ip: string, port: number, ssl: boolean, key: string) => void;
    onlogin: ((ok: boolean, message: unknown) => void) | null;
    RequestHistoryKL: (req: { c2s: Record<string, unknown> }) => Promise<{
        retType?: number;
        retMsg?: string;
        errCode?: number;
        s2c?: { klList?: FutuKlineRow[] };
    }>;
    stop: () => void;
    websock?: { close?: () => void; onerror: ((error: unknown) => void) | null };
};

export function toFutuUsSymbol(symbol: string): string | null {
    const code = symbol.trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9.]{0,12}$/.test(code)) return null;
    return `US.${code}`;
}

export function futuUsSecurity(symbol: string): { market: number; code: string } | null {
    const full = toFutuUsSymbol(symbol);
    if (!full) return null;
    return { market: FUTU_US_MARKET, code: full.slice(3) };
}

export function readFutuHistoryConfig(env: Record<string, string | undefined> = process.env): {
    host: string;
    port: number;
    key: string;
} | null {
    if ((env.HISTORY_PROVIDER || '').trim().toLowerCase() !== 'futu') return null;
    const host = (env.FUTU_OPEND_HOST || '127.0.0.1').trim() || '127.0.0.1';
    const port = Number((env.FUTU_OPEND_PORT || '33333').trim());
    if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
    return { host, port, key: (env.FUTU_OPEND_KEY || '').trim() };
}

/** Map an OpenD history response onto a fail-closed issue. Never returns a trade. */
export function classifyFutuRet(retMsg: string): DataIssue {
    if (/quota|额度|額度|频率|頻率|too frequent|frequency|请求过于频繁|請求過於頻繁/i.test(retMsg)) return 'futu_quota';
    if (/permission|no right|无权|無權|权限|權限|quote right|authority/i.test(retMsg)) return 'futu_permission';
    return 'invalid';
}

export function klineRowsToBars(rows: FutuKlineRow[]): DailyBar[] {
    const bars: DailyBar[] = [];
    for (const row of rows) {
        if (row.isBlank) continue;
        const match = String(row.time ?? '').match(/^(\d{4}-\d{2}-\d{2})/);
        const close = typeof row.closePrice === 'number' ? row.closePrice : Number(row.closePrice);
        if (!match || !Number.isFinite(close)) continue;
        bars.push({ date: match[1], close });
    }
    return bars;
}

function ymd(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function windowFor(now: Date): { beginTime: string; endTime: string } {
    const begin = new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000);
    const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return { beginTime: ymd(begin), endTime: ymd(end) };
}

function shutdown(client: FutuSocket) {
    try {
        client.websock?.close?.();
    } catch {
        /* already closed */
    }
    try {
        client.stop();
    } catch {
        /* already stopped */
    }
}

function login(client: FutuSocket, host: string, port: number, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (ok: boolean) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (ok) resolve();
            else reject(new Error('opend-down'));
        };
        const timer = setTimeout(() => finish(false), LOGIN_TIMEOUT_MS);
        client.onlogin = (ok) => finish(ok);
        client.start(host, port, false, key);
        const socket = client.websock;
        if (socket) {
            const previous = socket.onerror;
            socket.onerror = (error) => {
                if (typeof previous === 'function') previous(error);
                finish(false);
            };
        }
    });
}

async function requestFutuHistory(
    security: { market: number; code: string },
    beginTime: string,
    endTime: string,
): Promise<FutuHistoryResult> {
    const config = readFutuHistoryConfig();
    if (!config) return { ok: false, issue: 'opend_down' };
    const imported = await import('futu-api') as { default: new () => FutuSocket };
    const client = new imported.default();
    try {
        await login(client, config.host, config.port, config.key);
        const response = await client.RequestHistoryKL({
            c2s: {
                rehabType: FUTU_REHAB_FORWARD,
                klType: FUTU_KL_DAY,
                security,
                beginTime,
                endTime,
                maxAckKLNum: 300,
                extendedTime: false,
            },
        });
        if (response.retType !== 0) return { ok: false, issue: classifyFutuRet(response.retMsg ?? '') };
        return { ok: true, rows: response.s2c?.klList ?? [] };
    } catch (error) {
        const retMsg = typeof error === 'object' && error && 'retMsg' in error ? String((error as { retMsg?: unknown }).retMsg ?? '') : '';
        if (retMsg) return { ok: false, issue: classifyFutuRet(retMsg) };
        console.error('[paper] futu history unavailable issue=opend_down');
        return { ok: false, issue: 'opend_down' };
    } finally {
        shutdown(client);
    }
}

export async function fetchFutuDailyBars(
    symbol: string,
    now: Date,
    request: FutuHistoryRequest = requestFutuHistory,
): Promise<{ bars: DailyBar[] | null; issue: DataIssue | null }> {
    const security = futuUsSecurity(symbol);
    if (!security) return { bars: null, issue: 'invalid' };
    const { beginTime, endTime } = windowFor(now);
    let result: FutuHistoryResult;
    try {
        result = await Promise.race([
            request(security, beginTime, endTime),
            new Promise<FutuHistoryResult>((resolve) => {
                setTimeout(() => resolve({ ok: false, issue: 'opend_down' }), HISTORY_TIMEOUT_MS);
            }),
        ]);
    } catch {
        return { bars: null, issue: 'opend_down' };
    }
    if (!result.ok) return { bars: null, issue: result.issue };
    return { bars: klineRowsToBars(result.rows), issue: null };
}
