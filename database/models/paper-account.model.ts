import { Schema, model, models, type Document, type Model } from 'mongoose';

/**
 * PAPER TRADING ONLY — not a live brokerage account.
 * Simulated cash for manual paper orders and optional auto-analysis.
 * Not financial advice. No live brokerage keys are stored here.
 * Upstream: Open-Dev-Society/OpenStock (AGPL-3.0).
 */
export interface PaperAccountDoc extends Document {
    userId: string;
    /** ISO currency code. Default USD for US equities paper book. */
    currency: string;
    cash: number;
    startingCash: number;
    /** When true, an executable SMA cross may auto-submit one paper order per bar. Default false. */
    autoTradeEnabled: boolean;
    /** Symbols the manual analysis button watches (US equities by default). */
    watchSymbols: string[];
    createdAt: Date;
    updatedAt: Date;
}

const PaperAccountSchema = new Schema<PaperAccountDoc>(
    {
        userId: { type: String, required: true, unique: true, index: true },
        currency: { type: String, required: true, default: 'USD', uppercase: true },
        cash: { type: Number, required: true, min: 0 },
        startingCash: { type: Number, required: true, min: 0 },
        autoTradeEnabled: { type: Boolean, default: false },
        watchSymbols: {
            type: [String],
            default: () => ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA'],
        },
    },
    { timestamps: true }
);

export const PaperAccount: Model<PaperAccountDoc> =
    (models?.PaperAccount as Model<PaperAccountDoc>) ||
    model<PaperAccountDoc>('PaperAccount', PaperAccountSchema);
