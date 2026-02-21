import * as React from 'react';
import { CONFIG } from '../config/constants';

// Local type definition to match backend data
type PriceUpdate = {
  symbol: string;
  price: number;
  isoTimestamp: string;
};

type Props = {
  prices: Record<string, PriceUpdate | null>;
  onUnsubscribe: (symbol: string) => void;
};

export default function TickerList({ prices, onUnsubscribe }: Props) {
  const symbols = Object.keys(prices).sort((a, b) => a.localeCompare(b));

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', CONFIG.CURRENCY_FORMAT).format(price);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getPriceChangeColor = (price: number) => {
    // Simple mock for price change indication - in real app, you'd track previous prices
    return price > 50000 ? '#10b981' : price > 1000 ? '#f59e0b' : '#ef4444';
  };

  return (
    <div style={styles.container} className="card-animation">
      <div style={styles.header} className="mobile-stack">
        <div style={styles.titleContainer} className="mobile-center">
          <h3 style={styles.title}>Live Price Feed</h3>
          <div style={styles.statusIndicator}>
            <div style={styles.statusDot}></div>
            <span>Live</span>
          </div>
        </div>
        <div style={styles.count}>
          {symbols.length} ticker{symbols.length !== 1 ? 's' : ''} active
        </div>
      </div>
      
      {symbols.length === 0 ? (
        <div style={styles.empty}>
          <div style={styles.emptyIcon}>📊</div>
          <h4 style={styles.emptyTitle}>No tickers yet</h4>
          <p style={styles.emptyText}>Add cryptocurrency tickers above to start streaming live prices</p>
        </div>
      ) : (
        <div style={styles.grid} className="mobile-grid">
          {symbols.map((s, index) => {
            const p = prices[s];
            const hasFinitePrice = p && Number.isFinite(p.price);
            const isLoading = !hasFinitePrice;
            
            return (
              <div 
                key={s} 
                style={styles.card}
                className="card-animation"
                {...(index > 0 && { style: { ...styles.card, animationDelay: `${index * 0.1}s` } })}
              >
                <div style={styles.cardHeader}>
                  <div style={styles.symbolContainer}>
                    <div style={styles.symbolIcon}>
                      {s.charAt(0)}
                    </div>
                    <div style={styles.symbol}>{s}</div>
                  </div>
                  <button 
                    onClick={() => onUnsubscribe(s)} 
                    style={styles.removeButton}
                    title="Remove ticker"
                  >
                    <span style={styles.removeIcon}>×</span>
                  </button>
                </div>
                
                <div style={styles.priceContainer}>
                  {isLoading ? (
                    <div style={styles.loading}>
                      <div style={styles.spinner}></div>
                      <span>Loading...</span>
                    </div>
                  ) : (
                    <>
                      <div style={styles.priceRow}>
                        <div style={styles.price}>{formatPrice(p!.price)}</div>
                        <div style={styles.priceChange}>
                          <div style={{ ...styles.changeIndicator, backgroundColor: getPriceChangeColor(p!.price) }}></div>
                        </div>
                      </div>
                      <div style={styles.timestamp}>
                        Updated {formatTime(p!.isoTimestamp)}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    background: 'var(--bg-secondary)',
    borderRadius: '20px',
    padding: '30px',
    boxShadow: '0 20px 40px var(--shadow-color)',
    border: '1px solid var(--border-color)',
    backdropFilter: 'blur(20px)',
    transition: 'all 0.3s ease',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '30px',
    flexWrap: 'wrap' as const,
    gap: '15px',
  },
  titleContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    flexWrap: 'wrap' as const,
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: '700',
    margin: 0,
    background: 'linear-gradient(45deg, var(--accent-primary), var(--accent-secondary))',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  statusIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(16, 185, 129, 0.1)',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '0.85rem',
    fontWeight: '500',
    color: '#10b981',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#10b981',
    animation: 'pulse 2s ease-in-out infinite',
  },
  count: {
    fontSize: '0.95rem',
    fontWeight: '500',
    color: 'var(--text-secondary)',
    background: 'rgba(102, 126, 234, 0.1)',
    padding: '8px 16px',
    borderRadius: '20px',
    border: '1px solid rgba(102, 126, 234, 0.2)',
  },
  empty: {
    textAlign: 'center' as const,
    padding: '60px 20px',
    color: 'var(--text-secondary)',
  },
  emptyIcon: {
    fontSize: '4rem',
    marginBottom: '20px',
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: '1.25rem',
    fontWeight: '600',
    margin: '0 0 10px 0',
    color: 'var(--text-primary)',
  },
  emptyText: {
    fontSize: '1rem',
    margin: 0,
    lineHeight: 1.5,
    maxWidth: '300px',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '20px',
  },
  card: {
    background: 'var(--bg-card)',
    borderRadius: '16px',
    padding: '24px',
    border: '1px solid var(--border-color)',
    boxShadow: '0 8px 25px var(--shadow-color)',
    transition: 'all 0.3s ease',
    position: 'relative' as const,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  symbolContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  symbolIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'linear-gradient(45deg, var(--accent-primary), var(--accent-secondary))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.2rem',
    fontWeight: 'bold',
    color: 'white',
  },
  symbol: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    fontFamily: 'monospace',
  },
  removeButton: {
    background: 'rgba(239, 68, 68, 0.1)',
    color: '#ef4444',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: '8px',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  removeIcon: {
    fontSize: '18px',
    fontWeight: 'bold',
  },
  priceContainer: {
    textAlign: 'center' as const,
  },
  priceRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    marginBottom: '8px',
  },
  price: {
    fontSize: '2rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    fontFamily: 'monospace',
    background: 'linear-gradient(45deg, var(--accent-primary), var(--accent-secondary))',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  priceChange: {
    display: 'flex',
    alignItems: 'center',
  },
  changeIndicator: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    animation: 'pulse 2s ease-in-out infinite',
  },
  timestamp: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    fontWeight: '400',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    color: 'var(--text-secondary)',
    fontSize: '1rem',
    fontWeight: '500',
  },
  spinner: {
    width: '20px',
    height: '20px',
    border: '3px solid rgba(102, 126, 234, 0.2)',
    borderTop: '3px solid #667eea',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
};
