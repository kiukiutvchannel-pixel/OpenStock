/**
 * PAPER TRADING ONLY — JSON shapes shared by the server action and the page.
 * Not financial advice.
 */

import type { ExposureLimits } from '@/lib/paper-trading/exposure';

export type PaperAccountView = {
    _id: string;
    cash: number;
    startingCash: number;
    currency: string;
    autoTradeEnabled: boolean;
    watchSymbols: string[];
};

export type PaperPositionView = {
    symbol: string;
    qty: number;
    avgCost: number;
    markPrice: number | null;
    marketValue: number | null;
    unrealizedPnl: number | null;
    quoteSource: string;
    quoteAsOf: string | null;
    quoteMessage: string;
};

export type PaperOrderView = {
    _id: string;
    symbol: string;
    side: 'buy' | 'sell';
    qty: number;
    price: number;
    status: 'filled' | 'rejected';
    source: 'manual' | 'auto';
    quoteSource: string;
    reason?: string;
    barTimestamp?: string;
    createdAt: string;
};

export type PaperSignalView = {
    _id: string;
    symbol: string;
    action: 'buy' | 'sell' | 'hold';
    rationale: string;
    executable: boolean;
    blockReason?: string;
    recordKind: 'history';
    autoSubmitted: boolean;
    barTimestamp?: string;
    historySource?: string;
    quoteSource?: string;
    createdAt: string;
    metrics?: Record<string, number | string | null>;
};

export type PaperEquityView = {
    cash: number;
    positionsValue: number | null;
    total: number | null;
    unrealizedPnl: number | null;
    currency: string;
    complete: boolean;
};

export type PaperSnapshot = {
    account: PaperAccountView | null;
    positions: PaperPositionView[];
    orders: PaperOrderView[];
    signals: PaperSignalView[];
    equity: PaperEquityView | null;
    limits: ExposureLimits;
    demo: boolean;
};
