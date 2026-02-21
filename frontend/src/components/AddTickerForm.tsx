import React, { useState } from 'react';
import { CONFIG } from '../config/constants';

type Props = {
  onAdd: (symbol: string) => void;
};

export default function AddTickerForm({ onAdd }: Props) {
  const [symbol, setSymbol] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  function handleAdd(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = symbol.trim().toUpperCase();
    if (!trimmed) return;
    
    setIsLoading(true);
    onAdd(trimmed);
    setSymbol('');
    
    // Reset loading state after a brief delay for visual feedback
    setTimeout(() => setIsLoading(false), 500);
  }

  return (
    <div style={styles.container} className="card-animation">
      <div style={styles.header}>
        <h3 style={styles.title}>Add New Ticker</h3>
        <p style={styles.subtitle}>Enter a cryptocurrency symbol to start streaming live prices</p>
      </div>
      
      <form onSubmit={handleAdd} style={styles.form} className="mobile-stack">
        <div style={styles.inputContainer} className="mobile-full-width">
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder={`Enter ticker symbol (e.g., ${CONFIG.EXAMPLE_TICKERS.join(', ')})`}
            style={styles.input}
            disabled={isLoading}
          />
          <div style={styles.inputIcon}>₿</div>
        </div>
        
        <button 
          type="submit" 
          style={styles.button}
          className="mobile-full-width"
          disabled={isLoading || !symbol.trim()}
        >
          {isLoading ? (
            <>
              <div style={styles.spinner}></div>
              Adding...
            </>
          ) : (
            <>
              <span style={styles.buttonIcon}>+</span>
              Add Ticker
            </>
          )}
        </button>
      </form>
      
      <div style={styles.suggestions}>
        <span style={styles.suggestionsLabel}>Popular:</span>
        {CONFIG.EXAMPLE_TICKERS.slice(0, 4).map((ticker) => (
          <button
            key={ticker}
            type="button"
            style={styles.suggestionButton}
            onClick={() => setSymbol(ticker)}
            disabled={isLoading}
          >
            {ticker}
          </button>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: {
    background: 'var(--bg-secondary)',
    borderRadius: '20px',
    padding: '30px',
    marginBottom: '30px',
    boxShadow: '0 20px 40px var(--shadow-color)',
    border: '1px solid var(--border-color)',
    backdropFilter: 'blur(20px)',
    transition: 'all 0.3s ease',
  },
  header: {
    marginBottom: '25px',
    textAlign: 'center' as const,
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: '600',
    margin: '0 0 8px 0',
    background: 'linear-gradient(45deg, var(--accent-primary), var(--accent-secondary))',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    fontSize: '0.95rem',
    color: 'var(--text-secondary)',
    margin: 0,
    fontWeight: '300',
  },
  form: {
    display: 'flex',
    gap: '15px',
    alignItems: 'stretch',
    flexWrap: 'wrap' as const,
    marginBottom: '20px',
  },
  inputContainer: {
    position: 'relative' as const,
    flex: 1,
    minWidth: '250px',
  },
  input: {
    width: '100%',
    padding: '16px 20px 16px 50px',
    border: '2px solid var(--border-color)',
    borderRadius: '12px',
    fontSize: '16px',
    outline: 'none',
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    fontFamily: 'inherit',
    transition: 'all 0.3s ease',
    boxShadow: '0 2px 8px var(--shadow-color)',
  },
  inputIcon: {
    position: 'absolute' as const,
    left: '15px',
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: '20px',
    color: 'var(--accent-primary)',
    pointerEvents: 'none' as const,
  },
  button: {
    padding: '16px 30px',
    background: 'linear-gradient(45deg, var(--accent-primary), var(--accent-secondary))',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
    minWidth: '140px',
    justifyContent: 'center',
  },
  buttonIcon: {
    fontSize: '18px',
    fontWeight: 'bold',
  },
  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid rgba(255, 255, 255, 0.3)',
    borderTop: '2px solid white',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  suggestions: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap' as const,
    justifyContent: 'center',
  },
  suggestionsLabel: {
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
    fontWeight: '500',
  },
  suggestionButton: {
    padding: '6px 12px',
    background: 'rgba(102, 126, 234, 0.1)',
    color: 'var(--accent-primary)',
    border: '1px solid rgba(102, 126, 234, 0.2)',
    borderRadius: '8px',
    fontSize: '0.85rem',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
  },
};
