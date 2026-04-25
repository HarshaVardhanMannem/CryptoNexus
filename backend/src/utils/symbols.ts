/**
 * Shared crypto symbol utilities used by all agents.
 */

const SYMBOL_ALIASES: Record<string, string> = {
    BITCOIN: 'BTC',
    ETHEREUM: 'ETH',
    SOLANA: 'SOL',
    CARDANO: 'ADA',
    DOGECOIN: 'DOGE',
    RIPPLE: 'XRP',
    POLKADOT: 'DOT',
    AVALANCHE: 'AVAX',
    CHAINLINK: 'LINK',
    POLYGON: 'MATIC',
};

const KNOWN_SYMBOLS = [
    'BTC', 'ETH', 'SOL', 'ADA', 'DOGE', 'XRP', 'DOT', 'AVAX', 'LINK', 'MATIC',
    'BNB', 'SHIB', 'UNI', 'AAVE', 'LTC', 'ATOM',
];

const COINGECKO_MAP: Record<string, string> = {
    BTC: 'bitcoin',
    ETH: 'ethereum',
    SOL: 'solana',
    ADA: 'cardano',
    DOGE: 'dogecoin',
    XRP: 'ripple',
    DOT: 'polkadot',
    AVAX: 'avalanche-2',
    LINK: 'chainlink',
    MATIC: 'matic-network',
    BNB: 'binancecoin',
    SHIB: 'shiba-inu',
    UNI: 'uniswap',
    AAVE: 'aave',
    LTC: 'litecoin',
    ATOM: 'cosmos',
};

/**
 * Extract a crypto symbol from free-form text. Returns 'BTC' as default.
 */
export function extractSymbol(text: string): string {
    const upper = text.toUpperCase();

    // Check aliases first (full names like BITCOIN, ETHEREUM)
    for (const [alias, sym] of Object.entries(SYMBOL_ALIASES)) {
        if (upper.includes(alias)) return sym;
    }

    // Check ticker symbols (with USD suffix variants)
    for (const sym of KNOWN_SYMBOLS) {
        if (upper.includes(sym + 'USD') || upper.includes(sym + '/USD') ||
            upper.includes(sym + '-USD') || upper.includes(sym + ' ') ||
            upper.endsWith(sym) || upper.includes(` ${sym} `)) {
            return sym;
        }
    }

    return 'BTC';
}

/**
 * Get CoinGecko coin ID for a symbol.
 */
export function toCoinGeckoId(symbol: string): string {
    return COINGECKO_MAP[symbol.toUpperCase()] || 'bitcoin';
}

/**
 * Get TradingView-compatible symbol (e.g. BTCUSD).
 */
export function toTradingViewSymbol(symbol: string): string {
    const upper = symbol.toUpperCase().replace(/USD$/, '');
    return `${upper}USD`;
}
