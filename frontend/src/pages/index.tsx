import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { Brain, Sparkles, TrendingUp, Loader2 } from 'lucide-react';
import { startAnalysis } from '../lib/api';


const PRESET_GOALS = [
  "Analyze Bitcoin for the next 30 minutes and identify trading opportunities",
  "Find scalping opportunities for Bitcoin based on recent market trends",
  "Analyze Ethereum trading opportunities with focus on DeFi trends",
  "Identify swing trading opportunities for Bitcoin over the next 7 days",
];

export default function Home() {
  const router = useRouter();
  const [goal, setGoal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleStartAnalysis = async () => {
    if (!goal.trim()) {
      setError('Please enter an analysis goal');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await startAnalysis(goal);
      // Navigate to analysis page
      router.push(`/analysis/${response.taskId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to start analysis');
      setLoading(false);
    }
  };

  const handlePresetClick = (preset: string) => {
    setGoal(preset);
  };

  return (
    <div style={styles.container}>
      {/* Background Elements */}
      <div style={styles.backgroundGradient} />

      <div className="container" style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={styles.header}
        >
          <div style={styles.logoContainer}>
            <motion.div
              animate={{
                rotate: [0, 360],
                scale: [1, 1.1, 1]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              style={styles.logo}
            >
              <Brain size={40} color="#6366f1" />
            </motion.div>
            <h1 className="text-gradient" style={styles.title}>
              Multi-Agent Crypto Analysis
            </h1>
          </div>

          <p style={styles.subtitle}>
            AI-powered crypto trading insights using autonomous agents
          </p>

          <div style={styles.features}>
            <FeatureBadge icon={<TrendingUp size={16} />} text="Real-time Market Data" />
            <FeatureBadge icon={<Sparkles size={16} />} text="Multi-Source Analysis" />
            <FeatureBadge icon={<Brain size={16} />} text="AI Strategy Generation" />
          </div>
        </motion.div>

        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card"
          style={{ maxWidth: '800px', margin: '0 auto', padding: '40px' }}
        >
          <h2 style={styles.cardTitle}>What would you like to analyze?</h2>

          {/* Input */}
          <textarea
            className="input"
            placeholder="e.g., Analyze Bitcoin for trading opportunities in the next 24 hours..."
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={3}
            style={{
              marginBottom: '20px',
              resize: 'vertical',
              minHeight: '80px'
            }}
          />

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={styles.error}
            >
              {error}
            </motion.div>
          )}

          {/* Action Button */}
          <button
            className="btn btn-primary"
            onClick={handleStartAnalysis}
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}
          >
            {loading ? (
              <>
                <Loader2 size={20} className="spin" />
                Starting Analysis...
              </>
            ) : (
              <>
                <Sparkles size={20} />
                Start Analysis
              </>
            )}
          </button>

          {/* Preset Goals */}
          <div style={{ marginTop: '32px' }}>
            <h3 style={styles.presetsTitle}>Quick Start Templates</h3>
            <div style={styles.presetsGrid}>
              {PRESET_GOALS.map((preset, index) => (
                <motion.button
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.05 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn-secondary"
                  onClick={() => handlePresetClick(preset)}
                  style={{
                    padding: '16px',
                    textAlign: 'left',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    width: '100%'
                  }}
                >
                  {preset}
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Info Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          style={styles.infoSection}
        >
          <h3 style={styles.infoTitle}>How it works</h3>
          <div className="grid grid-3">
            <InfoCard
              number="1"
              title="Planning"
              description="Gemini AI breaks down your goal into actionable subtasks"
            />
            <InfoCard
              number="2"
              title="Execution"
              description="Specialized agents collect market, sentiment, and on-chain data"
            />
            <InfoCard
              number="3"
              title="Strategy"
              description="AI synthesizes all data into actionable trading recommendations"
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function FeatureBadge({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '8px 16px',
      background: 'var(--surface)',
      backdropFilter: 'blur(20px)',
      border: '1px solid var(--border)',
      borderRadius: '20px',
      fontSize: '13px',
      fontWeight: 500
    }}>
      {icon}
      {text}
    </div>
  );
}

function InfoCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div style={{
      padding: '24px',
      background: 'var(--surface)',
      backdropFilter: 'blur(20px)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      textAlign: 'center'
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: 'var(--gradient-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 16px',
        fontSize: '20px',
        fontWeight: 700,
        color: 'white'
      }}>
        {number}
      </div>
      <h4 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
        {title}
      </h4>
      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
        {description}
      </p>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    padding: '40px 0',
    position: 'relative' as const,
  },
  backgroundGradient: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    height: '600px',
    background: 'radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.15) 0%, transparent 70%)',
    pointerEvents: 'none' as const,
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '60px',
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '20px',
    marginBottom: '20px',
  },
  logo: {
    width: '80px',
    height: '80px',
    borderRadius: '20px',
    background: 'var(--surface)',
    backdropFilter: 'blur(20px)',
    border: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: '48px',
    fontWeight: 700,
    margin: 0,
  },
  subtitle: {
    fontSize: '18px',
    color: 'var(--text-secondary)',
    marginBottom: '32px',
  },
  features: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    flexWrap: 'wrap' as const,
  },
  cardTitle: {
    fontSize: '24px',
    fontWeight: 600,
    marginBottom: '24px',
    textAlign: 'center' as const,
  },
  error: {
    padding: '12px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    color: 'var(--danger)',
    fontSize: '14px',
    marginBottom: '16px',
  },
  presetsTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '16px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  presetsGrid: {
    display: 'grid',
    gap: '12px',
  },
  infoSection: {
    maxWidth: '1000px',
    margin: '80px auto 0',
  },
  infoTitle: {
    fontSize: '28px',
    fontWeight: 700,
    textAlign: 'center' as const,
    marginBottom: '40px',
  },
};
