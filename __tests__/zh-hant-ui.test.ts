import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HTML_LANG, formatTaipei, formatUsd } from '@/lib/i18n/format';
import { zh } from '@/lib/i18n/zh-Hant';
import { historySourceLabel, quoteSourceLabel } from '@/lib/paper-trading/labels';

const source = (path: string) => readFileSync(path, 'utf8');

describe('Traditional Chinese interface', () => {
    it('formats USD and Asia/Taipei explicitly', () => {
        expect(HTML_LANG).toBe('zh-Hant');
        expect(formatUsd(100000)).toContain('USD');
        expect(formatUsd(100000)).not.toContain('HK$');
        expect(formatUsd(-12.5).startsWith('-USD')).toBe(true);
        const stamp = formatTaipei('2026-11-04T21:30:00.000Z');
        expect(stamp).toContain('台北時間 UTC+8');
        expect(stamp).toContain('05:30');
        expect(source('app/layout.tsx')).toContain('lang="zh-Hant"');
    });

    it('keeps history and quote labels distinct and drops the fake win rate', () => {
        expect(historySourceLabel('finnhub-candle')).toBe('Finnhub 日線');
        expect(quoteSourceLabel('finnhub')).toBe('Finnhub 報價');
        expect(historySourceLabel('finnhub')).not.toBe(quoteSourceLabel('finnhub'));
        expect(historySourceLabel('demo')).toContain('虛構');
        expect(quoteSourceLabel('mock')).toContain('虛構');
        expect(zh.paper.noConfidence).toContain('勝率');
        expect(zh.paper.historySignals).toBe('歷史訊號');
        expect(zh.paper.historyNote).toContain('不是目前持倉旗標');
    });

    it('puts Traditional Chinese on the signed-in shell, auth forms, and paper page', () => {
        const sidebar = source('components/shell/Sidebar.tsx');
        const tabs = source('components/shell/TabBar.tsx');
        const dashboard = source('app/(root)/dashboard/page.tsx');
        const search = source('components/SearchCommand.tsx');
        const watchlist = source('app/(root)/watchlist/page.tsx');
        const signIn = source('app/(auth)/sign-in/page.tsx');
        const signUp = source('app/(auth)/sign-up/page.tsx');
        const paper = source('components/paper-trading/PaperTradingClient.tsx');
        const widgets = source('lib/constants.ts');

        expect(sidebar).toContain('zh.nav.dashboard');
        expect(sidebar).toContain('zh.nav.watchlist');
        expect(sidebar).toContain('zh.nav.paper');
        expect(sidebar).not.toContain('> Overview');
        expect(sidebar).not.toContain('Search stocks');
        expect(tabs).toContain("'/paper-trading': zh.nav.paperShort");
        expect(dashboard).toContain('zh.dashboard.title');
        expect(search).toContain('zh.search.placeholder');
        expect(watchlist).toContain('zh.watchlist.title');
        expect(signIn).toContain('zh.auth.welcome');
        expect(signIn).toContain('zh.auth.signIn');
        expect(signIn).not.toContain('Welcome back');
        expect(signUp).toContain('zh.auth.createTitle');
        expect(signUp).not.toContain('Create your account');
        expect(paper).toContain('zh.paper.historySignals');
        expect(paper).toContain('歷史紀錄');
        expect(paper).toContain('zh.paper.autoLabel');
        expect(paper).not.toContain('confidence');
        expect(paper).not.toContain('Run analysis now');
        expect(widgets).toContain("locale: 'zh_TW'");
        expect(widgets).toContain("timezone: 'Asia/Taipei'");
        expect(zh.nav.dashboard).toBe('總覽');
        expect(zh.nav.watchlist).toBe('自選股');
        expect(zh.auth.emailRequired).toBe('請填寫電郵');
        expect(zh.auth.signIn).toBe('登入');
    });
});