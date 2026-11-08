import { Suspense } from "react";
import { cookies } from "next/headers";
import TradingViewWidget from "@/components/TradingViewWidget";
import Panel from "@/components/Panel";
import IndexPulse, { PulseSkeleton } from "@/components/IndexPulse";
import DataFreshness from "@/components/DataFreshness";
import MarketSwitcher from "@/components/MarketSwitcher";
import SaudiQuotesTable, { SaudiMovers } from "@/components/SaudiQuotes";
import {
    CRYPTO_HEATMAP_CONFIG,
    STOCK_HEATMAP_CONFIG,
    marketOverviewConfig,
    marketQuotesConfig,
    timelineConfig,
} from "@/lib/constants";
import { MARKETS, MARKET_COOKIE, getMarket, isMarketOpen, marketForCountry } from "@/lib/markets";
import { getSession } from "@/lib/better-auth/auth";
import { zh } from "@/lib/i18n/zh-Hant";

const scriptUrl = `https://s3.tradingview.com/external-embedding/embed-widget-`;

// Widgets come from TradingView (live, no Finnhub quota) and render immediately; the tiles stream in.
export default async function Dashboard({ searchParams }: { searchParams: Promise<{ market?: string }> }) {
    const { market: requested } = await searchParams;
    // Explicit choice, then the remembered one, then the market of the user's country
    const saved = (await cookies()).get(MARKET_COOKIE)?.value;
    const market = getMarket(requested ?? saved ?? marketForCountry((await getSession())?.user.country));
    const open = isMarketOpen(market);
    const native = market.pulse.some((p) => p.finnhub);
    const marketName = zh.dashboard.markets[market.id] ?? market.name;
    const feedLabel = zh.dashboard.feed[market.feed] ?? market.feed;
    const groups = market.groups.map((group) => ({ ...group, title: zh.dashboard.groups[group.title] ?? group.title }));
    const pulseSub = native ? zh.dashboard.pulseFinnhub : market.yahoo ? zh.dashboard.pulseYahoo : zh.dashboard.pulseTradingView(feedLabel);
    const heatmap = market.heatmap === 'stocks'
        ? { script: 'stock-heatmap.js', config: STOCK_HEATMAP_CONFIG, title: zh.dashboard.heatmapSp }
        : market.heatmap === 'crypto'
            ? { script: 'crypto-coins-heatmap.js', config: CRYPTO_HEATMAP_CONFIG, title: zh.dashboard.heatmapCrypto }
            : null;

    return (
        <>
            <header className="page-head">
                <div>
                    <h1 className="page-title">{zh.dashboard.title}</h1>
                    <p className="page-sub">{marketName} · {open ? zh.dashboard.openNow : zh.dashboard.closedNow} · {feedLabel}</p>
                </div>
            </header>

            <MarketSwitcher active={market.id} openIds={MARKETS.filter((m) => isMarketOpen(m)).map((m) => m.id)} />

            <section className="hatch">
                <div className="section-head">
                    <div>
                        <h2 className="section-title">{zh.dashboard.pulse}</h2>
                        <p className="section-sub">{pulseSub}</p>
                    </div>
                    {native && <DataFreshness />}
                </div>
                {/* Keyed so switching markets swaps the tiles instead of reusing old widgets */}
                <Suspense key={market.id} fallback={<PulseSkeleton />}>
                    <IndexPulse market={market} />
                </Suspense>
            </section>

            <div key={market.id} className="flex flex-col gap-3">
                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                    {market.yahoo ? (
                        <Panel title={zh.dashboard.movers} sub={zh.dashboard.moversSub}>
                            <SaudiMovers market={market} />
                        </Panel>
                    ) : (
                        <Panel title={zh.dashboard.leaders} sub={zh.dashboard.leadersSub}>
                            <TradingViewWidget scriptUrl={`${scriptUrl}market-overview.js`} config={marketOverviewConfig(groups)} height={560} />
                        </Panel>
                    )}
                    {heatmap ? (
                        <Panel title={heatmap.title} sub={zh.dashboard.heatmapSub}>
                            <TradingViewWidget scriptUrl={`${scriptUrl}${heatmap.script}`} config={heatmap.config} height={560} allowExpand />
                        </Panel>
                    ) : (
                        <Panel title={zh.dashboard.quotes} sub={zh.dashboard.quotesSub(marketName)}>
                            {market.yahoo
                                ? <SaudiQuotesTable market={market} />
                                : <TradingViewWidget scriptUrl={`${scriptUrl}market-quotes.js`} config={marketQuotesConfig(groups)} height={560} />}
                        </Panel>
                    )}
                </div>

                <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                    {heatmap && (
                        <Panel title={zh.dashboard.quotes} sub={zh.dashboard.quotesSub(marketName)}>
                            <TradingViewWidget scriptUrl={`${scriptUrl}market-quotes.js`} config={marketQuotesConfig(groups)} height={560} />
                        </Panel>
                    )}
                    <Panel title={zh.dashboard.stories} sub={zh.dashboard.storiesSub} className={heatmap ? '' : 'xl:col-span-2'}>
                        <TradingViewWidget scriptUrl={`${scriptUrl}timeline.js`} config={timelineConfig(market.news)} height={560} />
                    </Panel>
                </div>
            </div>
        </>
    );
}
