/**
 * PAPER TRADING ONLY — daily US closes from local FutuOpenD over the program TCP port.
 * Official docs (openapi.futunn.com v10.12) put history K-line on protocol 3103,
 * TCP api_port 11111, with a JSON body when the header format flag is 1.
 * They do not document an HTTP history route. Port 22222 there is Telnet.
 * Quotes stay on Finnhub. This module sends InitConnect and one history request.
 */

import { createHash } from 'node:crypto';
import net from 'node:net';
import type { DailyBar } from '@/lib/paper-trading/history';
import type { DataIssue } from '@/lib/paper-trading/messages';

/** Qot_Common.QotMarket.QotMarket_US_Security */
export const FUTU_US_MARKET = 11;
/** Qot_Common.KLType.KLType_Day */
export const FUTU_KL_DAY = 2;
/** Qot_Common.RehabType.RehabType_Forward */
export const FUTU_REHAB_FORWARD = 1;
/** Common.PacketEncAlgo.PacketEncAlgo_None */
export const FUTU_ENC_NONE = -1;

export const FUTU_PROTO_INIT = 1001;
export const FUTU_PROTO_HISTORY_KL = 3103;
export const FUTU_HEADER_LEN = 44;

const CONNECT_TIMEOUT_MS = 5_000;
const REPLY_TIMEOUT_MS = 12_000;

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
} | null {
    if ((env.HISTORY_PROVIDER || '').trim().toLowerCase() !== 'futu') return null;
    const host = (env.FUTU_OPEND_HOST || '127.0.0.1').trim() || '127.0.0.1';
    const port = Number((env.FUTU_OPEND_PORT || '11111').trim());
    if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
    return { host, port };
}

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

/** Official little-endian 44-byte header plus a JSON body. SHA1 covers the body only. */
export function encodeFutuJsonPacket(protoId: number, serial: number, body: unknown): Buffer {
    const json = Buffer.from(JSON.stringify(body), 'utf8');
    const header = Buffer.alloc(FUTU_HEADER_LEN);
    header.write('FT', 0, 'ascii');
    header.writeUInt32LE(protoId, 2);
    header.writeUInt8(1, 6);
    header.writeUInt8(0, 7);
    header.writeUInt32LE(serial >>> 0, 8);
    header.writeUInt32LE(json.length, 12);
    createHash('sha1').update(json).digest().copy(header, 16);
    return Buffer.concat([header, json]);
}

export function decodeFutuPacket(buffer: Buffer): {
    protoId: number;
    serial: number;
    format: number;
    body: Buffer;
    rest: Buffer;
} | null {
    if (buffer.length < FUTU_HEADER_LEN) return null;
    if (buffer.toString('ascii', 0, 2) !== 'FT') {
        throw new Error('opend-header');
    }
    const bodyLen = buffer.readUInt32LE(12);
    if (bodyLen > 8_000_000) throw new Error('opend-header');
    const total = FUTU_HEADER_LEN + bodyLen;
    if (buffer.length < total) return null;
    const body = buffer.subarray(FUTU_HEADER_LEN, total);
    const expected = buffer.subarray(16, 36);
    const actual = createHash('sha1').update(body).digest();
    if (!expected.equals(actual)) throw new Error('opend-header');
    return {
        protoId: buffer.readUInt32LE(2),
        serial: buffer.readUInt32LE(8),
        format: buffer.readUInt8(6),
        body,
        rest: buffer.subarray(total),
    };
}

function ymd(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function windowFor(now: Date): { beginTime: string; endTime: string } {
    const begin = new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000);
    const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return { beginTime: ymd(begin), endTime: ymd(end) };
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function rowsFromBody(body: unknown): { retType: number; retMsg: string; rows: FutuKlineRow[]; nextReqKey?: unknown } {
    const root = asRecord(body) ?? {};
    const retType = Number(root.retType ?? root.ret_type ?? -1);
    const retMsg = String(root.retMsg ?? root.ret_msg ?? '');
    const s2c = asRecord(root.s2c) ?? root;
    const nextReqKey = s2c.nextReqKey ?? s2c.next_req_key;
    const list = s2c.klList ?? s2c.kl_list;
    if (!Array.isArray(list)) return { retType, retMsg, rows: [], nextReqKey };
    const rows = list.map((item) => {
        const row = asRecord(item) ?? {};
        return {
            time: String(row.time ?? row.time_key ?? row.timeKey ?? ''),
            closePrice: (row.closePrice ?? row.close_price ?? row.close) as number | string | undefined,
            isBlank: Boolean(row.isBlank ?? row.is_blank),
        };
    });
    return { retType, retMsg, rows, nextReqKey };
}

function connectTcp(host: string, port: number): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
        const socket = net.connect({ host, port });
        const timer = setTimeout(() => {
            socket.destroy();
            reject(new Error('opend-down'));
        }, CONNECT_TIMEOUT_MS);
        socket.once('connect', () => {
            clearTimeout(timer);
            resolve(socket);
        });
        socket.once('error', () => {
            clearTimeout(timer);
            socket.destroy();
            reject(new Error('opend-down'));
        });
    });
}

function roundTrip(socket: net.Socket, protoId: number, serial: number, body: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
        let pending = Buffer.alloc(0);
        const timer = setTimeout(() => finish(new Error('opend-down')), REPLY_TIMEOUT_MS);
        const finish = (error: Error | null, value?: unknown) => {
            clearTimeout(timer);
            socket.off('data', onData);
            socket.off('error', onError);
            if (error) reject(error);
            else resolve(value);
        };
        const onError = () => finish(new Error('opend-down'));
        const onData = (chunk: Buffer) => {
            pending = Buffer.concat([pending, chunk]);
            try {
                const packet = decodeFutuPacket(pending);
                if (!packet) return;
                pending = Buffer.from(packet.rest);
                if (packet.serial !== serial) return;
                const text = packet.body.toString('utf8');
                finish(null, packet.format === 1 ? JSON.parse(text) : text);
            } catch {
                finish(new Error('opend-header'));
            }
        };
        socket.on('data', onData);
        socket.on('error', onError);
        socket.write(encodeFutuJsonPacket(protoId, serial, body));
    });
}

async function requestFutuHistory(
    security: { market: number; code: string },
    beginTime: string,
    endTime: string,
): Promise<FutuHistoryResult> {
    const config = readFutuHistoryConfig();
    if (!config) return { ok: false, issue: 'opend_down' };
    let socket: net.Socket | null = null;
    try {
        socket = await connectTcp(config.host, config.port);
        const init = await roundTrip(socket, FUTU_PROTO_INIT, 1, {
            c2s: {
                clientVer: 900,
                clientID: 'steadytrade-paper',
                recvNotify: false,
                packetEncAlgo: FUTU_ENC_NONE,
                pushProtoFmt: 1,
            },
        });
        const started = rowsFromBody(init);
        if (started.retType !== 0) return { ok: false, issue: started.retMsg ? classifyFutuRet(started.retMsg) : 'opend_down' };
        const rows: FutuKlineRow[] = [];
        let nextReqKey: unknown;
        for (let page = 0; page < 5; page += 1) {
            const c2s: Record<string, unknown> = {
                rehabType: FUTU_REHAB_FORWARD,
                klType: FUTU_KL_DAY,
                security,
                beginTime,
                endTime,
                extendedTime: false,
            };
            if (nextReqKey !== undefined && nextReqKey !== null && nextReqKey !== '') c2s.nextReqKey = nextReqKey;
            const history = await roundTrip(socket, FUTU_PROTO_HISTORY_KL, page + 2, { c2s });
            const parsed = rowsFromBody(history);
            if (parsed.retType !== 0) return { ok: false, issue: classifyFutuRet(parsed.retMsg) };
            rows.push(...parsed.rows);
            nextReqKey = parsed.nextReqKey;
            if (nextReqKey === undefined || nextReqKey === null || nextReqKey === '') break;
        }
        if (nextReqKey !== undefined && nextReqKey !== null && nextReqKey !== '') return { ok: false, issue: 'invalid' };
        return { ok: true, rows };
    } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (message === 'opend-header') return { ok: false, issue: 'invalid' };
        console.error('[paper] futu history unavailable issue=opend_down');
        return { ok: false, issue: 'opend_down' };
    } finally {
        socket?.destroy();
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
    try {
        const result = await request(security, beginTime, endTime);
        if (!result.ok) return { bars: null, issue: result.issue };
        return { bars: klineRowsToBars(result.rows), issue: null };
    } catch {
        return { bars: null, issue: 'opend_down' };
    }
}
