import { zh } from '@/lib/i18n/zh-Hant';

// Community links, used across the app, landing page and emails
export const REPO_URL = 'https://github.com/Open-Dev-Society/OpenStock';
// GitHub account that receives sponsorships. Switch to 'Open-Dev-Society' once the org's
// GitHub Sponsors listing is live (github.com/sponsors/Open-Dev-Society); every link follows.
export const SPONSOR_GITHUB_ACCOUNT = 'ravixalgorithm';
export const SPONSOR_URL = `https://github.com/sponsors/${SPONSOR_GITHUB_ACCOUNT}`;
// Opens GitHub's checkout with the amount and frequency already picked
export const sponsorCheckoutUrl = (amount?: number, frequency: 'recurring' | 'one-time' = 'recurring') =>
    `${SPONSOR_URL}/sponsorships?frequency=${frequency}${amount ? `&amount=${amount}` : ''}`;
export const DISCORD_URL = 'https://discord.gg/JkJ8kfxgxB';
export const GOOD_FIRST_ISSUES_URL = `${REPO_URL}/issues?q=is%3Aopen+label%3A%22good+first+issue%22`;

// Sign-up form select options
export const INVESTMENT_GOALS = [
    { value: 'Growth', label: zh.auth.goals.Growth },
    { value: 'Income', label: zh.auth.goals.Income },
    { value: 'Balanced', label: zh.auth.goals.Balanced },
    { value: 'Conservative', label: zh.auth.goals.Conservative },
];

export const RISK_TOLERANCE_OPTIONS = [
    { value: 'Low', label: zh.auth.risks.Low },
    { value: 'Medium', label: zh.auth.risks.Medium },
    { value: 'High', label: zh.auth.risks.High },
];

export const PREFERRED_INDUSTRIES = [
    { value: 'Technology', label: zh.auth.industries.Technology },
    { value: 'Healthcare', label: zh.auth.industries.Healthcare },
    { value: 'Finance', label: zh.auth.industries.Finance },
    { value: 'Energy', label: zh.auth.industries.Energy },
    { value: 'Consumer Goods', label: zh.auth.industries['Consumer Goods'] },
];

export const ALERT_TYPE_OPTIONS = [
    { value: 'upper', label: 'Upper' },
    { value: 'lower', label: 'Lower' },
];

export const CONDITION_OPTIONS = [
    { value: 'greater', label: 'Greater than (>)' },
    { value: 'less', label: 'Less than (<)' },
];

// TradingView widgets, built per market from lib/markets.ts groups
type SymbolGroup = { title: string; symbols: [symbol: string, name: string][] };

export const marketOverviewConfig = (groups: SymbolGroup[]) => ({
    colorTheme: 'dark',
    dateRange: '12M',
    locale: 'zh_TW',
    largeChartUrl: '',
    isTransparent: true,
    showFloatingTooltip: true,
    plotLineColorGrowing: '#47d9bb', // brand teal (oklch 0.80 0.13 176)
    plotLineColorFalling: '#47d9bb',
    gridLineColor: 'rgba(240, 243, 250, 0)',
    scaleFontColor: '#adaba3', // --muted
    belowLineFillColorGrowing: 'rgba(71, 217, 187, 0.12)',
    belowLineFillColorFalling: 'rgba(71, 217, 187, 0.12)',
    belowLineFillColorGrowingBottom: 'rgba(71, 217, 187, 0)',
    belowLineFillColorFallingBottom: 'rgba(71, 217, 187, 0)',
    symbolActiveColor: 'rgba(71, 217, 187, 0.08)',
    tabs: groups.map(({ title, symbols }) => ({ title, symbols: symbols.map(([s, d]) => ({ s, d })) })),
    support_host: 'https://www.tradingview.com',
    showSymbolLogo: true,
    showChart: true,
});

export const marketQuotesConfig = (groups: SymbolGroup[]) => ({
    locale: 'zh_TW',
    showSymbolLogo: true,
    colorTheme: 'dark',
    isTransparent: true,
    symbolsGroups: groups.map(({ title, symbols }) => ({ name: title, symbols: symbols.map(([name, displayName]) => ({ name, displayName })) })),
});

export const STOCK_HEATMAP_CONFIG = {
    dataSource: 'SPX500',
    blockSize: 'market_cap_basic',
    blockColor: 'change',
    grouping: 'sector',
    isTransparent: true,
    locale: 'zh_TW',
    symbolUrl: '',
    colorTheme: 'dark',
    exchanges: [],
    hasTopBar: false,
    isDataSetEnabled: false,
    isZoomEnabled: true,
    hasSymbolTooltip: true,
    isMonoSize: false,
};

export const CRYPTO_HEATMAP_CONFIG = {
    dataSource: 'Crypto',
    blockSize: 'market_cap_calc',
    blockColor: 'change',
    locale: 'zh_TW',
    symbolUrl: '',
    colorTheme: 'dark',
    hasTopBar: false,
    isDataSetEnabled: false,
    isZoomEnabled: true,
    hasSymbolTooltip: true,
    isMonoSize: false,
    isTransparent: true,
};

export const timelineConfig = (market: 'stock' | 'crypto' | 'forex') => ({
    displayMode: 'regular',
    feedMode: 'market',
    colorTheme: 'dark',
    isTransparent: true,
    locale: 'zh_TW',
    market,
});

export const symbolInfoConfig = (symbol: string) => ({
    symbol,
    colorTheme: 'dark',
    isTransparent: true,
    locale: 'zh_TW',
    width: '100%',
});

export const singleQuoteConfig = (symbol: string) => ({
    symbol,
    colorTheme: 'dark',
    isTransparent: true,
    locale: 'zh_TW',
});

export const CANDLE_CHART_WIDGET_CONFIG = (symbol: string) => ({
    allow_symbol_change: false,
    calendar: false,
    details: true,
    hide_side_toolbar: false, // drawing tools (trend lines, Fibonacci, text); drawings last until reload
    hide_top_toolbar: false,
    hide_legend: false,
    hide_volume: false,
    hotlist: false,
    interval: 'D',
    locale: 'zh_TW',
    save_image: false,
    style: 1,
    symbol: symbol.toUpperCase(),
    theme: 'dark',
    timezone: 'Asia/Taipei',
    backgroundColor: '#1f1e1a', // --card
    gridColor: 'rgba(255, 255, 255, 0.04)',
    watchlist: [],
    withdateranges: false,
    compareSymbols: [],
    studies: [],
    width: '100%',
    height: 600,
});

export const TECHNICAL_ANALYSIS_WIDGET_CONFIG = (symbol: string) => ({
    symbol: symbol.toUpperCase(),
    colorTheme: 'dark',
    isTransparent: true,
    locale: 'zh_TW',
    width: '100%',
    height: 400,
    interval: '1h',
    largeChartUrl: '',
});

// embed-widget-company-profile.js was retired by TradingView (403); symbol-profile.js takes the same config
export const COMPANY_PROFILE_WIDGET_CONFIG = (symbol: string) => ({
    symbol: symbol.toUpperCase(),
    colorTheme: 'dark',
    isTransparent: true,
    locale: 'zh_TW',
    width: '100%',
    height: 440,
});

export const COMPANY_FINANCIALS_WIDGET_CONFIG = (symbol: string) => ({
    symbol: symbol.toUpperCase(),
    colorTheme: 'dark',
    isTransparent: true,
    locale: 'zh_TW',
    width: '100%',
    height: 464,
    displayMode: 'regular',
    largeChartUrl: '',
});

// Default list in the search palette (static on purpose, see searchStocks)
export const POPULAR_STOCKS = [
    { symbol: 'AAPL', name: 'Apple Inc', exchange: 'NASDAQ' },
    { symbol: 'MSFT', name: 'Microsoft Corp', exchange: 'NASDAQ' },
    { symbol: 'NVDA', name: 'NVIDIA Corp', exchange: 'NASDAQ' },
    { symbol: 'GOOGL', name: 'Alphabet Inc', exchange: 'NASDAQ' },
    { symbol: 'AMZN', name: 'Amazon.com Inc', exchange: 'NASDAQ' },
    { symbol: 'META', name: 'Meta Platforms Inc', exchange: 'NASDAQ' },
    { symbol: 'TSLA', name: 'Tesla Inc', exchange: 'NASDAQ' },
    { symbol: 'NFLX', name: 'Netflix Inc', exchange: 'NASDAQ' },
    { symbol: 'AMD', name: 'Advanced Micro Devices Inc', exchange: 'NASDAQ' },
    { symbol: 'JPM', name: 'JPMorgan Chase & Co', exchange: 'NYSE' },
];

export const NO_MARKET_NEWS =
    '<p class="mobile-text" style="margin:0 0 20px 0;font-size:16px;line-height:1.6;color:#4b5563;">No market news available today. Please check back tomorrow.</p>';

export const WATCHLIST_TABLE_HEADER = [
    'Company',
    'Symbol',
    'Price',
    'Change',
    'Market Cap',
    'P/E Ratio',
    'Alert',
    'Action',
];

export const PASSWORD_RULES = [
    { label: zh.auth.rules.length, test: (pw: string) => pw.length >= 8 },
    { label: zh.auth.rules.upper, test: (pw: string) => /[A-Z]/.test(pw) },
    { label: zh.auth.rules.lower, test: (pw: string) => /[a-z]/.test(pw) },
    { label: zh.auth.rules.number, test: (pw: string) => /[0-9]/.test(pw) },
] as const;

export const PASSWORD_VALIDATION = {
    required: zh.auth.passwordRequired,
    minLength: { value: 8, message: zh.auth.passwordMin },
    pattern: {
        value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
        message: zh.auth.passwordPattern,
    },
};
