import { Schema, model, models, type Document, type Model } from 'mongoose';

/**
 * PAPER TRADING ONLY — simulated fills against real quotes, or rejections.
 * Not financial advice. No live brokerage execution.
 * Upstream: Open-Dev-Society/OpenStock (AGPL-3.0).
 */
export type PaperOrderSide = 'buy' | 'sell';
export type PaperOrderStatus = 'filled' | 'rejected';
export type PaperOrderSource = 'manual' | 'auto';

export interface PaperOrderDoc extends Document {
    userId: string;
    accountId: string;
    symbol: string;
    side: PaperOrderSide;
    qty: number;
    /** Fill price in account currency (USD for US equities). */
    price: number;
    notional: number;
    status: PaperOrderStatus;
    source: PaperOrderSource;
    reason?: string;
    signalId?: string;
    quoteSource: 'finnhub' | 'mock' | 'demo' | 'unavailable';
    /** Daily session date (YYYY-MM-DD) this auto order was tied to, when any. */
    barTimestamp?: string;
    idempotencyKey?: string;
    strategy?: string;
    createdAt: Date;
    updatedAt: Date;
}

const PaperOrderSchema = new Schema<PaperOrderDoc>(
    {
        userId: { type: String, required: true, index: true },
        accountId: { type: String, required: true, index: true },
        symbol: { type: String, required: true, uppercase: true, trim: true },
        side: { type: String, enum: ['buy', 'sell'], required: true },
        qty: { type: Number, required: true, min: 0 },
        price: { type: Number, required: true, min: 0 },
        notional: { type: Number, required: true, min: 0 },
        status: { type: String, enum: ['filled', 'rejected'], required: true },
        source: { type: String, enum: ['manual', 'auto'], default: 'manual' },
        reason: { type: String },
        signalId: { type: String },
        quoteSource: { type: String, enum: ['finnhub', 'mock', 'demo', 'unavailable'], required: true },
        barTimestamp: { type: String },
        idempotencyKey: { type: String },
        strategy: { type: String },
    },
    { timestamps: true }
);

PaperOrderSchema.index({ userId: 1, createdAt: -1 });

export const PaperOrder: Model<PaperOrderDoc> =
    (models?.PaperOrder as Model<PaperOrderDoc>) ||
    model<PaperOrderDoc>('PaperOrder', PaperOrderSchema);
