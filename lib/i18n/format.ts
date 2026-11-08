/**
 * Display locale for the Traditional Chinese interface.
 * Amounts stay labelled USD. Clock times use Asia/Taipei (UTC+8, no daylight saving).
 * Stock symbols and provider ids are not translated here.
 */

export const HTML_LANG = 'zh-Hant';
export const UI_LOCALE = 'zh-Hant-HK';
export const UI_TIME_ZONE = 'Asia/Taipei';
export const UI_TIME_ZONE_LABEL = '台北時間 UTC+8';

const usdFormatter = new Intl.NumberFormat(UI_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const qtyFormatter = new Intl.NumberFormat(UI_LOCALE, {
    maximumFractionDigits: 0,
});

const dateTimeFormatter = new Intl.DateTimeFormat(UI_LOCALE, {
    timeZone: UI_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
});

/** USD with an explicit currency code so it is not read as HKD. */
export function formatUsd(value: number): string {
    if (!Number.isFinite(value)) return 'USD —';
    const sign = value < 0 ? '-' : '';
    return `${sign}USD ${usdFormatter.format(Math.abs(value))}`;
}

export function formatQty(value: number): string {
    if (!Number.isFinite(value)) return '—';
    return qtyFormatter.format(value);
}

export function formatTaipei(input: Date | string | number | null | undefined): string {
    if (input == null || input === '') return '—';
    const date = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(date.getTime())) return '—';
    return `${dateTimeFormatter.format(date)}（${UI_TIME_ZONE_LABEL}）`;
}
