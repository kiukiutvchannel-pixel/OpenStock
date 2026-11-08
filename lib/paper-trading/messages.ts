/**
 * PAPER TRADING ONLY — user-visible Traditional Chinese messages.
 * These strings never include provider bodies, URLs, or API keys.
 */

export type DataIssue =
    | 'missing'
    | 'permission'
    | 'rate_limit'
    | 'network'
    | 'invalid'
    | 'insufficient'
    | 'unsorted'
    | 'duplicate_date'
    | 'non_trading_day'
    | 'non_positive'
    | 'future'
    | 'gap'
    | 'stale'
    | 'demo';

export function historyIssueMessage(issue: DataIssue): string {
    switch (issue) {
        case 'missing':
            return '沒有可用的日線（未設定供應商或沒有回傳）。沒有用假歷史代替，因此不會產生可執行訊號。';
        case 'permission':
            return '資料供應商拒絕存取（權限不足或金鑰無效）。沒有用假歷史代替，因此不會產生可執行訊號。';
        case 'rate_limit':
            return '資料供應商回傳速率限制。請稍後再試。沒有用假歷史代替，因此不會產生可執行訊號。';
        case 'network':
            return '未能連上資料供應商（逾時或網絡錯誤）。沒有用假歷史代替，因此不會產生可執行訊號。';
        case 'insufficient':
            return '有效的日期日線少於 21 根，不足以計算上一根同目前的 SMA(10)/SMA(20) 交叉。不會產生可執行訊號。';
        case 'duplicate_date':
            return '日線有重複日期，不能當成可靠歷史。不會產生可執行訊號。';
        case 'non_trading_day':
            return '日線落在週末或休市日，不能當成可靠歷史。不會產生可執行訊號。';
        case 'non_positive':
            return '日線收市價無效。不會產生可執行訊號。';
        case 'future':
            return '日線日期在未來，不能當成可靠歷史。不會產生可執行訊號。';
        case 'gap':
            return '日線中間缺了一大段交易日，不能當成可靠歷史。不會產生可執行訊號。';
        case 'stale':
            return '最新日線不是最近一個已完成的紐約交易日，資料過期。不會產生可執行訊號。';
        case 'invalid':
            return '日線格式無效。不會產生可執行訊號。';
        case 'demo':
            return '示範模式的數字是虛構的，不能自動落單，也不能當作真實成交。';
        default:
            return '日線未能通過檢查。不會產生可執行訊號。';
    }
}

export function quoteIssueMessage(issue: DataIssue | 'mock'): string {
    if (issue === 'demo' || issue === 'mock') {
        return '報價是示範或虛構數字，不是可成交的真實報價。不會自動落單。';
    }
    if (issue === 'permission') return '報價供應商拒絕存取。不會用虛構報價落單。';
    if (issue === 'rate_limit') return '報價供應商速率限制。不會用虛構報價落單。';
    if (issue === 'network') return '未能取得報價（逾時或網絡錯誤）。不會用虛構報價落單。';
    if (issue === 'stale') return '報價過期或不是最近一個交易時段的成交。不會用這口價落單。';
    if (issue === 'missing') return '沒有真實報價。不會用虛構報價落單。';
    return '報價未能通過檢查。不會落單。';
}

export const FILL_MESSAGES = {
    insufficient_cash: '模擬現金不足',
    insufficient_shares: '模擬持股不足',
    exposure_cap: '已達到持倉上限（單一代號或全部持倉）',
    exposure_unverified: '有持倉缺少有效報價，未能核對持倉上限，因此拒絕買入',
    quote_not_executable: '報價不是可用的真實報價（缺失、過期或示範），拒絕成交',
    bad_qty: '股數必須是正整數',
    bad_price: '價格必須是正數',
    bad_symbol: '代號格式不正確',
    duplicate_bar: '同一帳戶、代號、策略、方向同這根 K 線已經處理過，不會重複成交',
    not_executable: '訊號不可執行，不會自動落單',
    auto_off: '自動提交已關閉',
    demo: '示範模式不能落單',
    no_cross: '沒有新的均線交叉，分析師評級不會單獨產生買賣',
} as const;

export type FillCode = keyof typeof FILL_MESSAGES;

export function classifyHttpStatus(status: number): DataIssue {
    if (status === 401 || status === 403) return 'permission';
    if (status === 429) return 'rate_limit';
    return 'network';
}

export function classifyFetchError(error: unknown): DataIssue {
    const name = error instanceof Error ? error.name : '';
    if (name === 'TimeoutError' || name === 'AbortError') return 'network';
    return 'network';
}
