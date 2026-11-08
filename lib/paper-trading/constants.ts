/**
 * PAPER TRADING ONLY — shared constants (safe to import from client components).
 * Not financial advice. Not a live brokerage.
 *
 * Upstream: Open-Dev-Society/OpenStock (AGPL-3.0). See PAPER-TRADING-NOTICE.md.
 */

/** Default paper book: USD 100,000 for US equities. HKD reserves stay outside this app. */
export const DEFAULT_STARTING_CASH_USD = 100_000;

/** SMA windows. A previous-vs-current cross needs at least slow + 1 dated closes. */
export const SMA_FAST = 10;
export const SMA_SLOW = 20;
export const MIN_DATED_CLOSES = SMA_SLOW + 1;

export const STRATEGY_ID = 'sma10_sma20_cross';

/** Conservative defaults. Override only with the PAPER_* env vars documented in .env.example. */
export const DEFAULT_MAX_SYMBOL_EXPOSURE_USD = 10_000;
export const DEFAULT_MAX_TOTAL_EXPOSURE_USD = 40_000;
export const DEFAULT_AUTO_TRADE_FRACTION = 0.05;
export const DEFAULT_AUTO_TRADE_MAX_USD = 5_000;

/** Quote older than this during the regular session is stale (free tier is about 15 minutes). */
export const MAX_OPEN_QUOTE_AGE_MS = 45 * 60 * 1000;

/** Daily bar is "complete" this many minutes after the US cash close (16:00 America/New_York). */
export const SESSION_CLOSE_GRACE_MINUTES = 10;
