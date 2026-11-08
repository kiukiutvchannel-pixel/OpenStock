import { Schema, model, models, type Document, type Model } from 'mongoose';

/**
 * PAPER TRADING ONLY — open simulated positions.
 * Not financial advice. Marks require a real quote; missing quotes are not filled with mocks.
 * Upstream: Open-Dev-Society/OpenStock (AGPL-3.0).
 */
export interface PaperPositionDoc extends Document {
    userId: string;
    accountId: string;
    symbol: string;
    qty: number;
    avgCost: number;
    createdAt: Date;
    updatedAt: Date;
}

const PaperPositionSchema = new Schema<PaperPositionDoc>(
    {
        userId: { type: String, required: true, index: true },
        accountId: { type: String, required: true, index: true },
        symbol: { type: String, required: true, uppercase: true, trim: true },
        qty: { type: Number, required: true, min: 0 },
        avgCost: { type: Number, required: true, min: 0 },
    },
    { timestamps: true }
);

PaperPositionSchema.index({ userId: 1, symbol: 1 }, { unique: true });

export const PaperPosition: Model<PaperPositionDoc> =
    (models?.PaperPosition as Model<PaperPositionDoc>) ||
    model<PaperPositionDoc>('PaperPosition', PaperPositionSchema);
