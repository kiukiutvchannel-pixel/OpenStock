import { Suspense } from 'react';
import { Plus } from 'lucide-react';
import { getUserWatchlist } from '@/lib/actions/watchlist.actions';
import { getUserAlerts } from '@/lib/actions/alert.actions';
import { alertsEnabled } from '@/lib/market-data';
import { getNews, getWatchlistData } from '@/lib/actions/finnhub.actions';
import WatchlistTable from '@/components/watchlist/WatchlistTable';
import AlertsPanel from '@/components/watchlist/AlertsPanel';
import NewsList from '@/components/watchlist/NewsList';
import Panel from '@/components/Panel';
import DataFreshness from '@/components/DataFreshness';
import { SearchButton } from '@/components/SearchCommand';
import { zh } from '@/lib/i18n/zh-Hant';

const RowsSkeleton = ({ rows = 4 }: { rows?: number }) => (
    <div className="row-list" aria-busy="true">
        {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-3.5 py-3.5">
                <span className="size-8 animate-pulse rounded-full bg-hover" />
                <span className="h-3.5 flex-1 animate-pulse rounded-md bg-hover" />
                <span className="h-3.5 w-20 animate-pulse rounded-md bg-hover" />
            </div>
        ))}
    </div>
);

async function Symbols({ symbols }: { symbols: string[] }) {
    return <WatchlistTable initialRows={await getWatchlistData(symbols)} />;
}

async function News({ symbols }: { symbols: string[] }) {
    return <NewsList news={await getNews(symbols).catch(() => [] as MarketNewsArticle[])} />;
}

// DB reads render first; everything from Finnhub streams in behind skeletons.
export default async function WatchlistPage() {
    const [items, alerts] = await Promise.all([getUserWatchlist(), getUserAlerts()]);
    const symbols: string[] = items.map((item: { symbol: string }) => item.symbol);
    const activeAlerts = alerts.filter((a: { triggered?: boolean }) => !a.triggered).length;

    return (
        <>
            <header className="page-head">
                <div>
                    <h1 className="page-title">{zh.watchlist.title}</h1>
                    <p className="page-sub num flex flex-wrap items-center gap-x-2">
                        {zh.watchlist.symbolCount(symbols.length)} <span aria-hidden>·</span> <DataFreshness />
                    </p>
                </div>
                <SearchButton className="btn btn-primary"><Plus /> {zh.watchlist.add}</SearchButton>
            </header>

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
                <div className="flex min-w-0 flex-col gap-3">
                    <Panel title={zh.watchlist.symbols} sub={zh.watchlist.symbolsSub}>
                        <Suspense fallback={<RowsSkeleton rows={Math.max(1, Math.min(symbols.length, 6))} />}>
                            <Symbols symbols={symbols} />
                        </Suspense>
                    </Panel>
                    <Panel title={zh.watchlist.news} sub={symbols.length ? zh.watchlist.newsForSymbols : zh.watchlist.newsGeneral}>
                        <Suspense fallback={<RowsSkeleton />}>
                            <News symbols={symbols} />
                        </Suspense>
                    </Panel>
                </div>

                <Panel title={zh.watchlist.alerts} sub={alertsEnabled ? zh.watchlist.alertsActive(activeAlerts) : zh.watchlist.alertsCloud} className="self-start">
                    <AlertsPanel alerts={alerts} />
                </Panel>
            </div>
        </>
    );
}
