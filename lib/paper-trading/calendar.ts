/**
 * PAPER TRADING ONLY — NYSE session dates for freshness checks.
 * Weekends and full-day holidays are not trading days. Early closes still count
 * as sessions because a daily close exists. An unlisted closure fails closed
 * (the latest bar will look stale) rather than treating missing data as tradable.
 */

const NYSE_HOLIDAYS = new Set<string>([
    // 2024
    '2024-01-01', '2024-01-15', '2024-02-19', '2024-03-29', '2024-05-27', '2024-06-19',
    '2024-07-04', '2024-09-02', '2024-11-28', '2024-12-25',
    // 2025 (Jan 9: National Day of Mourning)
    '2025-01-01', '2025-01-09', '2025-01-20', '2025-02-17', '2025-04-18', '2025-05-26',
    '2025-06-19', '2025-07-04', '2025-09-01', '2025-11-27', '2025-12-25',
    // 2026 (Jul 4 is Saturday; observed Friday Jul 3)
    '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19',
    '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
    // 2027 (Juneteenth Saturday → Jun 18; Independence Sunday → Jul 5; Christmas Saturday → Dec 24; New Year 2028 Saturday → Dec 31)
    '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31', '2027-06-18',
    '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24', '2027-12-31',
    // 2028
    '2028-01-17', '2028-02-21', '2028-04-14', '2028-05-29', '2028-06-19', '2028-07-04',
    '2028-09-04', '2028-11-23', '2028-12-25',
]);

export const NYSE_TIME_ZONE = 'America/New_York';

export type ZonedParts = {
    ymd: string;
    hour: number;
    minute: number;
    weekday: string;
};

export function zonedParts(date: Date, timeZone = NYSE_TIME_ZONE): ZonedParts {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'short',
        hourCycle: 'h23',
    }).formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
    let hour = Number(get('hour'));
    if (hour === 24) hour = 0;
    const year = get('year');
    const month = get('month');
    const day = get('day');
    return {
        ymd: `${year}-${month}-${day}`,
        hour,
        minute: Number(get('minute')),
        weekday: get('weekday'),
    };
}

export function isWeekendYmd(ymd: string): boolean {
    const noon = new Date(`${ymd}T17:00:00.000Z`);
    const weekday = zonedParts(noon).weekday;
    return weekday === 'Sat' || weekday === 'Sun';
}

export function isNyseTradingDay(ymd: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(ymd) && !isWeekendYmd(ymd) && !NYSE_HOLIDAYS.has(ymd);
}

export function addCalendarDays(ymd: string, days: number): string {
    const [year, month, day] = ymd.split('-').map(Number);
    const utc = new Date(Date.UTC(year, month - 1, day + days, 17, 0, 0));
    return utc.toISOString().slice(0, 10);
}

export function calendarDaysBetween(earlier: string, later: string): number {
    const a = Date.parse(`${earlier}T00:00:00Z`);
    const b = Date.parse(`${later}T00:00:00Z`);
    return Math.round((b - a) / 86_400_000);
}

/** Previous NYSE session strictly before `ymd` (ymd itself need not be a session). */
export function previousTradingDay(ymd: string): string {
    let cursor = addCalendarDays(ymd, -1);
    for (let i = 0; i < 14; i += 1) {
        if (isNyseTradingDay(cursor)) return cursor;
        cursor = addCalendarDays(cursor, -1);
    }
    return cursor;
}

/**
 * Latest session whose daily close should exist.
 * Before 16:10 America/New_York on a trading day, today's bar is still incomplete.
 */
export function latestCompletedSession(now: Date, closeGraceMinutes = 10): string {
    const zoned = zonedParts(now);
    const minutes = zoned.hour * 60 + zoned.minute;
    const closeMinutes = 16 * 60 + closeGraceMinutes;
    if (isNyseTradingDay(zoned.ymd) && minutes >= closeMinutes) return zoned.ymd;
    return previousTradingDay(zoned.ymd);
}

/** Regular US cash session, used only to judge whether a quote should be from today. */
export function isRegularSessionOpen(now: Date): boolean {
    const zoned = zonedParts(now);
    if (!isNyseTradingDay(zoned.ymd)) return false;
    const minutes = zoned.hour * 60 + zoned.minute;
    return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}

export function tradingDaysEnding(end: string, count: number): string[] {
    if (!isNyseTradingDay(end)) {
        throw new Error(`tradingDaysEnding expects a NYSE session, received ${end}`);
    }
    const dates = [end];
    let cursor = end;
    while (dates.length < count) {
        cursor = previousTradingDay(cursor);
        dates.push(cursor);
    }
    return dates.reverse();
}

/**
 * Map a Finnhub daily candle unix time to a session date.
 * Midnight UTC is their placeholder for that UTC calendar date (it is later
 * rewritten to the open). Any other timestamp uses the New York calendar date,
 * which matches a 09:30 America/New_York open.
 */
export function sessionDateFromUnix(unixSeconds: number): string | null {
    if (!Number.isFinite(unixSeconds)) return null;
    const utc = new Date(unixSeconds * 1000);
    if (Number.isNaN(utc.getTime())) return null;
    const midnightUtc = utc.getUTCHours() === 0 && utc.getUTCMinutes() === 0 && utc.getUTCSeconds() === 0;
    if (midnightUtc) return utc.toISOString().slice(0, 10);
    return zonedParts(utc).ymd;
}
