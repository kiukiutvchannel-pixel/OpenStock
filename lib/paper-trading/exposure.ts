/**
 * PAPER TRADING ONLY — position sizing, exposure caps, and cash/share checks.
 * Pure functions. The server applies the returned book inside a claim + transaction.
 */

import {
    DEFAULT_AUTO_TRADE_FRACTION,
    DEFAULT_AUTO_TRADE_MAX_USD,
    DEFAULT_MAX_SYMBOL_EXPOSURE_USD,
    DEFAULT_MAX_TOTAL_EXPOSURE_USD,
} from '@/lib/paper-trading/constants';
import { FILL_MESSAGES, type FillCode } from '@/lib/paper-trading/messages';

export type ExposureLimits = {
    perSymbolUsd: number;
    totalUsd: number;
    autoFraction: number;
    autoMaxUsd: number;
};

export type BookPosition = { symbol: string; qty: number; avgCost: number };
export type Book = { cash: number; positions: BookPosition[] };

export type FillRequest = {
    symbol: string;
    side: 'buy' | 'sell';
    qty: number;
    price: number;
    quoteExecutable: boolean;
    limits: ExposureLimits;
    marks: Record<string, number | null>;
};

export type FillDecision =
    | { ok: true; book: Book; notional: number; qty: number }
    | { ok: false; code: FillCode; message: string };

export function roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

function readPositive(raw: string | undefined, fallback: number): number {
    if (raw == null || raw.trim() === '') return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) return fallback;
    return value;
}

/** Invalid or missing env values stay on the conservative defaults. Never unlimited. */
export function exposureLimitsFromEnv(env: Record<string, string | undefined> = process.env): ExposureLimits {
    const perSymbolUsd = readPositive(env.PAPER_MAX_SYMBOL_EXPOSURE_USD, DEFAULT_MAX_SYMBOL_EXPOSURE_USD);
    const totalUsd = readPositive(env.PAPER_MAX_TOTAL_EXPOSURE_USD, DEFAULT_MAX_TOTAL_EXPOSURE_USD);
    let autoFraction = readPositive(env.PAPER_AUTO_TRADE_FRACTION, DEFAULT_AUTO_TRADE_FRACTION);
    if (autoFraction > 1) autoFraction = 1;
    const autoMaxUsd = readPositive(env.PAPER_AUTO_TRADE_MAX_USD, DEFAULT_AUTO_TRADE_MAX_USD);
    return {
        perSymbolUsd: Math.min(perSymbolUsd, totalUsd),
        totalUsd,
        autoFraction,
        autoMaxUsd,
    };
}

export function defaultExposureLimits(): ExposureLimits {
    return {
        perSymbolUsd: DEFAULT_MAX_SYMBOL_EXPOSURE_USD,
        totalUsd: DEFAULT_MAX_TOTAL_EXPOSURE_USD,
        autoFraction: DEFAULT_AUTO_TRADE_FRACTION,
        autoMaxUsd: DEFAULT_AUTO_TRADE_MAX_USD,
    };
}

function fail(code: FillCode): FillDecision {
    return { ok: false, code, message: FILL_MESSAGES[code] };
}

function markedValue(qty: number, mark: number | null | undefined): number | null {
    if (qty === 0) return 0;
    if (mark == null || !(mark > 0)) return null;
    return mark * qty;
}

export function exposureSnapshot(book: Book, marks: Record<string, number | null>, fillPriceBySymbol?: Record<string, number>) {
    let total = 0;
    const bySymbol: Record<string, number> = {};
    const unverified: string[] = [];
    for (const position of book.positions) {
        const mark = marks[position.symbol] ?? fillPriceBySymbol?.[position.symbol] ?? null;
        const value = markedValue(position.qty, mark);
        if (value == null) {
            unverified.push(position.symbol);
            continue;
        }
        bySymbol[position.symbol] = value;
        total += value;
    }
    return { total, bySymbol, unverified };
}

export function sizeAutoBuy(input: {
    book: Book;
    symbol: string;
    price: number;
    limits: ExposureLimits;
    marks: Record<string, number | null>;
}): { qty: number; code?: FillCode } {
    if (!(input.price > 0)) return { qty: 0, code: 'bad_price' };
    const snap = exposureSnapshot(input.book, input.marks, { [input.symbol]: input.price });
    if (snap.unverified.length > 0) return { qty: 0, code: 'exposure_unverified' };
    const symbolMv = snap.bySymbol[input.symbol] ?? 0;
    const roomSymbol = input.limits.perSymbolUsd - symbolMv;
    const roomTotal = input.limits.totalUsd - snap.total;
    const budget = Math.min(
        input.book.cash * input.limits.autoFraction,
        input.limits.autoMaxUsd,
        input.book.cash,
        roomSymbol,
        roomTotal,
    );
    if (!(budget >= input.price)) return { qty: 0, code: 'exposure_cap' };
    const qty = Math.floor(budget / input.price);
    if (qty < 1) return { qty: 0, code: 'exposure_cap' };
    return { qty };
}

export function sizeAutoSell(qtyHeld: number): number {
    if (!Number.isInteger(qtyHeld) || qtyHeld <= 0) return 0;
    return Math.min(qtyHeld, Math.max(1, Math.floor(qtyHeld * 0.25)));
}

export function decideFill(book: Book, request: FillRequest): FillDecision {
    if (!request.quoteExecutable) return fail('quote_not_executable');
    if (!Number.isInteger(request.qty) || request.qty <= 0) return fail('bad_qty');
    if (!(request.price > 0) || !Number.isFinite(request.price)) return fail('bad_price');

    const positions = book.positions.map((position) => ({ ...position }));
    const current = positions.find((position) => position.symbol === request.symbol);

    if (request.side === 'sell') {
        if (!current || current.qty < request.qty) return fail('insufficient_shares');
        current.qty -= request.qty;
        const notional = roundMoney(request.price * request.qty);
        const nextPositions = positions.filter((position) => position.qty > 0);
        return {
            ok: true,
            qty: request.qty,
            notional,
            book: { cash: roundMoney(book.cash + notional), positions: nextPositions },
        };
    }

    const snap = exposureSnapshot(book, request.marks, { [request.symbol]: request.price });
    if (snap.unverified.length > 0) return fail('exposure_unverified');
    const notional = roundMoney(request.price * request.qty);
    if (book.cash + 1e-9 < notional) return fail('insufficient_cash');
    const symbolMv = (snap.bySymbol[request.symbol] ?? 0) + notional;
    const totalMv = snap.total + notional;
    if (symbolMv - request.limits.perSymbolUsd > 0.009 || totalMv - request.limits.totalUsd > 0.009) {
        return fail('exposure_cap');
    }
    const cash = roundMoney(book.cash - notional);
    if (cash < -0.001) return fail('insufficient_cash');

    if (current) {
        const newQty = current.qty + request.qty;
        current.avgCost = (current.avgCost * current.qty + request.price * request.qty) / newQty;
        current.qty = newQty;
    } else {
        positions.push({ symbol: request.symbol, qty: request.qty, avgCost: request.price });
    }
    positions.sort((a, b) => a.symbol.localeCompare(b.symbol));
    return { ok: true, qty: request.qty, notional, book: { cash, positions } };
}
