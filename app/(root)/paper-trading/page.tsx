import PaperTradingClient from '@/components/paper-trading/PaperTradingClient';
import { getPaperTradingSnapshot } from '@/lib/actions/paper-trading.actions';
import { zh } from '@/lib/i18n/zh-Hant';

/**
 * PAPER TRADING ONLY — simulated analysis and paper orders.
 * Not financial advice. This page never places live brokerage orders.
 * Upstream: Open-Dev-Society/OpenStock (AGPL-3.0).
 */
export const metadata = { title: '模擬交易 | 穩步' };

export default async function PaperTradingPage() {
    const snapshot = await getPaperTradingSnapshot();

    return (
        <>
            <header className="page-head">
                <div>
                    <h1 className="page-title">{zh.paper.title}</h1>
                    <p className="page-sub">{zh.paper.subtitle}</p>
                </div>
            </header>
            <p className="mb-3 text-[12.5px] text-faint">{zh.paper.startingNote}</p>
            <PaperTradingClient initial={snapshot} />
        </>
    );
}
