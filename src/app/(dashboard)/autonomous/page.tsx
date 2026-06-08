'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { TopBar } from '@/components/layout/TopBar';
import type { PortfolioData } from '@/app/api/alpaca/portfolio/route';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ApprovedTrade {
  symbol: string;
  action: 'buy' | 'sell' | 'hold';
  qty: number;
  confidence: number;
  reasoning: string;
  risk_level: 'low' | 'medium' | 'high';
  estimated_value?: number;
}

interface RejectedTrade {
  symbol: string;
  action: string;
  qty: number;
  confidence: number;
  reasoning: string;
  risk_level: string;
  rejection_reason: string;
}

interface ExecutedTrade {
  symbol: string;
  action: string;
  qty: number;
  order_id: string;
  status: string;
}

interface AgentSession {
  id: string;
  strategy_name: string;
  trades_approved: number;
  trades_executed: number;
  total_trade_value: number;
  market_outlook: string | null;
  summary: string | null;
  warnings: string[];
  created_at: string;
}

interface AutonomousResult {
  session: AgentSession;
  approved: ApprovedTrade[];
  rejected: RejectedTrade[];
  executed: ExecutedTrade[];
  warnings: string[];
  portfolio: { value: number; cash: number };
}

interface StrategyInfo {
  id: string;
  name: string;
  tagline: string;
  description: string;
  risk_level: string;
  target_return_pct: number;
  max_drawdown_pct: number;
  accent_color: string;
  characteristics: string[];
}

interface StrategyData {
  strategy: StrategyInfo;
  user_prefs: {
    strategy_id: string;
    auto_execute: boolean;
    max_trade_value: number;
  } | null;
  all_strategies: StrategyInfo[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtUSD(n: number): string {
  return '$' + Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function fmtPct(n: number): string {
  return (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ConfidenceBar({ value }: { value: number }) {
  const color =
    value >= 75 ? '#166534' :
    value >= 65 ? '#B8960C' :
    '#991b1b';

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono tabular-nums text-xs text-[#0A1628]">{value}</span>
      <div className="h-1 w-14 bg-[#E2E8F0] overflow-hidden">
        <div
          className="h-full transition-all"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  if (action === 'buy') {
    return (
      <span className="inline-block border border-[#166534]/20 bg-[#166534]/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.1em] text-[#166534]">
        Buy
      </span>
    );
  }
  if (action === 'sell') {
    return (
      <span className="inline-block border border-[#991b1b]/20 bg-[#991b1b]/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.1em] text-[#991b1b]">
        Sell
      </span>
    );
  }
  return (
    <span className="inline-block border border-[#4A5568]/20 bg-[#4A5568]/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.1em] text-[#4A5568]">
      Hold
    </span>
  );
}

function RiskBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    low:    'text-[#166534] bg-[#166534]/10',
    medium: 'text-[#B8960C] bg-[#B8960C]/10',
    high:   'text-[#991b1b] bg-[#991b1b]/10',
  };
  return (
    <span className={`inline-block px-2 py-0.5 text-[11px] uppercase tracking-[0.08em] ${styles[level] ?? styles.medium}`}>
      {level}
    </span>
  );
}

function ExpandableReasoning({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <p className={`text-xs text-[#4A5568] ${expanded ? '' : 'line-clamp-2'}`}>
        {text}
      </p>
      {text.length > 80 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-0.5 text-[10px] text-[#B8960C] hover:underline"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

function TradeTable({
  approved,
  executed,
}: {
  approved: ApprovedTrade[];
  executed: ExecutedTrade[];
}) {
  const executedSymbols = new Set(executed.map((e) => e.symbol));

  const allRows = approved.map((rec) => ({
    ...rec,
    isExecuted: executedSymbols.has(rec.symbol),
  }));

  if (allRows.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[#E2E8F0]">
            {['Ticker', 'Action', 'Qty', 'Confidence', 'Risk', 'Est. Value', 'Status', 'Reasoning'].map((h) => (
              <th
                key={h}
                className="pb-2 pr-4 text-left text-[10px] uppercase tracking-[0.12em] text-[#4A5568] font-normal first:pl-0"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allRows.map((row) => (
            <tr key={row.symbol} className="border-b border-[#E2E8F0]/50 last:border-0">
              <td className="py-3 pr-4 font-mono font-semibold text-[#0A1628]">{row.symbol}</td>
              <td className="py-3 pr-4">
                <ActionBadge action={row.action} />
              </td>
              <td className="py-3 pr-4 font-mono tabular-nums text-[#0A1628]">{row.qty}</td>
              <td className="py-3 pr-4">
                <ConfidenceBar value={row.confidence} />
              </td>
              <td className="py-3 pr-4">
                <RiskBadge level={row.risk_level} />
              </td>
              <td className="py-3 pr-4 font-mono tabular-nums text-[#0A1628]">
                {row.estimated_value != null ? fmtUSD(row.estimated_value) : '—'}
              </td>
              <td className="py-3 pr-4">
                {row.isExecuted ? (
                  <span className="flex items-center gap-1 text-[#166534]">
                    <span>✓</span>
                    <span className="text-[11px] uppercase tracking-[0.08em]">Executed</span>
                  </span>
                ) : row.action === 'hold' ? (
                  <span className="text-[#4A5568]">—</span>
                ) : (
                  <span className="flex items-center gap-1 text-[#166534]">
                    <span>✓</span>
                    <span className="text-[11px] uppercase tracking-[0.08em]">Approved</span>
                  </span>
                )}
              </td>
              <td className="py-3 min-w-[180px] max-w-[260px]">
                <ExpandableReasoning text={row.reasoning} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RejectedTable({ rejected }: { rejected: RejectedTrade[] }) {
  const [open, setOpen] = useState(false);

  if (rejected.length === 0) return null;

  return (
    <div className="border border-[#E2E8F0] bg-white">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-[#F8F9FA] transition-colors"
      >
        <span className="text-[10px] uppercase tracking-[0.15em] text-[#4A5568]">
          {rejected.length} rejected recommendation{rejected.length !== 1 ? 's' : ''}
        </span>
        <span className="text-[#4A5568] text-lg leading-none">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="border-t border-[#E2E8F0] px-6 pb-6 pt-4 overflow-x-auto">
          <table className="w-full text-xs opacity-70">
            <thead>
              <tr className="border-b border-[#E2E8F0]">
                {['Ticker', 'Action', 'Qty', 'Confidence', 'Risk', 'Rejection Reason'].map((h) => (
                  <th
                    key={h}
                    className="pb-2 pr-4 text-left text-[10px] uppercase tracking-[0.12em] text-[#4A5568] font-normal"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rejected.map((row) => (
                <tr key={row.symbol} className="border-b border-[#E2E8F0]/50 last:border-0">
                  <td className="py-3 pr-4 font-mono font-semibold text-[#0A1628]">{row.symbol}</td>
                  <td className="py-3 pr-4">
                    <ActionBadge action={row.action} />
                  </td>
                  <td className="py-3 pr-4 font-mono tabular-nums">{row.qty}</td>
                  <td className="py-3 pr-4 font-mono tabular-nums">{row.confidence}</td>
                  <td className="py-3 pr-4">
                    <RiskBadge level={row.risk_level} />
                  </td>
                  <td className="py-3 pr-4 text-[#991b1b] max-w-[280px]">
                    {row.rejection_reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AutonomousPage() {
  const [analyzing, setAnalyzing]         = useState(false);
  const [result, setResult]               = useState<AutonomousResult | null>(null);
  const [error, setError]                 = useState<string | null>(null);
  const [strategy, setStrategy]           = useState<StrategyData | null>(null);
  const [portfolio, setPortfolio]         = useState<PortfolioData | null>(null);
  const [executing, setExecuting]         = useState(false);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [strategyLoading, setStrategyLoading]   = useState(true);

  // ── Load strategy on mount ─────────────────────────────────────────────────
  useEffect(() => {
    async function loadStrategy() {
      try {
        const res = await fetch('/api/ai/strategy');
        if (!res.ok) return;
        const data: StrategyData = await res.json();
        setStrategy(data);
      } catch {
        // non-fatal
      } finally {
        setStrategyLoading(false);
      }
    }
    loadStrategy();
  }, []);

  // ── Load portfolio on mount ────────────────────────────────────────────────
  useEffect(() => {
    async function loadPortfolio() {
      try {
        const res = await fetch('/api/alpaca/portfolio');
        if (!res.ok) return;
        const data: PortfolioData = await res.json();
        setPortfolio(data);
      } catch {
        // non-fatal
      } finally {
        setPortfolioLoading(false);
      }
    }
    loadPortfolio();
  }, []);

  // ── Run agent ──────────────────────────────────────────────────────────────
  const runAgent = useCallback(async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/autonomous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Analysis failed');
      setResult(data as AutonomousResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Agent failed');
    } finally {
      setAnalyzing(false);
    }
  }, []);

  // ── Execute all approved trades ────────────────────────────────────────────
  const executeAll = useCallback(async () => {
    setExecuting(true);
    try {
      const res = await fetch('/api/ai/autonomous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_execute: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Execution failed');
      setResult(data as AutonomousResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Trade execution failed');
    } finally {
      setExecuting(false);
    }
  }, []);

  // ── Derived state ──────────────────────────────────────────────────────────
  const isAutoMode         = strategy?.user_prefs?.auto_execute ?? false;
  const hasApprovedBuySell = result
    ? result.approved.some((r) => r.action === 'buy' || r.action === 'sell')
    : false;
  const approvedActionCount = result
    ? result.approved.filter((r) => r.action === 'buy' || r.action === 'sell').length
    : 0;
  const statusLabel = analyzing ? 'ANALYZING...' : result ? 'COMPLETE' : 'READY';

  const p = portfolio;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="AI Agent" />

      <main className="flex-1 overflow-y-auto bg-[#F8F9FA] p-8">
        <div className="mx-auto max-w-7xl space-y-8">

          {/* ── Header ──────────────────────────────────────────────────────── */}
          <div>
            <h2 className="font-serif text-2xl font-light text-[#0A1628]">Autonomous Agent</h2>
            <p className="mt-1 text-sm text-[#4A5568]">
              Your AI portfolio manager. Runs continuous analysis, generates recommendations, and executes trades based on your strategy.
            </p>
          </div>

          {/* ── Error banner ─────────────────────────────────────────────────── */}
          {error && (
            <div className="border border-[#C41E3A]/20 bg-[#C41E3A]/5 px-4 py-3 text-sm text-[#C41E3A]">
              {error}
            </div>
          )}

          {/* ── Two-column grid ───────────────────────────────────────────────── */}
          <div className="grid gap-6 lg:grid-cols-3">

            {/* ──────────────── LEFT COLUMN (2/3) ──────────────────────────── */}
            <div className="space-y-6 lg:col-span-2">

              {/* Agent Status Card */}
              <div className="border border-[#E2E8F0] bg-white p-6">
                <p className="text-[10px] uppercase tracking-[0.15em] text-[#B8960C] mb-4">Agent Status</p>

                {/* Status indicator */}
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className={`h-3 w-3 flex-shrink-0 ${
                      analyzing
                        ? 'bg-[#B8960C] animate-pulse'
                        : result
                          ? 'bg-[#166534]'
                          : 'bg-[#4A5568]'
                    }`}
                  />
                  <span className="font-mono text-xl font-medium tracking-[0.15em] text-[#0A1628]">
                    {statusLabel}
                  </span>
                </div>

                {/* Active strategy */}
                <div className="mb-5 border-t border-[#E2E8F0] pt-4">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-[#4A5568] mb-1">Active Strategy</p>
                  {strategyLoading ? (
                    <div className="animate-pulse bg-[#E2E8F0] h-5 w-40" />
                  ) : strategy?.strategy ? (
                    <div className="flex items-center gap-2">
                      <span className="font-serif text-base text-[#0A1628]">{strategy.strategy.name}</span>
                      <RiskBadge level={strategy.strategy.risk_level} />
                    </div>
                  ) : (
                    <Link href="/strategy" className="text-sm text-[#B8960C] hover:underline">
                      Set up a strategy →
                    </Link>
                  )}
                </div>

                {/* Run agent button */}
                <button
                  onClick={runAgent}
                  disabled={analyzing}
                  className="w-full h-14 bg-[#0A1628] text-white text-sm tracking-[0.2em] uppercase flex items-center justify-center gap-3 hover:bg-[#1a2f4a] transition-colors disabled:opacity-60 disabled:cursor-not-allowed mb-4"
                >
                  {analyzing ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Analyzing Portfolio...
                    </>
                  ) : result ? (
                    'Run Again'
                  ) : (
                    'Run Agent'
                  )}
                </button>

                {/* Mode indicator */}
                <p className="text-[11px] text-[#4A5568] text-center mb-3">
                  Mode:{' '}
                  <span className="font-medium text-[#0A1628]">
                    {isAutoMode
                      ? 'Auto Execute (trades placed automatically)'
                      : 'Review (trades require approval)'}
                  </span>
                  {' · '}
                  <Link href="/strategy" className="text-[#B8960C] hover:underline">
                    Change
                  </Link>
                </p>

                {/* Execute approved trades button (review mode only) */}
                {result && !isAutoMode && hasApprovedBuySell && (
                  <button
                    onClick={executeAll}
                    disabled={executing}
                    className="w-full h-10 border border-[#166534] text-[#166534] text-[11px] tracking-[0.15em] uppercase flex items-center justify-center gap-2 hover:bg-[#166534]/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {executing ? (
                      <>
                        <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Executing...
                      </>
                    ) : (
                      `Execute ${approvedActionCount} Approved Trade${approvedActionCount !== 1 ? 's' : ''}`
                    )}
                  </button>
                )}
              </div>

              {/* Latest session results */}
              {result && (
                <div className="border border-[#E2E8F0] bg-white p-6 space-y-5">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-[#B8960C]">Session Results</p>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-4 border-b border-[#E2E8F0] pb-5">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.1em] text-[#4A5568] mb-1">Trades Approved</p>
                      <p className="font-mono tabular-nums text-2xl font-light text-[#0A1628]">
                        {result.session.trades_approved}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.1em] text-[#4A5568] mb-1">Executed</p>
                      <p className="font-mono tabular-nums text-2xl font-light text-[#0A1628]">
                        {result.session.trades_executed}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.1em] text-[#4A5568] mb-1">Value Deployed</p>
                      <p className="font-mono tabular-nums text-2xl font-light text-[#0A1628]">
                        {fmtUSD(result.session.total_trade_value)}
                      </p>
                    </div>
                  </div>

                  {/* Market outlook */}
                  {result.session.market_outlook && (
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.15em] text-[#B8960C] mb-2">Market Outlook</p>
                      <p className="text-sm text-[#4A5568] leading-relaxed">{result.session.market_outlook}</p>
                    </div>
                  )}

                  {/* Summary */}
                  {result.session.summary && (
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.15em] text-[#B8960C] mb-2">Summary</p>
                      <p className="text-sm text-[#4A5568] leading-relaxed">{result.session.summary}</p>
                    </div>
                  )}

                  {/* Warnings */}
                  {result.warnings.length > 0 && (
                    <div className="border border-amber-200 bg-amber-50 p-4 space-y-1">
                      {result.warnings.map((w, i) => (
                        <p key={i} className="text-xs text-amber-800 flex items-start gap-2">
                          <span className="mt-0.5 flex-shrink-0">⚠</span>
                          {w}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Trade recommendations table */}
              {result && result.approved.length > 0 && (
                <div className="border border-[#E2E8F0] bg-white p-6">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-[#B8960C] mb-5">Recommendations</p>
                  <TradeTable approved={result.approved} executed={result.executed} />
                </div>
              )}

              {/* Rejected recommendations */}
              {result && result.rejected.length > 0 && (
                <RejectedTable rejected={result.rejected} />
              )}
            </div>

            {/* ──────────────── RIGHT COLUMN (1/3) ─────────────────────────── */}
            <div className="space-y-6">

              {/* Portfolio snapshot */}
              <div className="border border-[#E2E8F0] bg-white p-6">
                <p className="text-[10px] uppercase tracking-[0.15em] text-[#B8960C] mb-4">Portfolio Snapshot</p>

                {portfolioLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse bg-[#E2E8F0] h-5" />
                    ))}
                  </div>
                ) : p ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#4A5568]">Equity</span>
                      <span className="font-mono tabular-nums text-sm text-[#0A1628]">{fmtUSD(p.equity)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#4A5568]">Cash Available</span>
                      <span className="font-mono tabular-nums text-sm text-[#0A1628]">{fmtUSD(p.cash)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#4A5568]">Day P&amp;L</span>
                      <span className={`font-mono tabular-nums text-sm ${p.day_pl >= 0 ? 'text-[#166534]' : 'text-[#991b1b]'}`}>
                        {p.day_pl >= 0 ? '+' : ''}{fmtUSD(p.day_pl)} ({fmtPct(p.day_pl_pct)})
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#4A5568]">Portfolio data unavailable.</p>
                )}
              </div>

              {/* Strategy card mini */}
              <div className="border border-[#E2E8F0] bg-white p-6">
                <p className="text-[10px] uppercase tracking-[0.15em] text-[#B8960C] mb-4">Your Strategy</p>

                {strategyLoading ? (
                  <div className="space-y-2">
                    <div className="animate-pulse bg-[#E2E8F0] h-5 w-3/4" />
                    <div className="animate-pulse bg-[#E2E8F0] h-4 w-1/2" />
                  </div>
                ) : strategy?.strategy ? (
                  <div className="space-y-2">
                    <p className="font-serif text-base font-semibold text-[#0A1628]">{strategy.strategy.name}</p>
                    <RiskBadge level={strategy.strategy.risk_level} />
                    <p className="pt-1 text-xs text-[#4A5568]">
                      Target return:{' '}
                      <span className="font-mono tabular-nums text-[#0A1628]">
                        +{strategy.strategy.target_return_pct}%
                      </span>
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-[#4A5568]">No strategy selected.</p>
                )}

                <div className="mt-4 border-t border-[#E2E8F0] pt-4">
                  <Link
                    href="/strategy"
                    className="text-[11px] uppercase tracking-[0.15em] text-[#B8960C] hover:underline"
                  >
                    Change Strategy →
                  </Link>
                </div>
              </div>

              {/* Agent info */}
              <div className="border border-[#E2E8F0] bg-white p-6">
                <p className="text-[10px] uppercase tracking-[0.15em] text-[#B8960C] mb-4">How It Works</p>
                <ul className="space-y-2 text-xs text-[#4A5568]">
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 flex-shrink-0 text-[#B8960C]">·</span>
                    Analyzes your full portfolio and watchlist
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 flex-shrink-0 text-[#B8960C]">·</span>
                    Applies your chosen strategy filter
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 flex-shrink-0 text-[#B8960C]">·</span>
                    Enforces risk limits — position sizing and confidence thresholds
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 flex-shrink-0 text-[#B8960C]">·</span>
                    Review mode: you approve each trade before execution
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 flex-shrink-0 text-[#B8960C]">·</span>
                    Auto mode: approved trades execute immediately
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 flex-shrink-0 text-[#B8960C]">·</span>
                    All actions are logged and reversible
                  </li>
                </ul>
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
