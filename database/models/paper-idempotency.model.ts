import { Schema, model, models, type Document, type Model } from 'mongoose';

/**
 * PAPER TRADING ONLY — one auto-fill claim per account, symbol, strategy, direction, and bar.
 * The unique key is the concurrency lock. A second insert for the same bar loses with E11000.
 * Not financial advice. Not a live brokerage id.
 * Upstream: Open-Dev-Society/OpenStock (AGPL-3.0).
 */
export interface PaperIdempotencyDoc extends Document {
    key: string;
    userId: string;
    accountId: string;
    symbol: string;
    strategy: string;
    direction: 'buy' | 'sell';
    barTimestamp: string;
    createdAt: Date;
    updatedAt: Date;
}

const PaperIdempotencySchema = new Schema<PaperIdempotencyDoc>(
    {
        key: { type: String, required: true, unique: true },
        userId: { type: String, required: true, index: true },
        accountId: { type: String, required: true, index: true },
        symbol: { type: String, required: true, uppercase: true, trim: true },
        strategy: { type: String, required: true },
        direction: { type: String, enum: ['buy', 'sell'], required: true },
        barTimestamp: { type: String, required: true },
    },
    { timestamps: true, collection: 'paper_idempotency' }
);

export const PaperIdempotency: Model<PaperIdempotencyDoc> =
    (models?.PaperIdempotency as Model<PaperIdempotencyDoc>) ||
    model<PaperIdempotencyDoc>('PaperIdempotency', PaperIdempotencySchema);
