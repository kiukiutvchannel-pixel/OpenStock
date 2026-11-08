'use client';

import { useEffect, useState } from "react";
import { isRealtime } from "@/lib/market-data";
import { UI_LOCALE, UI_TIME_ZONE } from "@/lib/i18n/format";
import { zh } from "@/lib/i18n/zh-Hant";

// Honest label for how old a number is: "Live" in realtime mode, otherwise the time of the last trade.
// The time is formatted after mount, in the viewer's own time zone, so server and browser never disagree.
const DataFreshness = ({ tradeTime }: { tradeTime?: number }) => {
    const [asOf, setAsOf] = useState<string | null>(null);

    useEffect(() => {
        setAsOf(tradeTime
            ? new Date(tradeTime * 1000).toLocaleString(UI_LOCALE, { timeZone: UI_TIME_ZONE, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
            : null);
    }, [tradeTime]);

    if (isRealtime) {
        return <span className="inline-flex items-center gap-1.5 text-[12px] text-faint"><span className="live-dot" /> {zh.freshness.live}</span>;
    }
    return <span className="text-[12px] text-faint">{asOf ? zh.freshness.asOf(asOf) : zh.freshness.delayed} · {zh.freshness.hourly}</span>;
};

export default DataFreshness;
