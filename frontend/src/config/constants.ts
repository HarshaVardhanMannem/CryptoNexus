// Frontend Configuration Constants
export const CONFIG = {
  // API Configuration
  DEFAULT_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  
  // ConnectRPC Configuration
  RECONNECT_DELAY: parseInt(process.env.NEXT_PUBLIC_RECONNECT_DELAY || '3000'), // ms
  MAX_RECONNECT_ATTEMPTS: parseInt(process.env.NEXT_PUBLIC_MAX_RECONNECT_ATTEMPTS || '5'),
  
  // UI Configuration
  CURRENCY_FORMAT: {
    style: 'currency',
    currency: process.env.NEXT_PUBLIC_CURRENCY || 'USD',
    minimumFractionDigits: parseInt(process.env.NEXT_PUBLIC_MIN_FRACTION_DIGITS || '2'),
    maximumFractionDigits: parseInt(process.env.NEXT_PUBLIC_MAX_FRACTION_DIGITS || '8'),
  },
  
  // Validation Configuration
  MIN_SYMBOL_LENGTH: 3,
  MAX_SYMBOL_LENGTH: 10,
  
  // Common Ticker Examples
  EXAMPLE_TICKERS: ['BTCUSD', 'ETHUSD', 'ADAUSD', 'SOLUSD'] as const
} as const;