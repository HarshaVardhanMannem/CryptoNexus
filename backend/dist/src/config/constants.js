"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BROWSER_ARGS = exports.PRICE_SELECTORS = exports.CONFIG = void 0;
// Backend Configuration Constants
exports.CONFIG = {
    // Server Configuration
    DEFAULT_PORT: parseInt(process.env.PORT || '4000'),
    DEFAULT_HOST: process.env.HOST || 'localhost',
    // WebSocket Configuration
    RECONNECT_DELAY: parseInt(process.env.RECONNECT_DELAY || '3000'), // ms
    HEARTBEAT_INTERVAL: parseInt(process.env.HEARTBEAT_INTERVAL || '30000'), // ms
    // Playwright Configuration
    POLL_INTERVAL: parseInt(process.env.POLL_INTERVAL || '1000'), // ms
    PAGE_LOAD_TIMEOUT: parseInt(process.env.PAGE_LOAD_TIMEOUT || '30000'), // ms
    PAGE_SETTLE_DELAY: parseInt(process.env.PAGE_SETTLE_DELAY || '500'), // ms
    // TradingView Configuration
    DEFAULT_EXCHANGE: process.env.DEFAULT_EXCHANGE || 'BINANCE',
    TRADINGVIEW_BASE_URL: process.env.TRADINGVIEW_BASE_URL || 'https://www.tradingview.com/symbols',
    // Price Configuration
    MIN_PRICE_RANGE: parseFloat(process.env.MIN_PRICE_RANGE || '0.01'),
    MAX_PRICE_RANGE: parseFloat(process.env.MAX_PRICE_RANGE || '1000000'),
    // Browser Configuration
    VIEWPORT: {
        width: parseInt(process.env.VIEWPORT_WIDTH || '1200'),
        height: parseInt(process.env.VIEWPORT_HEIGHT || '900')
    },
    // CORS Configuration
    CORS_ORIGIN: process.env.FRONTEND_URL || 'http://localhost:3000',
    // NVIDIA AI Configuration
    NVIDIA_API_KEY: process.env.NVIDIA_API_KEY || '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',
    NVIDIA_MODEL: process.env.NVIDIA_MODEL || 'nvidia/nvidia-nemotron-nano-9b-v2',
    NVIDIA_BASE_URL: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
    NVIDIA_MAX_TOKENS: parseInt(process.env.NVIDIA_MAX_TOKENS || '2048'),
    NVIDIA_TEMPERATURE: parseFloat(process.env.NVIDIA_TEMPERATURE || '0.6'),
    // PostgreSQL Configuration
    POSTGRES_HOST: process.env.POSTGRES_HOST || 'localhost',
    POSTGRES_PORT: parseInt(process.env.POSTGRES_PORT || '5432'),
    POSTGRES_DB: process.env.POSTGRES_DB || 'crypto_agent',
    POSTGRES_USER: process.env.POSTGRES_USER || 'postgres',
    POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD || '',
    // Redis Configuration
    REDIS_HOST: process.env.REDIS_HOST || 'localhost',
    REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379'),
    // Agent Configuration
    MARATHON_TASK_MAX_DURATION_HOURS: parseInt(process.env.MARATHON_TASK_MAX_DURATION_HOURS || '24'),
    CHECKPOINT_INTERVAL_MINUTES: parseInt(process.env.CHECKPOINT_INTERVAL_MINUTES || '15'),
    MAX_SELF_CORRECTION_ATTEMPTS: parseInt(process.env.MAX_SELF_CORRECTION_ATTEMPTS || '3'),
};
exports.PRICE_SELECTORS = [
    // Current TradingView selectors (2024)
    '.tv-symbol-price-quote__value',
    '.tv-symbol-price-quote__value.js-symbol-last',
    '.tv-symbol-price-quote__value.js-symbol-last.js-shrink',
    '.tv-symbol-price-quote__value--no-animation',
    '[data-symbol="last-price"]',
    '[data-testid="price"]',
    '.js-symbol-last',
    // Additional selectors for different layouts
    '.tv-widget-copyright + div div[class*="price"]',
    'div[class*="price"][class*="value"]',
    'span[class*="price"][class*="last"]',
    // Generic price patterns
    '[class*="last"][class*="price"]',
    '[class*="price"][class*="quote"]'
];
exports.BROWSER_ARGS = [
    '--start-maximized',
    '--disable-blink-features=AutomationControlled',
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor'
];
