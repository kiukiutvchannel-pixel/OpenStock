import { Schema, model, models, type Document, type Model } from 'mongoose';

/**
 * PAPER TRADING ONLY — stored analysis history (buy / sell / hold).
 * Records are history, not a live "current signal" flag.
 * `confidence` is optional and unused: older rows may still contain an uncalibrated
 * fraction. New rows do not write one, and the UI does not show it as a win rate.
 * Not financial advice. Signals do not place live brokerage orders.
 * Upstream: Open-Dev-Society/OpenStock (AGPL-3.0).
 */
export type SignalAction = 'buy' | 'sell' | 'hold';

export interface StrategySignalDoc extends Document {
    userId: string;
    accountId: string;
    symbol: string;
    action: SignalAction;
    strategy: string;
    /** Legacy only. Not a calibrated probability. New signals omit it. */
    confidence?: number;
    rationale: string;
    /** Snapshot of indicators used when the signal was generated. */
    metrics: Record<string, number | string | null>;
    executable: boolean;
    blockReason?: string;
    /** Always history. Kept so a row is not read as the account's current flag. */
    recordKind: 'history';
    barTimestamp?: string;
    historySource?: string;
    quoteSource?: string;
    autoSubmitted: boolean;
    orderId?: string;
    createdAt: Date;
    updatedAt: Date;
}

const StrategySignalSchema = new Schema<StrategySignalDoc>(
    {
        userId: { type: String, required: true, index: true },
        accountId: { type: String, required: true, index: true },
        symbol: { type: String, required: true, uppercase: true, trim: true },
        action: { type: String, enum: ['buy', 'sell', 'hold'], required: true },
        strategy: { type: String, required: true },
        confidence: { type: Number, required: false, min: 0, max: 1 },
        rationale: { type: String, required: true },
        metrics: { type: Schema.Types.Mixed, default: {} },
        executable: { type: Boolean, default: false },
        blockReason: { type: String },
        recordKind: { type: String, enum: ['history'], default: 'history' },
        barTimestamp: { type: String },
        historySource: { type: String },
        quoteSource: { type: String },
        autoSubmitted: { type: Boolean, default: false },
        orderId: { type: String },
    },
    { timestamps: true }
);

StrategySignalSchema.index({ userId: 1, createdAt: -1 });

export const StrategySignal: Model<StrategySignalDoc> =
    (models?.StrategySignal as Model<StrategySignalDoc>) ||
    model<StrategySignalDoc>('StrategySignal', StrategySignalSchema);
