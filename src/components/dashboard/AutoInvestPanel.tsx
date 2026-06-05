'use client';

import { useState, useCallback } from 'react';
import * as Slider from '@radix-ui/react-slider';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { RecommendationCard } from './RecommendationCard';
import { cn } from '@/lib/utils';
import {
  AutoInvestConfig,
  AutoInvestResult,
  TradeRecommendation,
  PortfolioHealth,
} from '@/types';
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Settings2,
  Sparkles,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';

const DEFAULT_CONFIG: AutoInvestConfig = {
  mode: 'review',
  max_position_pct: 0.05,
  confidence_threshold: 70,
  max_trade_value: 2000,
  watchlist: [],
};

const HEALTH_CONFIG: Record<PortfolioHealth, { label: string; color: string }> = {
  poor: { label: 'Poor', color: 'text-red-500' },
  fair: { label: 'Fair', color: 'text-amber-500' },
  good: { label: 'Good', color: 'text-blue-500' },
  excellent: { label: 'Excellent', color: 'text-green-500' },
};

function WatchlistInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState('');

  const add = () => {
    const sym = input.trim().toUpperCase();
    if (sym && !value.includes(sym)) onChange([...value, sym]);
    setInput('');
  };

  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
        Watchlist — candidate buys
      </label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {value.map((sym) => (
          <span
            key={sym}
            className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
          >
            {sym}
            <button
              onClick={() => onChange(value.filter((s) => s !== sym))}
              className="hover:text-indigo-900"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="e.g. NVDA"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm uppercase dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <Button size="sm" variant="secondary" onClick={add} disabled={!input.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}

function ConfigPanel({
  config,
  onChange,
}: {
  config: AutoInvestConfig;
  onChange: (c: AutoInvestConfig) => void;
}) {
  return (
    <div className="space-y-5 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
      {/* Mode toggle */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
          Execution mode
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(['review', 'auto'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => onChange({ ...config, mode })}
              className={cn(
                'rounded-lg border-2 py-2.5 text-sm font-medium transition-colors',
                config.mode === mode
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400',
              )}
            >
              {mode === 'review' ? '👁 Review first' : '⚡ Auto-execute'}
            </button>
          ))}
        </div>
        {config.mode === 'auto' && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
            Auto mode places market orders immediately after risk checks pass.
          </p>
        )}
      </div>

      {/* Confidence threshold */}
      <div>
        <div className="flex justify-between mb-1">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Min confidence threshold
          </label>
          <span className="text-xs font-bold text-indigo-600">{config.confidence_threshold}</span>
        </div>
        <Slider.Root
          min={50}
          max={95}
          step={5}
          value={[config.confidence_threshold]}
          onValueChange={([v]) => onChange({ ...config, confidence_threshold: v })}
          className="relative flex h-4 w-full touch-none items-center"
        >
          <Slider.Track className="relative h-1.5 flex-1 rounded-full bg-gray-200 dark:bg-gray-700">
            <Slider.Range className="absolute h-full rounded-full bg-indigo-600" />
          </Slider.Track>
          <Slider.Thumb className="block h-4 w-4 rounded-full border-2 border-indigo-600 bg-white shadow focus:outline-none" />
        </Slider.Root>
        <div className="mt-1 flex justify-between text-xs text-gray-400">
          <span>50 (lenient)</span>
          <span>95 (strict)</span>
        </div>
      </div>

      {/* Max position % */}
      <div>
        <div className="flex justify-between mb-1">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Max position size
          </label>
          <span className="text-xs font-bold text-indigo-600">
            {(config.max_position_pct * 100).toFixed(0)}%
          </span>
        </div>
        <Slider.Root
          min={0.02}
          max={0.20}
          step={0.01}
          value={[config.max_position_pct]}
          onValueChange={([v]) => onChange({ ...config, max_position_pct: v })}
          className="relative flex h-4 w-full touch-none items-center"
        >
          <Slider.Track className="relative h-1.5 flex-1 rounded-full bg-gray-200 dark:bg-gray-700">
            <Slider.Range className="absolute h-full rounded-full bg-indigo-600" />
          </Slider.Track>
          <Slider.Thumb className="block h-4 w-4 rounded-full border-2 border-indigo-600 bg-white shadow focus:outline-none" />
        </Slider.Root>
        <div className="mt-1 flex justify-between text-xs text-gray-400">
          <span>2%</span>
          <span>20%</span>
        </div>
      </div>

      {/* Max trade value */}
      <div>
        <div className="flex justify-between mb-1">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Max trade value
          </label>
          <span className="text-xs font-bold text-indigo-600">
            ${config.max_trade_value.toLocaleString()}
          </span>
        </div>
        <Slider.Root
          min={100}
          max={10000}
          step={100}
          value={[config.max_trade_value]}
          onValueChange={([v]) => onChange({ ...config, max_trade_value: v })}
          className="relative flex h-4 w-full touch-none items-center"
        >
          <Slider.Track className="relative h-1.5 flex-1 rounded-full bg-gray-200 dark:bg-gray-700">
            <Slider.Range className="absolute h-full rounded-full bg-indigo-600" />
          </Slider.Track>
          <Slider.Thumb className="block h-4 w-4 rounded-full border-2 border-indigo-600 bg-white shadow focus:outline-none" />
        </Slider.Root>
        <div className="mt-1 flex justify-between text-xs text-gray-400">
          <span>$100</span>
          <span>$10,000</span>
        </div>
      </div>

      {/* Watchlist */}
      <WatchlistInput
        value={config.watchlist}
        onChange={(watchlist) => onChange({ ...config, watchlist })}
      />
    </div>
  );
}

export function AutoInvestPanel() {
  const [config, setConfig] = useState<AutoInvestConfig>(DEFAULT_CONFIG);
  const [showConfig, setShowConfig] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AutoInvestResult | null>(null);
  const [executingSymbol, setExecutingSymbol] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/ai/auto-invest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Analysis failed');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [config]);

  const executeOne = useCallback(
    async (rec: TradeRecommendation) => {
      setExecutingSymbol(rec.symbol);
      try {
        const res = await fetch('/api/alpaca/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: rec.symbol,
            qty: rec.qty,
            side: rec.action,
          }),
        });
        if (!res.ok) throw new Error('Order failed');

        // Move from approved to executed in local state
        setResult((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            approved: prev.approved.filter((r) => r.symbol !== rec.symbol),
            executed: [...prev.executed, { ...rec, order_id: 'manual' }],
          };
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Order failed');
      } finally {
        setExecutingSymbol(null);
      }
    },
    [],
  );

  const actionablePending = result?.approved.filter((r) => r.action !== 'hold') ?? [];
  const holds = result?.approved.filter((r) => r.action === 'hold') ?? [];
  const health = result?.analysis.portfolio_health;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-indigo-50 p-1.5 dark:bg-indigo-900/30">
            <Bot className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <CardTitle>AI Auto-Invest</CardTitle>
          {health && (
            <span className={cn('ml-auto text-sm font-semibold', HEALTH_CONFIG[health].color)}>
              {HEALTH_CONFIG[health].label} portfolio
            </span>
          )}
        </div>
      </CardHeader>

      {/* Config toggle */}
      <button
        onClick={() => setShowConfig((s) => !s)}
        className="mb-4 flex w-full items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500 hover:border-gray-400 dark:border-gray-700 dark:text-gray-400"
      >
        <Settings2 className="h-4 w-4" />
        Configuration
        <span className="ml-auto text-xs">
          {config.mode === 'auto' ? '⚡ Auto' : '👁 Review'} ·{' '}
          {config.confidence_threshold}% threshold ·{' '}
          {(config.max_position_pct * 100).toFixed(0)}% max position
        </span>
        {showConfig ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {showConfig && (
        <div className="mb-4">
          <ConfigPanel config={config} onChange={setConfig} />
        </div>
      )}

      {/* Run button */}
      <Button
        className="w-full"
        onClick={runAnalysis}
        loading={loading}
        disabled={loading}
      >
        <Sparkles className="h-4 w-4" />
        {loading ? 'Analysing portfolio…' : 'Run AI Analysis'}
      </Button>

      {/* Error */}
      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </p>
      )}

      {/* Results */}
      {result && (
        <div className="mt-6 space-y-6">
          {/* Summary */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900/40 dark:bg-indigo-900/10">
            <div className="flex items-start gap-2">
              <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400 mb-1">
                  Market Outlook
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {result.analysis.market_outlook}
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 border-t border-indigo-100 dark:border-indigo-900/40 pt-3">
              {result.analysis.summary}
            </p>
          </div>

          {/* Portfolio stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
              <p className="text-xs text-gray-500">Portfolio value</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                ${result.portfolio.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
              <p className="text-xs text-gray-500">Available cash</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                ${result.portfolio.cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>

          {/* Executed trades */}
          {result.executed.length > 0 && (
            <section>
              <div className="mb-2 flex items-center gap-2">
                <Zap className="h-4 w-4 text-green-600" />
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Executed ({result.executed.length})
                </h4>
              </div>
              <div className="space-y-2">
                {result.executed.map((rec) => (
                  <RecommendationCard key={rec.symbol} rec={rec} variant="executed" />
                ))}
              </div>
            </section>
          )}

          {/* Pending approval (review mode) */}
          {actionablePending.length > 0 && (
            <section>
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-600" />
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Recommendations — approve to execute ({actionablePending.length})
                </h4>
              </div>
              <div className="space-y-2">
                {actionablePending.map((rec) => (
                  <RecommendationCard
                    key={rec.symbol}
                    rec={rec}
                    variant="pending"
                    onExecute={executeOne}
                    executing={executingSymbol === rec.symbol}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Hold recommendations */}
          {holds.length > 0 && (
            <section>
              <h4 className="mb-2 text-sm font-semibold text-gray-500 dark:text-gray-400">
                Hold ({holds.length})
              </h4>
              <div className="space-y-2">
                {holds.map((rec) => (
                  <RecommendationCard key={rec.symbol} rec={rec} variant="pending" />
                ))}
              </div>
            </section>
          )}

          {/* Rejected by risk guard */}
          {result.rejected.length > 0 && (
            <section>
              <h4 className="mb-2 text-sm font-semibold text-gray-500 dark:text-gray-400">
                Blocked by risk guard ({result.rejected.length})
              </h4>
              <div className="space-y-2">
                {result.rejected.map((rec) => (
                  <RecommendationCard key={rec.symbol} rec={rec} variant="rejected" />
                ))}
              </div>
            </section>
          )}

          {/* Execution errors */}
          {result.errors.length > 0 && (
            <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
              <p className="text-xs font-semibold text-red-600 mb-1">Execution errors</p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-500">{e}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
