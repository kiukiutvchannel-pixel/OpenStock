# Paper-trading modification notice

This tree includes **OpenStock** by Open-Dev-Society
(https://github.com/Open-Dev-Society/OpenStock), licensed under **AGPL-3.0** (see `LICENSE`).
Original authorship and license notices are preserved.

Local modification: an experimental **paper-trading-only** module, plus a Traditional Chinese
(`zh-Hant`) interface for the signed-in app and auth forms.

- `database/models/paper-*.model.ts`, `database/models/strategy-signal.model.ts`, `database/models/paper-idempotency.model.ts`
- `lib/paper-trading/*`, `lib/actions/paper-trading.actions.ts`
- `lib/i18n/*`
- `app/(root)/paper-trading/page.tsx`, `components/paper-trading/PaperTradingClient.tsx`
- Navigation in `components/shell/Sidebar.tsx` and `components/shell/TabBar.tsx`

Safety rules for the paper module:

- Real dated Finnhub daily candles are required before an SMA(10)/SMA(20) cross can be executable.
- Missing data, HTTP 401/403, HTTP 429, timeouts, short history, and stale bars do **not** fall back to fake prices.
- A quote labeled Finnhub is never a substitute for missing history. History source and quote source are stored separately.
- Analyst recommendations are descriptive. They do not create a buy or sell without a fresh cross.
- No win-rate percentage is shown or written for new signals.
- `PAPER_TRADING_DEMO=1` is the only fictional mode. It cannot submit orders.
- Auto-submit defaults to off. There is no background job that places paper orders.
- One auto fill per account, symbol, strategy, direction, and bar, enforced by a unique server-side key.
- Per-symbol and total exposure caps default to USD 10,000 and USD 40,000.

Paper trading only. No live brokerage connection. Not financial advice.
The strategy is not claimed to be profitable.
If you run a modified version as a network service, AGPL-3.0 requires offering its source to users.
