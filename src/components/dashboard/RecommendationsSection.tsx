'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RecommendationCard } from './RecommendationCard';
import { AutoInvestResult, ExecutedRecommendation, TradeRecommendation, PortfolioHealth } from '@/types';
import { cn } from '@/lib/utils';

const HEALTH_CONFIG: Record<PortfolioHealth, { label: string; color: string }> = {
  poor:      { label: 'Poor',      color: 'text-[#C41E3A]' },
  fair:      { label: 'Fair',      color: 'text-amber-600'  },
  good:      { label: 'Good',      color: 'text-[#B8960C]'  },
  excellent: { label: 'Excellent', color: 'text-green-600'  },
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const cardVariant = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

interface Props {
  result: AutoInvestResult;
  onDismiss: () => void;
  onExecuteOne: (rec: TradeRecommendation) => Promise<void>;
  onExecuted: (rec: TradeRecommendation) => void;
  executingSymbol: string | null;
}

export function RecommendationsSection({ result, onDismiss, onExecuteOne, onExecuted, executingSymbol }: Props) {
  const [showRejected, setShowRejected] = useState(false);

  const buys  = result.approved.filter((r) => r.action === 'buy');
  const sells = result.approved.filter((r) => r.action === 'sell');
  const holds = result.approved.filter((r) => r.action === 'hold');
  const health = result.analysis.portfolio_health;
  const hCfg   = HEALTH_CONFIG[health];

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35 }}
      className="border border-[#E2E8F0] bg-white"
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#E2E8F0] px-6 py-4">
        <div className="flex-1">
          <h2 className="text-[11px] tracking-[0.15em] uppercase text-[#4A5568]">AI Analysis Complete</h2>
          <p className="mt-0.5 font-serif text-base font-light text-[#0A1628]">
            {result.executed.length > 0
              ? `${result.executed.length} trade${result.executed.length > 1 ? 's' : ''} auto-executed`
              : `${buys.length + sells.length} recommendation${buys.length + sells.length !== 1 ? 's' : ''} ready for review`}
          </p>
        </div>

        <span className={cn('text-sm font-light font-serif', hCfg.color)}>
          {hCfg.label}
        </span>

        <button
          onClick={onDismiss}
          className="ml-2 p-1.5 text-[#4A5568]/50 hover:text-[#0A1628] transition-colors"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>

      {/* Summary grid */}
      <div className="grid gap-px bg-[#E2E8F0] sm:grid-cols-2">
        <div className="bg-white px-6 py-4">
          <p className="text-[11px] tracking-[0.12em] uppercase text-[#4A5568] mb-1">Market Outlook</p>
          <p className="text-sm leading-relaxed text-[#0A1628]">{result.analysis.market_outlook}</p>
        </div>
        <div className="bg-white px-6 py-4">
          <p className="text-[11px] tracking-[0.12em] uppercase text-[#4A5568] mb-1">Portfolio Summary</p>
          <p className="text-sm leading-relaxed text-[#0A1628]">{result.analysis.summary}</p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-6 border-t border-[#E2E8F0] px-6 py-3 bg-[#F8F9FA]">
        <div>
          <p className="text-[11px] tracking-[0.1em] uppercase text-[#4A5568]">Portfolio</p>
          <p className="font-serif text-sm font-light text-[#0A1628]">
            ${result.portfolio.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div>
          <p className="text-[11px] tracking-[0.1em] uppercase text-[#4A5568]">Cash</p>
          <p className="font-serif text-sm font-light text-[#0A1628]">
            ${result.portfolio.cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-4 text-xs text-[#4A5568]">
          <span>{buys.length} buy</span>
          <span>{sells.length} sell</span>
          <span>{holds.length} hold</span>
        </div>
      </div>

      {/* Auto-executed */}
      {result.executed.length > 0 && (
        <div className="border-t border-[#E2E8F0] px-6 py-5">
          <h3 className="text-[11px] tracking-[0.15em] uppercase text-[#4A5568] mb-3">
            Auto-executed ({result.executed.length})
          </h3>
          <motion.div variants={container} initial="hidden" animate="show" className="grid gap-3 sm:grid-cols-2">
            {result.executed.map((rec: ExecutedRecommendation) => (
              <motion.div key={rec.symbol} variants={cardVariant}>
                <RecommendationCard rec={rec} variant="executed" />
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}

      {/* Buys */}
      {buys.length > 0 && (
        <div className="border-t border-[#E2E8F0] px-6 py-5">
          <h3 className="text-[11px] tracking-[0.15em] uppercase text-[#4A5568] mb-3">
            Buy ({buys.length})
          </h3>
          <motion.div variants={container} initial="hidden" animate="show" className="grid gap-3 sm:grid-cols-2">
            {buys.map((rec) => (
              <motion.div key={rec.symbol} variants={cardVariant}>
                <RecommendationCard rec={rec} variant="pending" onExecute={onExecuteOne} onExecuted={onExecuted} executing={executingSymbol === rec.symbol} />
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}

      {/* Sells */}
      {sells.length > 0 && (
        <div className="border-t border-[#E2E8F0] px-6 py-5">
          <h3 className="text-[11px] tracking-[0.15em] uppercase text-[#4A5568] mb-3">
            Sell ({sells.length})
          </h3>
          <motion.div variants={container} initial="hidden" animate="show" className="grid gap-3 sm:grid-cols-2">
            {sells.map((rec) => (
              <motion.div key={rec.symbol} variants={cardVariant}>
                <RecommendationCard rec={rec} variant="pending" onExecute={onExecuteOne} onExecuted={onExecuted} executing={executingSymbol === rec.symbol} />
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}

      {/* Holds */}
      {holds.length > 0 && (
        <div className="border-t border-[#E2E8F0] px-6 py-5">
          <h3 className="text-[11px] tracking-[0.15em] uppercase text-[#4A5568]/60 mb-3">
            Hold ({holds.length})
          </h3>
          <motion.div variants={container} initial="hidden" animate="show" className="grid gap-3 sm:grid-cols-2">
            {holds.map((rec) => (
              <motion.div key={rec.symbol} variants={cardVariant}>
                <RecommendationCard rec={rec} variant="pending" />
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}

      {/* Rejected (collapsible) */}
      {result.rejected.length > 0 && (
        <div className="border-t border-[#E2E8F0] px-6 py-4">
          <button
            onClick={() => setShowRejected((s) => !s)}
            className="text-xs tracking-[0.1em] uppercase text-[#4A5568] hover:text-[#0A1628] transition-colors"
          >
            {showRejected ? '▲' : '▼'} Blocked by risk guard ({result.rejected.length})
          </button>

          <AnimatePresence>
            {showRejected && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="grid gap-3 pt-3 sm:grid-cols-2">
                  {result.rejected.map((rec) => (
                    <RecommendationCard key={rec.symbol} rec={rec} variant="rejected" />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Execution errors */}
      {result.errors.length > 0 && (
        <div className="border-t border-[#E2E8F0] bg-red-50 px-6 py-3">
          <p className="text-[11px] tracking-[0.1em] uppercase text-[#C41E3A] mb-1">Execution errors</p>
          {result.errors.map((e, i) => (
            <p key={i} className="text-xs text-[#C41E3A]">Trade could not be placed. Please try again.</p>
          ))}
        </div>
      )}
    </motion.div>
  );
}
