'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RecommendationCard } from './RecommendationCard';
import { AutoInvestResult, RejectedRecommendation, TradeRecommendation, PortfolioHealth } from '@/types';
import { cn } from '@/lib/utils';

const HEALTH_CONFIG: Record<PortfolioHealth, { label: string; color: string }> = {
  poor:      { label: 'Poor',      color: 'text-[#991b1b]' },
  fair:      { label: 'Fair',      color: 'text-amber-600'  },
  good:      { label: 'Good',      color: 'text-[#B8960C]'  },
  excellent: { label: 'Excellent', color: 'text-[#166534]'  },
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
  result:          AutoInvestResult;
  onDismiss:       () => void;
  onAcceptOne:     (rec: TradeRecommendation) => Promise<void>;
  onRejectOne:     (rec: TradeRecommendation) => Promise<void>;
  onWatchOne?:     (rec: TradeRecommendation) => Promise<void>;
  executingSymbol: string | null;
}

export function RecommendationsSection({ result, onDismiss, onAcceptOne, onRejectOne, onWatchOne, executingSymbol }: Props) {
  const [showRejected, setShowRejected] = useState(false);

  const buys  = result.approved.filter((r) => r.action === 'buy');
  const sells = result.approved.filter((r) => r.action === 'sell');
  const holds = result.approved.filter((r) => r.action === 'hold');
  const health = result.analysis.portfolio_health;
  const hCfg   = HEALTH_CONFIG[health];
  const actionableCount = buys.length + sells.length;

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
            {actionableCount > 0
              ? `${actionableCount} guidance recommendation${actionableCount !== 1 ? 's' : ''} ready for review`
              : 'Analysis complete — no changes recommended'}
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
          <p className="text-[11px] tracking-[0.12em] uppercase text-[#4A5568] mb-1">Portfolio Assessment</p>
          <p className="text-sm leading-relaxed text-[#0A1628]">{result.analysis.summary}</p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-6 border-t border-[#E2E8F0] px-6 py-3 bg-[#F8F9FA]">
        <div>
          <p className="text-[11px] tracking-[0.1em] uppercase text-[#4A5568]">Monitored Value</p>
          <p className="font-serif text-sm font-light text-[#0A1628]">
            ${result.portfolio.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div>
          <p className="text-[11px] tracking-[0.1em] uppercase text-[#4A5568]">Cash Available</p>
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

      {/* Buy guidance */}
      {buys.length > 0 && (
        <div className="border-t border-[#E2E8F0] px-6 py-5">
          <h3 className="text-[11px] tracking-[0.15em] uppercase text-[#4A5568] mb-3">
            Buy Guidance ({buys.length})
          </h3>
          <motion.div variants={container} initial="hidden" animate="show" className="grid gap-3 sm:grid-cols-2">
            {buys.map((rec) => (
              <motion.div key={rec.symbol} variants={cardVariant}>
                <RecommendationCard
                  rec={rec}
                  variant="pending"
                  onAccept={onAcceptOne}
                  onReject={onRejectOne}
                  onWatch={onWatchOne}
                  executing={executingSymbol === rec.symbol}
                />
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}

      {/* Sell guidance */}
      {sells.length > 0 && (
        <div className="border-t border-[#E2E8F0] px-6 py-5">
          <h3 className="text-[11px] tracking-[0.15em] uppercase text-[#4A5568] mb-3">
            Sell Guidance ({sells.length})
          </h3>
          <motion.div variants={container} initial="hidden" animate="show" className="grid gap-3 sm:grid-cols-2">
            {sells.map((rec) => (
              <motion.div key={rec.symbol} variants={cardVariant}>
                <RecommendationCard
                  rec={rec}
                  variant="pending"
                  onAccept={onAcceptOne}
                  onReject={onRejectOne}
                  onWatch={onWatchOne}
                  executing={executingSymbol === rec.symbol}
                />
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

      {/* Blocked by risk guard (collapsible) */}
      {result.rejected.length > 0 && (
        <div className="border-t border-[#E2E8F0] px-6 py-4">
          <button
            onClick={() => setShowRejected((s) => !s)}
            className="text-xs tracking-[0.1em] uppercase text-[#4A5568] hover:text-[#0A1628] transition-colors"
          >
            {showRejected ? '▲' : '▼'} Filtered by risk parameters ({result.rejected.length})
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
                  {result.rejected.map((rec: RejectedRecommendation) => (
                    <RecommendationCard key={rec.symbol} rec={rec} variant="rejected" />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
