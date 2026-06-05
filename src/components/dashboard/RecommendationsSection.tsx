'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RecommendationCard } from './RecommendationCard';
import {
  AutoInvestResult,
  ExecutedRecommendation,
  TradeRecommendation,
  PortfolioHealth,
} from '@/types';
import { cn } from '@/lib/utils';
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';

const HEALTH_CONFIG: Record<PortfolioHealth, { label: string; dot: string; text: string }> = {
  poor:      { label: 'Poor',      dot: 'bg-red-500',   text: 'text-red-600 dark:text-red-400' },
  fair:      { label: 'Fair',      dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  good:      { label: 'Good',      dot: 'bg-blue-500',  text: 'text-blue-600 dark:text-blue-400' },
  excellent: { label: 'Excellent', dot: 'bg-green-500', text: 'text-green-600 dark:text-green-400' },
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
  executingSymbol: string | null;
}

export function RecommendationsSection({ result, onDismiss, onExecuteOne, executingSymbol }: Props) {
  const [showRejected, setShowRejected] = useState(false);

  const buys  = result.approved.filter((r) => r.action === 'buy');
  const sells = result.approved.filter((r) => r.action === 'sell');
  const holds = result.approved.filter((r) => r.action === 'hold');
  const health = result.analysis.portfolio_health;
  const hCfg  = HEALTH_CONFIG[health];

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl border border-indigo-200 bg-white shadow-lg dark:border-indigo-900/50 dark:bg-gray-900"
    >
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4 dark:border-gray-800">
        <div className="rounded-lg bg-indigo-50 p-1.5 dark:bg-indigo-900/40">
          <Bot className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">
            AI Analysis Complete
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {result.executed.length > 0
              ? `${result.executed.length} trade${result.executed.length > 1 ? 's' : ''} auto-executed`
              : `${buys.length + sells.length} recommendation${buys.length + sells.length !== 1 ? 's' : ''} ready for review`}
          </p>
        </div>

        {/* Portfolio health badge */}
        <div className="flex items-center gap-1.5">
          <span className={cn('h-2 w-2 rounded-full', hCfg.dot)} />
          <span className={cn('text-sm font-semibold', hCfg.text)}>{hCfg.label}</span>
        </div>

        <button
          onClick={onDismiss}
          className="ml-2 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Summary ──────────────────────────────────────────── */}
      <div className="grid gap-px bg-gray-100 dark:bg-gray-800 sm:grid-cols-2">
        {/* Market outlook */}
        <div className="bg-white px-6 py-4 dark:bg-gray-900">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="h-3.5 w-3.5 text-indigo-500" />
            <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
              Market Outlook
            </span>
          </div>
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {result.analysis.market_outlook}
          </p>
        </div>
        {/* Overall summary */}
        <div className="bg-white px-6 py-4 dark:bg-gray-900">
          <div className="flex items-center gap-1.5 mb-1">
            <Bot className="h-3.5 w-3.5 text-indigo-500" />
            <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
              Portfolio Summary
            </span>
          </div>
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {result.analysis.summary}
          </p>
        </div>
      </div>

      {/* ── Portfolio stats bar ───────────────────────────────── */}
      <div className="flex gap-6 border-t border-gray-100 px-6 py-3 dark:border-gray-800">
        <div>
          <span className="text-xs text-gray-500">Portfolio</span>
          <p className="text-sm font-bold text-gray-900 dark:text-white">
            ${result.portfolio.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div>
          <span className="text-xs text-gray-500">Cash</span>
          <p className="text-sm font-bold text-gray-900 dark:text-white">
            ${result.portfolio.cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-green-500" /> {buys.length} buy
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500" /> {sells.length} sell
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-gray-300" /> {holds.length} hold
          </span>
        </div>
      </div>

      {/* ── Auto-executed ─────────────────────────────────────── */}
      {result.executed.length > 0 && (
        <div className="border-t border-gray-100 px-6 py-5 dark:border-gray-800">
          <div className="mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-green-600" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Auto-executed ({result.executed.length})
            </h3>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </div>
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid gap-3 sm:grid-cols-2"
          >
            {result.executed.map((rec: ExecutedRecommendation) => (
              <motion.div key={rec.symbol} variants={cardVariant}>
                <RecommendationCard rec={rec} variant="executed" />
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}

      {/* ── Buys ─────────────────────────────────────────────── */}
      {buys.length > 0 && (
        <div className="border-t border-gray-100 px-6 py-5 dark:border-gray-800">
          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
            Buy recommendations ({buys.length})
          </h3>
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid gap-3 sm:grid-cols-2"
          >
            {buys.map((rec) => (
              <motion.div key={rec.symbol} variants={cardVariant}>
                <RecommendationCard
                  rec={rec}
                  variant="pending"
                  onExecute={onExecuteOne}
                  executing={executingSymbol === rec.symbol}
                />
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}

      {/* ── Sells ────────────────────────────────────────────── */}
      {sells.length > 0 && (
        <div className="border-t border-gray-100 px-6 py-5 dark:border-gray-800">
          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
            Sell recommendations ({sells.length})
          </h3>
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid gap-3 sm:grid-cols-2"
          >
            {sells.map((rec) => (
              <motion.div key={rec.symbol} variants={cardVariant}>
                <RecommendationCard
                  rec={rec}
                  variant="pending"
                  onExecute={onExecuteOne}
                  executing={executingSymbol === rec.symbol}
                />
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}

      {/* ── Holds ────────────────────────────────────────────── */}
      {holds.length > 0 && (
        <div className="border-t border-gray-100 px-6 py-5 dark:border-gray-800">
          <h3 className="mb-3 text-sm font-semibold text-gray-500 dark:text-gray-400">
            Hold ({holds.length})
          </h3>
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid gap-3 sm:grid-cols-2"
          >
            {holds.map((rec) => (
              <motion.div key={rec.symbol} variants={cardVariant}>
                <RecommendationCard rec={rec} variant="pending" />
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}

      {/* ── Rejected (collapsible) ───────────────────────────── */}
      {result.rejected.length > 0 && (
        <div className="border-t border-gray-100 px-6 py-4 dark:border-gray-800">
          <button
            onClick={() => setShowRejected((s) => !s)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            {showRejected ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Blocked by risk guard ({result.rejected.length})
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

      {/* ── Execution errors ─────────────────────────────────── */}
      {result.errors.length > 0 && (
        <div className="border-t border-gray-100 bg-red-50 px-6 py-3 dark:border-gray-800 dark:bg-red-900/10">
          <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">
            Execution errors
          </p>
          {result.errors.map((e, i) => (
            <p key={i} className="text-xs text-red-500">
              {e}
            </p>
          ))}
        </div>
      )}
    </motion.div>
  );
}
