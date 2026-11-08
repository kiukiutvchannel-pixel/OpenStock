'use client';

/**
 * PAPER TRADING ONLY — Traditional Chinese controls for the simulated book.
 * Not financial advice. Does not place live brokerage orders.
 * Upstream: Open-Dev-Society/OpenStock (AGPL-3.0).
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    createPaperAccount,
    placePaperMarketOrder,
    resetPaperAccount,
    runPaperAnalysis,
    setPaperAutoTrade,
    setPaperWatchSymbols,
} from '@/lib/actions/paper-trading.actions';
import { DEFAULT_STARTING_CASH_USD } from '@/lib/paper-trading/constants';
import { actionLabel, historySourceLabel, orderSourceLabel, orderStatusLabel, quoteSourceLabel } from '@/lib/paper-trading/labels';
import type { PaperSnapshot } from '@/lib/paper-trading/types';
import { formatTaipei, formatUsd } from '@/lib/i18n/format';
import { zh } from '@/lib/i18n/zh-Hant';

type Props = { initial: PaperSnapshot };

export default function PaperTradingClient({ initial }: Props) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [symbol, setSymbol] = useState('AAPL');
    const [qty, setQty] = useState(1);
    const [watchInput, setWatchInput] = useState(initial.account?.watchSymbols.join(', ') ?? 'AAPL, MSFT, GOOGL, AMZN, NVDA');

    const account = initial.account;
    const equity = initial.equity;
    const limits = initial.limits;

    const refresh = () => {
        startTransition(() => {
            router.refresh();
        });
    };

    const run = (fn: () => Promise<unknown>) => {
        setError(null);
        startTransition(async () => {
            try {
                const res = await fn();
                if (res && typeof res === 'object' && 'error' in res && (res as { error?: string }).error) {
                    setError(String((res as { error: string }).error));
                }
                router.refresh();
            } catch (caught) {
                setError(caught instanceof Error ? caught.message : zh.paper.genericError);
            }
        });
    };

    if (!account) {
        return (
            <div className="card flex flex-col gap-4 p-5">
                <p className="text-[14px] text-muted-foreground">
                    {zh.paper.createLead} {zh.paper.currencyTag} {formatUsd(DEFAULT_STARTING_CASH_USD)}。
                </p>
                <button type="button" className="btn btn-primary w-fit" disabled={pending} onClick={() => run(() => createPaperAccount())}>
                    {pending ? zh.paper.loading : zh.paper.create}
                </button>
                {error && <p className="text-[13px] text-red-400">{error}</p>}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            {initial.demo && (
                <p className="rounded-[12px] border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-200">{zh.paper.demoBanner}</p>
            )}
            <div className="grid gap-3 md:grid-cols-4">
                <div className="card p-4">
                    <p className="kicker">{zh.paper.cash}</p>
                    <p className="mono text-[22px] font-semibold">{formatUsd(account.cash)}</p>
                    <p className="text-[11px] text-faint">{zh.paper.currencyTag}</p>
                </div>
                <div className="card p-4">
                    <p className="kicker">{zh.paper.positionsValue}</p>
                    <p className="mono text-[22px] font-semibold">{equity?.positionsValue == null ? zh.paper.markUnavailable : formatUsd(equity.positionsValue)}</p>
                </div>
                <div className="card p-4">
                    <p className="kicker">{zh.paper.equity}</p>
                    <p className="mono text-[22px] font-semibold">{equity?.total == null ? zh.paper.markUnavailable : formatUsd(equity.total)}</p>
                </div>
                <div className="card p-4">
                    <p className="kicker">{zh.paper.unrealized}</p>
                    <p className={`mono text-[22px] font-semibold ${(equity?.unrealizedPnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {equity?.unrealizedPnl == null ? '—' : formatUsd(equity.unrealizedPnl)}
                    </p>
                </div>
            </div>

            {equity && !equity.complete && <p className="text-[13px] text-amber-200">{zh.paper.equityIncomplete}</p>}

            <div className="card flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-[13px]">
                        <input
                            type="checkbox"
                            checked={Boolean(account.autoTradeEnabled)}
                            disabled={pending || initial.demo}
                            onChange={(event) => run(() => setPaperAutoTrade(event.target.checked))}
                        />
                        {zh.paper.autoLabel}
                    </label>
                    <button type="button" className="btn btn-primary" disabled={pending} onClick={() => run(() => runPaperAnalysis())}>
                        {pending ? zh.paper.running : zh.paper.run}
                    </button>
                    <button
                        type="button"
                        className="btn"
                        disabled={pending}
                        onClick={() => {
                            if (window.confirm(zh.paper.resetConfirm)) run(() => resetPaperAccount());
                        }}
                    >
                        {zh.paper.reset}
                    </button>
                    <button type="button" className="btn" disabled={pending} onClick={refresh}>
                        {zh.paper.refresh}
                    </button>
                </div>
                <p className="text-[12.5px] text-faint">{zh.paper.autoHelp}</p>
                <p className="text-[12.5px] text-faint">{initial.demo ? zh.paper.demoBanner : zh.paper.demoOff}</p>
                <p className="text-[12.5px] text-faint">{zh.paper.disclaimer}</p>
                <p className="text-[12.5px] text-faint">{zh.paper.noConfidence}</p>
                <p className="text-[12.5px] text-faint">
                    {zh.paper.caps}：{zh.paper.capsBody(formatUsd(limits.perSymbolUsd), formatUsd(limits.totalUsd))} {zh.paper.timeTag}
                </p>
                {error && <p className="text-[13px] text-red-400">{error}</p>}
            </div>

            <div className="grid gap-3 xl:grid-cols-2">
                <div className="card flex flex-col gap-3 p-4">
                    <h3 className="section-title text-[15px]">{zh.paper.manualTitle}</h3>
                    <div className="flex flex-wrap gap-2">
                        <input
                            className="rounded-[10px] border border-line bg-transparent px-3 py-2 mono text-[13px]"
                            value={symbol}
                            onChange={(event) => setSymbol(event.target.value.toUpperCase())}
                            placeholder="AAPL"
                            aria-label={zh.paper.symbol}
                        />
                        <input
                            className="w-24 rounded-[10px] border border-line bg-transparent px-3 py-2 mono text-[13px]"
                            type="number"
                            min={1}
                            value={qty}
                            onChange={(event) => setQty(Number(event.target.value))}
                            aria-label={zh.paper.qty}
                        />
                        <button type="button" className="btn btn-primary" disabled={pending} onClick={() => run(() => placePaperMarketOrder({ symbol, side: 'buy', qty }))}>
                            {zh.paper.buy}
                        </button>
                        <button type="button" className="btn" disabled={pending} onClick={() => run(() => placePaperMarketOrder({ symbol, side: 'sell', qty }))}>
                            {zh.paper.sell}
                        </button>
                    </div>
                </div>
                <div className="card flex flex-col gap-3 p-4">
                    <h3 className="section-title text-[15px]">{zh.paper.symbolsTitle}</h3>
                    <div className="flex flex-wrap gap-2">
                        <input
                            className="min-w-[220px] flex-1 rounded-[10px] border border-line bg-transparent px-3 py-2 text-[13px]"
                            value={watchInput}
                            onChange={(event) => setWatchInput(event.target.value)}
                            placeholder="AAPL, MSFT"
                            aria-label={zh.paper.symbolsTitle}
                        />
                        <button
                            type="button"
                            className="btn btn-primary"
                            disabled={pending}
                            onClick={() => run(() => setPaperWatchSymbols(watchInput.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean)))}
                        >
                            {zh.paper.save}
                        </button>
                    </div>
                </div>
            </div>

            <div className="card overflow-x-auto p-0">
                <div className="section-head px-4 pt-4">
                    <h3 className="section-title text-[15px]">{zh.paper.positions}</h3>
                </div>
                <table className="w-full text-left text-[13px]">
                    <thead className="text-faint">
                        <tr>
                            <th className="px-4 py-2 font-medium">{zh.paper.symbol}</th>
                            <th className="px-4 py-2 font-medium">{zh.paper.qty}</th>
                            <th className="px-4 py-2 font-medium">{zh.paper.avgCost}</th>
                            <th className="px-4 py-2 font-medium">{zh.paper.mark}</th>
                            <th className="px-4 py-2 font-medium">{zh.paper.pnl}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {initial.positions.length === 0 ? (
                            <tr>
                                <td className="px-4 py-3 text-faint" colSpan={5}>{zh.paper.noPositions}</td>
                            </tr>
                        ) : initial.positions.map((position) => (
                            <tr key={position.symbol} className="border-t border-line">
                                <td className="px-4 py-2 mono font-semibold">
                                    {position.symbol}{' '}
                                    <span className="text-[11px] font-normal text-faint">{quoteSourceLabel(position.quoteSource)}</span>
                                </td>
                                <td className="px-4 py-2 mono">{position.qty}</td>
                                <td className="px-4 py-2 mono">{formatUsd(position.avgCost)}</td>
                                <td className="px-4 py-2 mono">
                                    {position.markPrice == null ? zh.paper.markUnavailable : formatUsd(position.markPrice)}
                                    <span className="mt-0.5 block text-[11px] text-faint">{formatTaipei(position.quoteAsOf)}</span>
                                </td>
                                <td className={`px-4 py-2 mono ${(position.unrealizedPnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {position.unrealizedPnl == null ? '—' : formatUsd(position.unrealizedPnl)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="grid gap-3 xl:grid-cols-2">
                <div className="card overflow-x-auto p-0">
                    <div className="section-head px-4 pt-4">
                        <h3 className="section-title text-[15px]">{zh.paper.historySignals}</h3>
                        <p className="section-sub">{zh.paper.historyNote}</p>
                    </div>
                    <ul className="divide-y divide-line">
                        {initial.signals.length === 0 ? (
                            <li className="px-4 py-3 text-[13px] text-faint">{zh.paper.noSignals}</li>
                        ) : initial.signals.map((signal) => (
                            <li key={signal._id} className="px-4 py-3 text-[13px]">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full bg-hover px-2 py-0.5 text-[11px]">歷史紀錄</span>
                                    <span className="mono font-semibold">{signal.symbol}</span>
                                    <span className="rounded-full bg-hover px-2 py-0.5 text-[11px]">{actionLabel(signal.action)}</span>
                                    <span className="text-[11px] text-faint">{signal.executable ? zh.paper.executable : zh.paper.notExecutable}</span>
                                    {signal.autoSubmitted ? <span className="text-[11px] text-brand-ink">{zh.paper.autoTraded}</span> : <span className="text-[11px] text-faint">{zh.paper.notAuto}</span>}
                                    <span className="ml-auto text-[11px] text-faint">{formatTaipei(signal.createdAt)}</span>
                                </div>
                                <p className="mt-1 text-faint">{signal.rationale}</p>
                                <p className="mt-1 text-[11px] text-faint">
                                    {zh.paper.sourceHistory}：{historySourceLabel(signal.historySource)}
                                    {signal.barTimestamp ? ` · ${zh.paper.bar} ${signal.barTimestamp}` : ''}
                                    {' · '}
                                    {zh.paper.sourceQuote}：{quoteSourceLabel(signal.quoteSource)}
                                </p>
                                {signal.blockReason && <p className="mt-1 text-[12px] text-amber-200">{zh.paper.reason}：{signal.blockReason}</p>}
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="card overflow-x-auto p-0">
                    <div className="section-head px-4 pt-4">
                        <h3 className="section-title text-[15px]">{zh.paper.historyOrders}</h3>
                        <p className="section-sub">{zh.paper.historyNote}</p>
                    </div>
                    <ul className="divide-y divide-line">
                        {initial.orders.length === 0 ? (
                            <li className="px-4 py-3 text-[13px] text-faint">{zh.paper.noOrders}</li>
                        ) : initial.orders.map((order) => (
                            <li key={order._id} className="px-4 py-3 text-[13px]">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full bg-hover px-2 py-0.5 text-[11px]">歷史紀錄</span>
                                    <span className="mono font-semibold">
                                        {actionLabel(order.side)} {order.qty} {order.symbol}
                                    </span>
                                    <span className="mono text-faint">@ {formatUsd(order.price)}</span>
                                    <span className="rounded-full bg-hover px-2 py-0.5 text-[11px]">{orderStatusLabel(order.status)}</span>
                                    <span className="text-[11px] text-faint">{orderSourceLabel(order.source)} · {quoteSourceLabel(order.quoteSource)}</span>
                                    <span className="ml-auto text-[11px] text-faint">{formatTaipei(order.createdAt)}</span>
                                </div>
                                {order.reason && <p className="mt-1 text-faint">{order.reason}</p>}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}
