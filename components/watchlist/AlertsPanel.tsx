"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellRing, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteAlert } from "@/lib/actions/alert.actions";
import { alertsEnabled } from "@/lib/market-data";
import { formatPrice } from "@/lib/utils";
import { UI_LOCALE, UI_TIME_ZONE } from "@/lib/i18n/format";
import { zh } from "@/lib/i18n/zh-Hant";

type AlertRow = {
    _id: string;
    symbol: string;
    targetPrice: number;
    condition: 'ABOVE' | 'BELOW';
    triggered?: boolean;
    active?: boolean;
    expiresAt?: string;
};

const statusOf = (alert: AlertRow) => {
    if (alert.triggered) return { label: zh.alerts.triggered, className: 'pill is-brand' };
    if (!alertsEnabled) return { label: zh.alerts.paused, className: 'pill' };
    if (alert.expiresAt && new Date(alert.expiresAt) < new Date()) return { label: zh.alerts.expired, className: 'pill' };
    if (alert.active === false) return { label: zh.alerts.paused, className: 'pill' };
    return { label: zh.alerts.watching, className: 'pill is-up' };
};

export default function AlertsPanel({ alerts }: { alerts: AlertRow[] }) {
    const router = useRouter();
    const [pendingId, setPendingId] = useState<string | null>(null);

    const handleDelete = async (alert: AlertRow) => {
        setPendingId(alert._id);
        try {
            await deleteAlert(alert._id);
            toast.success(zh.alerts.removed(alert.symbol));
            router.refresh();
        } catch {
            toast.error(zh.alerts.removeFailed);
        } finally {
            setPendingId(null);
        }
    };

    if (alerts.length === 0 && !alertsEnabled) {
        return (
            <div className="empty-state py-10">
                <span className="empty-icon"><BellRing className="size-5" /></span>
                <h3>{zh.alerts.cloudTitle}</h3>
                <p className="max-w-64 text-[13px]">{zh.alerts.cloudBody}</p>
                <Link href="/#data" className="btn btn-ghost mt-2">{zh.alerts.seeCloud}</Link>
            </div>
        );
    }

    if (alerts.length === 0) {
        return (
            <div className="empty-state py-10">
                <span className="empty-icon"><BellRing className="size-5" /></span>
                <h3>{zh.alerts.emptyTitle}</h3>
                <p className="max-w-60 text-[13px]">{zh.alerts.emptyBody}</p>
            </div>
        );
    }

    return (
        <>
            {!alertsEnabled && (
                <p className="px-3 pt-3 pb-1 text-[12.5px] text-faint">
                    {zh.alerts.pausedNote} <Link href="/#data" className="text-brand-ink hover:underline">穩步雲端</Link>，所以這些提示暫停了。
                </p>
            )}
            <ul className="row-list">
                {alerts.map((alert) => {
                    const status = statusOf(alert);
                    return (
                        <li key={alert._id} className="flex items-center gap-3 px-3 py-2.5">
                            <div className="min-w-0 flex-1">
                                <p className="mono font-semibold text-foreground">{alert.symbol}</p>
                                <p className="num truncate text-[12.5px] text-faint">
                                    {alert.condition === 'ABOVE' ? zh.alerts.above : zh.alerts.below} {formatPrice(alert.targetPrice)}
                                    {alert.expiresAt && !alert.triggered && ` · ${zh.alerts.until} ${new Date(alert.expiresAt).toLocaleDateString(UI_LOCALE, { timeZone: UI_TIME_ZONE, month: 'numeric', day: 'numeric' })}`}
                                </p>
                            </div>
                            <span className={status.className}>{status.label}</span>
                            <button
                                type="button"
                                onClick={() => handleDelete(alert)}
                                disabled={pendingId === alert._id}
                                className="icon-btn is-danger"
                                title={zh.alerts.remove}
                                aria-label={zh.alerts.removeFor(alert.symbol)}
                            >
                                <Trash2 />
                            </button>
                        </li>
                    );
                })}
            </ul>
        </>
    );
}
