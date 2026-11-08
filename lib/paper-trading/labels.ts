/** Display labels. Symbols and provider ids stay recognizable; the words around them are zh-Hant. */

export function historySourceLabel(source: string | null | undefined): string {
    switch (source) {
        case 'finnhub-candle':
            return 'Finnhub 日線';
        case 'futu-opend':
            return '富途 OpenD';
        case 'demo':
            return '示範（虛構歷史）';
        case 'mock':
        case 'mock-series':
            return '虛構歷史（不可用來落單）';
        default:
            return '未能取得日線';
    }
}

export function quoteSourceLabel(source: string | null | undefined): string {
    switch (source) {
        case 'finnhub':
            return 'Finnhub 報價';
        case 'demo':
            return '示範（虛構報價）';
        case 'mock':
            return '虛構報價（不可用來落單）';
        default:
            return '未能取得報價';
    }
}

export function actionLabel(action: string | null | undefined): string {
    if (action === 'buy') return '買入';
    if (action === 'sell') return '賣出';
    if (action === 'hold') return '觀望';
    return action ?? '—';
}

export function orderStatusLabel(status: string | null | undefined): string {
    if (status === 'filled') return '已成交';
    if (status === 'rejected') return '已拒絕';
    return status ?? '—';
}

export function orderSourceLabel(source: string | null | undefined): string {
    if (source === 'auto') return '自動';
    if (source === 'manual') return '手動';
    return source ?? '—';
}
