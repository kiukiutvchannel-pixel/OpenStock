'use server';

/**
 * PAPER TRADING ONLY — simulated USD book. No live broker, no scheduled auto-trading.
 * Auto orders require the account switch (default off), a fresh SMA cross, a real quote,
 * exposure room, and a unique bar claim. Not financial advice.
 * Upstream: Open-Dev-Society/OpenStock (AGPL-3.0). See PAPER-TRADING-NOTICE.md.
 */

import mongoose from 'mongoose';
import { revalidatePath } from 'next/cache';
import { connectToDatabase } from '@/database/mongoose';
import { requireUserId } from '@/lib/better-auth/auth';
import { PaperAccount, type PaperAccountDoc } from '@/database/models/paper-account.model';
import { PaperOrder } from '@/database/models/paper-order.model';
import { PaperPosition } from '@/database/models/paper-position.model';
import { PaperIdempotency } from '@/database/models/paper-idempotency.model';
import { StrategySignal } from '@/database/models/strategy-signal.model';
import { DEFAULT_STARTING_CASH_USD, STRATEGY_ID } from '@/lib/paper-trading/constants';
import {
    decideFill,
    exposureLimitsFromEnv,
    roundMoney,
    sizeAutoBuy,
    sizeAutoSell,
    type Book,
    type ExposureLimits,
} from '@/lib/paper-trading/exposure';
import { buildIdempotencyKey } from '@/lib/paper-trading/idempotency';
import { FILL_MESSAGES } from '@/lib/paper-trading/messages';
import { isExplicitDemoMode, resolvePaperQuote, type PaperQuote } from '@/lib/paper-trading/quotes';
import { analyzeSymbol, shouldAutoOrder } from '@/lib/paper-trading/strategy';
import type { PaperSnapshot } from '@/lib/paper-trading/types';
import { zh } from '@/lib/i18n/zh-Hant';

const SYMBOL_PATTERN = /^[A-Z0-9][A-Z0-9.&:-]{0,24}$/;

function serialize<T>(doc: T): T {
    return JSON.parse(JSON.stringify(doc));
}

function isDuplicateKeyError(error: unknown): boolean {
    const seen = new Set<unknown>();
    let current: unknown = error;
    while (current && typeof current === 'object' && !seen.has(current)) {
        seen.add(current);
        const record = current as { code?: number; message?: string; cause?: unknown; errorResponse?: { code?: number } };
        if (record.code === 11000 || record.errorResponse?.code === 11000) return true;
        if (typeof record.message === 'string' && record.message.includes('E11000')) return true;
        current = record.cause;
    }
    return false;
}

async function supportsTransactions(): Promise<boolean> {
    const db = mongoose.connection.db;
    if (!db) return false;
    try {
        const hello = await db.admin().command({ hello: 1 });
        const info = hello as { setName?: string; msg?: string };
        return Boolean(info.setName || info.msg === 'isdbgrid');
    } catch (error) {
        console.error('[paper] transaction check failed', error instanceof Error ? error.name : 'error');
        return false;
    }
}

function bookFrom(cash: number, positions: Array<{ symbol: string; qty: number; avgCost: number }>): Book {
    return {
        cash,
        positions: positions.map((position) => ({
            symbol: position.symbol,
            qty: position.qty,
            avgCost: position.avgCost,
        })),
    };
}

async function marksFor(symbols: string[], preferred?: PaperQuote): Promise<Record<string, number | null>> {
    const marks: Record<string, number | null> = {};
    for (const symbol of symbols) {
        if (preferred && preferred.symbol === symbol && preferred.executable && preferred.price != null) {
            marks[symbol] = preferred.price;
            continue;
        }
        const quote = await resolvePaperQuote(symbol);
        marks[symbol] = quote.executable && quote.price != null ? quote.price : null;
    }
    return marks;
}

async function rejectOrder(input: {
    userId: string;
    accountId: string;
    symbol: string;
    side: 'buy' | 'sell';
    qty: number;
    price: number;
    source: 'manual' | 'auto';
    reason: string;
    quoteSource: PaperQuote['source'] | 'mock';
    signalId?: string;
    barTimestamp?: string;
    idempotencyKey?: string;
    strategy?: string;
    session?: mongoose.ClientSession | null;
}) {
    const [order] = await PaperOrder.create([{
        userId: input.userId,
        accountId: input.accountId,
        symbol: input.symbol,
        side: input.side,
        qty: input.qty,
        price: input.price,
        notional: roundMoney(input.price * input.qty),
        status: 'rejected',
        source: input.source,
        reason: input.reason,
        signalId: input.signalId,
        quoteSource: input.quoteSource === 'finnhub' || input.quoteSource === 'demo' ? input.quoteSource : 'unavailable',
        barTimestamp: input.barTimestamp,
        idempotencyKey: input.idempotencyKey,
        strategy: input.strategy,
    }], { session: input.session ?? undefined });
    return order;
}

async function syncPosition(
    userId: string,
    accountId: string,
    symbol: string,
    book: Book,
    session: mongoose.ClientSession | null,
) {
    const next = book.positions.find((position) => position.symbol === symbol);
    const existing = await PaperPosition.findOne({ userId, symbol }).session(session);
    if (!next) {
        if (existing) await existing.deleteOne({ session: session ?? undefined });
        return;
    }
    if (!existing) {
        await PaperPosition.create([{
            userId,
            accountId,
            symbol,
            qty: next.qty,
            avgCost: next.avgCost,
        }], { session: session ?? undefined });
        return;
    }
    existing.qty = next.qty;
    existing.avgCost = next.avgCost;
    await existing.save({ session: session ?? undefined });
}

type PlaceInput = {
    userId: string;
    accountId: string;
    symbol: string;
    side: 'buy' | 'sell';
    qty: number;
    quote: PaperQuote;
    source: 'manual' | 'auto';
    signalId?: string;
    barTimestamp?: string | null;
    strategy?: string;
    idempotencyKey?: string;
};

async function claimBar(input: PlaceInput): Promise<'claimed' | 'duplicate' | 'skip'> {
    if (!input.idempotencyKey || !input.barTimestamp) return 'skip';
    try {
        await PaperIdempotency.create({
            key: input.idempotencyKey,
            userId: input.userId,
            accountId: input.accountId,
            symbol: input.symbol,
            strategy: input.strategy ?? STRATEGY_ID,
            direction: input.side,
            barTimestamp: input.barTimestamp,
        });
        return 'claimed';
    } catch (error) {
        if (isDuplicateKeyError(error)) return 'duplicate';
        throw error;
    }
}

async function releaseClaim(key: string | undefined) {
    if (!key) return;
    await PaperIdempotency.deleteOne({ key });
}

async function placeWithTransaction(input: PlaceInput, limits: ExposureLimits) {
    const existing = await PaperPosition.find({ userId: input.userId });
    const symbols = [...new Set([input.symbol, ...existing.map((position) => position.symbol)])];
    const marks = await marksFor(symbols, input.quote);
    const session = await mongoose.startSession();
    let error: string | undefined;
    let order: unknown;
    try {
        await session.withTransaction(async () => {
            const account = await PaperAccount.findById(input.accountId).session(session);
            if (!account) throw new Error(zh.paper.needAccount);
            const positions = await PaperPosition.find({ userId: input.userId }).session(session);
            const decision = decideFill(bookFrom(account.cash, positions), {
                symbol: input.symbol,
                side: input.side,
                qty: input.qty,
                price: input.quote.price ?? 0,
                quoteExecutable: input.quote.executable,
                limits,
                marks,
            });
            if (!decision.ok) {
                order = await rejectOrder({
                    ...input,
                    price: input.quote.price ?? 0,
                    reason: decision.message,
                    quoteSource: input.quote.source,
                    barTimestamp: input.barTimestamp ?? undefined,
                    session,
                });
                error = decision.message;
                return;
            }
            account.cash = decision.book.cash;
            await account.save({ session });
            await syncPosition(input.userId, input.accountId, input.symbol, decision.book, session);
            const [filled] = await PaperOrder.create([{
                userId: input.userId,
                accountId: input.accountId,
                symbol: input.symbol,
                side: input.side,
                qty: decision.qty,
                price: input.quote.price,
                notional: decision.notional,
                status: 'filled',
                source: input.source,
                signalId: input.signalId,
                quoteSource: 'finnhub',
                barTimestamp: input.barTimestamp ?? undefined,
                idempotencyKey: input.idempotencyKey,
                strategy: input.strategy,
            }], { session });
            order = filled;
            error = undefined;
        });
    } catch (caught) {
        await releaseClaim(input.idempotencyKey);
        console.error('[paper] fill transaction failed', caught instanceof Error ? caught.name : 'error');
        throw new Error(zh.paper.genericError);
    } finally {
        await session.endSession();
    }
    return { error, order };
}

async function placeFallback(input: PlaceInput, limits: ExposureLimits) {
    const account = await PaperAccount.findById(input.accountId);
    if (!account) throw new Error(zh.paper.needAccount);
    const positions = await PaperPosition.find({ userId: input.userId });
    const symbols = [...new Set([input.symbol, ...positions.map((position) => position.symbol)])];
    const marks = await marksFor(symbols, input.quote);
    const decision = decideFill(bookFrom(account.cash, positions), {
        symbol: input.symbol,
        side: input.side,
        qty: input.qty,
        price: input.quote.price ?? 0,
        quoteExecutable: input.quote.executable,
        limits,
        marks,
    });
    if (!decision.ok) {
        const order = await rejectOrder({
            ...input,
            price: input.quote.price ?? 0,
            reason: decision.message,
            quoteSource: input.quote.source,
            barTimestamp: input.barTimestamp ?? undefined,
            session: null,
        });
        return { error: decision.message, order };
    }

    if (input.side === 'buy') {
        const updated = await PaperAccount.findOneAndUpdate(
            { _id: input.accountId, cash: { $gte: decision.notional } },
            { $inc: { cash: -decision.notional } },
            { new: true },
        );
        if (!updated) {
            const order = await rejectOrder({
                ...input,
                price: input.quote.price ?? 0,
                reason: FILL_MESSAGES.insufficient_cash,
                quoteSource: input.quote.source,
                barTimestamp: input.barTimestamp ?? undefined,
                session: null,
            });
            return { error: FILL_MESSAGES.insufficient_cash, order };
        }
        try {
            await syncPosition(input.userId, input.accountId, input.symbol, decision.book, null);
        } catch (error) {
            await PaperAccount.updateOne({ _id: input.accountId }, { $inc: { cash: decision.notional } });
            await releaseClaim(input.idempotencyKey);
            throw error;
        }
    } else {
        const updated = await PaperPosition.findOneAndUpdate(
            { userId: input.userId, symbol: input.symbol, qty: { $gte: input.qty } },
            { $inc: { qty: -input.qty } },
            { new: true },
        );
        if (!updated) {
            const order = await rejectOrder({
                ...input,
                price: input.quote.price ?? 0,
                reason: FILL_MESSAGES.insufficient_shares,
                quoteSource: input.quote.source,
                barTimestamp: input.barTimestamp ?? undefined,
                session: null,
            });
            return { error: FILL_MESSAGES.insufficient_shares, order };
        }
        try {
            if (updated.qty === 0) await PaperPosition.deleteOne({ _id: updated._id, qty: 0 });
            await PaperAccount.updateOne({ _id: input.accountId }, { $inc: { cash: decision.notional } });
        } catch (error) {
            await PaperPosition.updateOne({ userId: input.userId, symbol: input.symbol }, { $inc: { qty: input.qty } });
            await releaseClaim(input.idempotencyKey);
            throw error;
        }
    }

    const order = await PaperOrder.create({
        userId: input.userId,
        accountId: input.accountId,
        symbol: input.symbol,
        side: input.side,
        qty: decision.qty,
        price: input.quote.price,
        notional: decision.notional,
        status: 'filled',
        source: input.source,
        signalId: input.signalId,
        quoteSource: 'finnhub',
        barTimestamp: input.barTimestamp ?? undefined,
        idempotencyKey: input.idempotencyKey,
        strategy: input.strategy,
    });
    return { order };
}

async function placeLocked(input: PlaceInput): Promise<{ error?: string; order?: unknown; duplicate?: boolean }> {
    if (isExplicitDemoMode()) {
        return { error: FILL_MESSAGES.demo };
    }
    if (!input.quote.executable || input.quote.price == null || input.quote.source !== 'finnhub') {
        const order = await rejectOrder({
            ...input,
            price: input.quote.price ?? 0,
            reason: input.quote.message || FILL_MESSAGES.quote_not_executable,
            quoteSource: input.quote.source,
            barTimestamp: input.barTimestamp ?? undefined,
            session: null,
        });
        return { error: input.quote.message || FILL_MESSAGES.quote_not_executable, order };
    }

    const claim = await claimBar(input);
    if (claim === 'duplicate') return { error: FILL_MESSAGES.duplicate_bar, duplicate: true };

    const limits = exposureLimitsFromEnv();
    try {
        if (await supportsTransactions()) return await placeWithTransaction(input, limits);
        return await placeFallback(input, limits);
    } catch (error) {
        if (claim === 'claimed') await releaseClaim(input.idempotencyKey);
        throw error;
    }
}

export async function getPaperTradingSnapshot(): Promise<PaperSnapshot> {
    const userId = await requireUserId();
    await connectToDatabase();
    const limits = exposureLimitsFromEnv();
    const demo = isExplicitDemoMode();
    const account = await PaperAccount.findOne({ userId });
    if (!account) {
        return { account: null, positions: [], orders: [], signals: [], equity: null, limits, demo };
    }

    const [positions, orders, signals] = await Promise.all([
        PaperPosition.find({ userId }).sort({ symbol: 1 }),
        PaperOrder.find({ userId }).sort({ createdAt: -1 }).limit(40),
        StrategySignal.find({ userId }).sort({ createdAt: -1 }).limit(40),
    ]);

    let positionsValue = 0;
    let costBasis = 0;
    let complete = true;
    const marked = [];
    for (const position of positions) {
        const quote = await resolvePaperQuote(position.symbol);
        if (!quote.executable || quote.price == null) {
            complete = false;
            marked.push({
                symbol: position.symbol,
                qty: position.qty,
                avgCost: position.avgCost,
                markPrice: null,
                marketValue: null,
                unrealizedPnl: null,
                quoteSource: quote.source,
                quoteAsOf: quote.asOf,
                quoteMessage: quote.message,
            });
            continue;
        }
        const marketValue = roundMoney(quote.price * position.qty);
        const cost = position.avgCost * position.qty;
        positionsValue += marketValue;
        costBasis += cost;
        marked.push({
            symbol: position.symbol,
            qty: position.qty,
            avgCost: position.avgCost,
            markPrice: quote.price,
            marketValue,
            unrealizedPnl: roundMoney(marketValue - cost),
            quoteSource: quote.source,
            quoteAsOf: quote.asOf,
            quoteMessage: quote.message,
        });
    }

    return {
        account: serialize(account) as unknown as PaperSnapshot['account'],
        positions: marked,
        orders: serialize(orders) as unknown as PaperSnapshot['orders'],
        signals: serialize(signals) as unknown as PaperSnapshot['signals'],
        equity: {
            cash: account.cash,
            positionsValue: complete ? roundMoney(positionsValue) : null,
            total: complete ? roundMoney(account.cash + positionsValue) : null,
            unrealizedPnl: complete ? roundMoney(positionsValue - costBasis) : null,
            currency: account.currency,
            complete,
        },
        limits,
        demo,
    };
}

export async function createPaperAccount(startingCash = DEFAULT_STARTING_CASH_USD) {
    const userId = await requireUserId();
    await connectToDatabase();
    const existing = await PaperAccount.findOne({ userId });
    if (existing) return serialize(existing);

    const cash = Math.max(1_000, Math.min(Number(startingCash) || DEFAULT_STARTING_CASH_USD, 10_000_000));
    const account = await PaperAccount.create({
        userId,
        currency: 'USD',
        cash,
        startingCash: cash,
        autoTradeEnabled: false,
        watchSymbols: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA'],
    });
    revalidatePath('/paper-trading');
    return serialize(account);
}

export async function setPaperAutoTrade(enabled: boolean) {
    const userId = await requireUserId();
    await connectToDatabase();
    const account = await PaperAccount.findOne({ userId });
    if (!account) throw new Error(zh.paper.needAccount);
    if (enabled && isExplicitDemoMode()) {
        return { error: FILL_MESSAGES.demo, account: serialize(account) };
    }
    account.autoTradeEnabled = Boolean(enabled);
    await account.save();
    revalidatePath('/paper-trading');
    return { account: serialize(account) };
}

export async function setPaperWatchSymbols(symbols: string[]) {
    const userId = await requireUserId();
    await connectToDatabase();
    const account = await PaperAccount.findOne({ userId });
    if (!account) throw new Error(zh.paper.needAccount);
    const cleaned = [...new Set(symbols.map((symbol) => String(symbol).trim().toUpperCase()).filter((symbol) => SYMBOL_PATTERN.test(symbol)))].slice(0, 20);
    if (cleaned.length) account.watchSymbols = cleaned;
    await account.save();
    revalidatePath('/paper-trading');
    return serialize(account);
}

export async function placePaperMarketOrder(input: {
    symbol: string;
    side: 'buy' | 'sell';
    qty: number;
    source?: 'manual' | 'auto';
    signalId?: string;
    barTimestamp?: string | null;
    strategy?: string;
    idempotencyKey?: string;
}): Promise<{ error?: string; order?: unknown; quote?: PaperQuote; duplicate?: boolean }> {
    const userId = await requireUserId();
    await connectToDatabase();
    const account = await PaperAccount.findOne({ userId });
    if (!account) throw new Error(zh.paper.needAccount);

    const symbol = String(input.symbol ?? '').trim().toUpperCase();
    if (!SYMBOL_PATTERN.test(symbol)) return { error: FILL_MESSAGES.bad_symbol };
    const qty = Math.floor(Number(input.qty));
    if (!Number.isInteger(qty) || qty <= 0) return { error: FILL_MESSAGES.bad_qty };
    if (input.source === 'auto' && !account.autoTradeEnabled) return { error: FILL_MESSAGES.auto_off };

    const quote = await resolvePaperQuote(symbol);
    const result = await placeLocked({
        userId,
        accountId: String(account._id),
        symbol,
        side: input.side,
        qty,
        quote,
        source: input.source ?? 'manual',
        signalId: input.signalId,
        barTimestamp: input.barTimestamp,
        strategy: input.strategy,
        idempotencyKey: input.idempotencyKey,
    });
    revalidatePath('/paper-trading');
    return { ...result, order: result.order ? serialize(result.order) : undefined, quote };
}

export async function runPaperAnalysis() {
    const userId = await requireUserId();
    await connectToDatabase();
    let account = await PaperAccount.findOne({ userId });
    if (!account) {
        account = await PaperAccount.create({
            userId,
            currency: 'USD',
            cash: DEFAULT_STARTING_CASH_USD,
            startingCash: DEFAULT_STARTING_CASH_USD,
            autoTradeEnabled: false,
            watchSymbols: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA'],
        });
    }

    const demo = isExplicitDemoMode();
    const limits = exposureLimitsFromEnv();
    const autoEnabled = account.autoTradeEnabled && !demo;
    const results = [];

    for (const symbol of account.watchSymbols) {
        const analysis = await analyzeSymbol(symbol);
        const signal = await StrategySignal.create({
            userId,
            accountId: String(account._id),
            symbol: analysis.symbol,
            action: analysis.action,
            strategy: analysis.strategy,
            rationale: analysis.rationale,
            metrics: analysis.metrics,
            executable: analysis.executable,
            blockReason: analysis.blockReason ?? undefined,
            recordKind: 'history',
            barTimestamp: analysis.barTimestamp ?? undefined,
            historySource: analysis.history.source,
            quoteSource: analysis.quote.source,
            autoSubmitted: false,
        });

        let orderError: string | undefined;
        if (shouldAutoOrder(analysis, autoEnabled, demo) && analysis.barTimestamp && analysis.quote.price != null) {
            account = (await PaperAccount.findById(account._id)) ?? account;
            const positions = await PaperPosition.find({ userId });
            const book = bookFrom(account.cash, positions);
            const marks = await marksFor(positions.map((position) => position.symbol).concat(analysis.symbol), analysis.quote);
            const qty = analysis.action === 'buy'
                ? sizeAutoBuy({ book, symbol: analysis.symbol, price: analysis.quote.price, limits, marks }).qty
                : sizeAutoSell(book.positions.find((position) => position.symbol === analysis.symbol)?.qty ?? 0);

            if (qty < 1) {
                orderError = analysis.action === 'sell' ? FILL_MESSAGES.insufficient_shares : FILL_MESSAGES.exposure_cap;
                signal.blockReason = orderError;
                await signal.save();
            } else {
                const idempotencyKey = buildIdempotencyKey({
                    accountId: String(account._id),
                    symbol: analysis.symbol,
                    strategy: STRATEGY_ID,
                    direction: analysis.action as 'buy' | 'sell',
                    barTimestamp: analysis.barTimestamp,
                });
                const placed = await placePaperMarketOrder({
                    symbol: analysis.symbol,
                    side: analysis.action as 'buy' | 'sell',
                    qty,
                    source: 'auto',
                    signalId: String(signal._id),
                    barTimestamp: analysis.barTimestamp,
                    strategy: STRATEGY_ID,
                    idempotencyKey,
                });
                orderError = placed.error;
                const filled = placed.order as { _id?: string; status?: string } | undefined;
                if (filled?.status === 'filled') {
                    signal.autoSubmitted = true;
                    signal.orderId = String(filled._id);
                    signal.blockReason = undefined;
                    await signal.save();
                } else if (orderError) {
                    signal.blockReason = orderError;
                    await signal.save();
                }
            }
        }

        results.push({
            signal: serialize(signal),
            executable: analysis.executable,
            action: analysis.action,
            orderError: orderError ?? null,
        });
    }

    revalidatePath('/paper-trading');
    return { results, autoSubmit: autoEnabled };
}

export async function resetPaperAccount() {
    const userId = await requireUserId();
    await connectToDatabase();
    const account = await PaperAccount.findOne({ userId });
    if (!account) return { ok: true };
    await Promise.all([
        PaperOrder.deleteMany({ userId }),
        PaperPosition.deleteMany({ userId }),
        StrategySignal.deleteMany({ userId }),
        PaperIdempotency.deleteMany({ userId }),
    ]);
    account.cash = account.startingCash;
    account.autoTradeEnabled = false;
    await account.save();
    revalidatePath('/paper-trading');
    return { ok: true };
}
