'use client';

import { useState, useEffect, useCallback } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { cn } from '@/lib/utils';
import type { AutopilotSettings } from '@/app/api/ai/autopilot/status/route';
import type { AutopilotRun, AutopilotDecision } from '@/app/api/ai/autopilot/history/route';

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtUSD(n: number): string {
  return '$' + n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(iso: string): string {
  const d   = new Date(iso);
  const now = new Date();
  const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yod = new Date(sod.getTime() - 86400000);

  const timeStr = new Intl.DateTimeFormat('en-US', {
    hour:   'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);

  if (d >= sod)  return `Today ${timeStr}`;
  if (d >= yod)  return `Yesterday ${timeStr}`;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day:   'numeric',
    hour:  'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

// ── Toggle component ──────────────────────────────────────────────────────────

interface ToggleProps {
  enabled: boolean;
  loading: boolean;
  onToggle: () => void;
}

function AutopilotToggle({ enabled, loading, onToggle }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={loading}
      aria-label={enabled ? 'Disable AutoPilot' : 'Enable AutoPilot'}
      className={cn(
        'relative flex items-center transition-all duration-300 focus:outline-none disabled:cursor-not-allowed',
        'h-10 w-20',
        enabled
          ? 'bg-[#B8960C] shadow-[0_0_20px_rgba(184,150,12,0.4)]'
          : 'bg-white/20',
      )}
      style={{ flexShrink: 0 }}
    >
      {/* Knob */}
      <span
        className={cn(
          'absolute top-1 h-8 w-8 bg-white transition-all duration-300',
          enabled ? 'left-[calc(100%-2.25rem)]' : 'left-1',
        )}
      />
    </button>
  );
}

// ── RunResult modal ───────────────────────────────────────────────────────────

interface RunResultData {
  trades: Array<{
    symbol:   string;
    action:   'buy' | 'sell' | 'failed';
    qty:      number;
    status:   string;
    order_id?: string;
    error?:   string;
  }>;
  market_outlook: string;
  summary:        string;
}

interface RunResultModalProps {
  result: RunResultData;
  onClose: () => void;
}

function RunResultModal({ result, onClose }: RunResultModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white w-full max-w-lg mx-4 border border-[#E2E8F0] shadow-2xl">
        {/* Header */}
        <div className="border-b border-[#E2E8F0] px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] tracking-[0.2em] uppercase text-[#B8960C]">AutoPilot</p>
            <h2 className="font-serif text-xl font-light text-[#0A1628] mt-0.5">AI Analysis Complete</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#4A5568] hover:text-[#0A1628] transition-colors text-lg leading-none"
          >
            &times;
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 divide-x divide-[#E2E8F0] border-b border-[#E2E8F0]">
          <div className="px-6 py-4">
            <p className="text-[10px] tracking-[0.12em] uppercase text-[#4A5568]">Trades Executed</p>
            <p className="font-mono text-2xl text-[#0A1628] mt-1 tabular-nums">
              {result.trades.filter((t) => t.status === 'executed').length}
            </p>
          </div>
          <div className="px-6 py-4">
            <p className="text-[10px] tracking-[0.12em] uppercase text-[#4A5568]">Total Orders</p>
            <p className="font-mono text-2xl text-[#0A1628] mt-1 tabular-nums">
              {result.trades.length}
            </p>
          </div>
        </div>

        {/* Trade list */}
        {result.trades.length > 0 && (
          <div className="px-6 py-4 border-b border-[#E2E8F0] space-y-2 max-h-48 overflow-y-auto">
            {result.trades.map((t, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'text-[10px] tracking-[0.15em] uppercase font-medium',
                      t.status === 'executed'
                        ? t.action === 'buy' ? 'text-[#166534]' : 'text-[#991b1b]'
                        : 'text-[#4A5568]',
                    )}
                  >
                    {t.status === 'executed' ? t.action.toUpperCase() : 'SKIP'}
                  </span>
                  <span className="font-mono font-bold text-[#0A1628]">{t.symbol}</span>
                  <span className="text-[#4A5568] font-mono tabular-nums">{t.qty} sh</span>
                </div>
                <span className={cn(
                  'text-[10px] tracking-[0.1em] uppercase',
                  t.status === 'executed' ? 'text-[#166534]' : 'text-[#991b1b]',
                )}>
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Market outlook */}
        {result.market_outlook && (
          <div className="px-6 py-4 border-b border-[#E2E8F0]">
            <p className="text-[10px] tracking-[0.12em] uppercase text-[#4A5568] mb-2">Market Outlook</p>
            <p className="text-sm text-[#0A1628] leading-relaxed">{result.market_outlook}</p>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-between gap-3 flex-wrap">
          <a
            href="#history"
            onClick={onClose}
            className="text-[11px] tracking-[0.1em] uppercase text-[#B8960C] hover:text-[#0A1628] transition-colors"
          >
            View Full History
          </a>
          <div className="flex items-center gap-3">
            <a
              href="/holdings"
              className="border border-[#B8960C] px-4 py-2 text-[11px] tracking-[0.15em] uppercase text-[#B8960C] hover:bg-[#B8960C] hover:text-white transition-colors"
            >
              View Holdings
            </a>
            <button
              type="button"
              onClick={onClose}
              className="border border-[#0A1628] px-4 py-2 text-[11px] tracking-[0.15em] uppercase text-[#0A1628] hover:bg-[#0A1628] hover:text-white transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Loading overlay ───────────────────────────────────────────────────────────

function RunningOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A1628]/90">
      <div className="text-center">
        <div className="inline-flex items-center gap-3 mb-4">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 bg-[#B8960C] animate-pulse"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
        <p className="font-serif text-2xl font-light text-white mb-2">AI is analyzing markets</p>
        <p className="text-[#4A5568] text-sm">Scanning securities, evaluating positions...</p>
      </div>
    </div>
  );
}

// ── Activity row ──────────────────────────────────────────────────────────────

interface RunRowProps {
  run: AutopilotRun;
}

function RunRow({ run }: RunRowProps) {
  const [expanded, setExpanded] = useState(false);
  const decisions = (run.decisions ?? []) as AutopilotDecision[];
  const executed  = decisions.filter((d) => d.status === 'executed');

  return (
    <div className="border-b border-[#E2E8F0] last:border-b-0">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full text-left px-6 py-4 hover:bg-[#F8F9FA] transition-colors"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Date + status */}
            <div className="flex items-center gap-3 mb-1">
              <span className="font-mono text-xs tabular-nums text-[#4A5568]">
                {fmtDate(run.run_at)}
              </span>
              <span className={cn(
                'text-[9px] tracking-[0.15em] uppercase',
                run.status === 'completed' ? 'text-[#166534]' : 'text-[#991b1b]',
              )}>
                {run.status}
              </span>
            </div>

            {/* Market outlook */}
            {run.market_outlook && (
              <p className="text-sm text-[#0A1628] leading-relaxed line-clamp-2 mb-2">
                {run.market_outlook}
              </p>
            )}

            {/* Stats */}
            <div className="flex items-center gap-6">
              <div>
                <span className="text-[10px] tracking-[0.1em] uppercase text-[#4A5568]">Trades </span>
                <span className="font-mono text-xs text-[#0A1628] tabular-nums">{run.trades_executed}</span>
              </div>
              <div>
                <span className="text-[10px] tracking-[0.1em] uppercase text-[#4A5568]">Deployed </span>
                <span className="font-mono text-xs text-[#0A1628] tabular-nums">{fmtUSD(run.total_value)}</span>
              </div>
            </div>
          </div>

          {/* Expand indicator */}
          {decisions.length > 0 && (
            <span className="text-[#4A5568] text-sm shrink-0 mt-1">
              {expanded ? '−' : '+'}
            </span>
          )}
        </div>
      </button>

      {/* Expanded decisions */}
      {expanded && decisions.length > 0 && (
        <div className="px-6 pb-4 border-t border-[#E2E8F0] bg-[#F8F9FA]">
          <p className="text-[10px] tracking-[0.12em] uppercase text-[#4A5568] py-3">
            Decisions ({executed.length} executed)
          </p>
          <div className="space-y-3">
            {decisions.map((d, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span className={cn(
                  'text-[10px] tracking-[0.15em] uppercase font-medium shrink-0 mt-0.5',
                  d.status === 'executed'
                    ? d.action === 'buy' ? 'text-[#166534]' : 'text-[#991b1b]'
                    : d.status === 'skipped' ? 'text-[#4A5568]'
                    : 'text-[#991b1b]/70',
                )}>
                  {d.action.toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono font-bold text-[#0A1628] text-xs">{d.symbol}</span>
                    {d.action !== 'hold' && (
                      <span className="font-mono text-xs tabular-nums text-[#4A5568]">
                        {d.qty} sh
                      </span>
                    )}
                    <span className="text-[9px] text-[#4A5568] tabular-nums">
                      {d.confidence}% confidence
                    </span>
                  </div>
                  <p className="text-xs text-[#4A5568] leading-relaxed">{d.reasoning}</p>
                  {d.error && (
                    <p className="text-xs text-[#991b1b] mt-1">{d.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── localStorage persistence (fallback when DB table is missing) ──────────────

const LS_KEY = 'tavola:autopilot';

interface LocalSettings {
  enabled?: boolean;
  frequency?: 'daily' | 'weekly' | 'monthly';
  max_trade_size?: number;
}

function readLocal(): LocalSettings {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(LS_KEY) : null;
    return raw ? (JSON.parse(raw) as LocalSettings) : {};
  } catch { return {}; }
}

function writeLocal(patch: LocalSettings) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ ...readLocal(), ...patch }));
  } catch {}
}

// ── Main page ─────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: AutopilotSettings = {
  user_id:        '',
  enabled:        false,
  frequency:      'daily',
  max_trade_size: 5000,
  last_run_at:    null,
  next_run_at:    null,
  created_at:     new Date().toISOString(),
  updated_at:     new Date().toISOString(),
};

const FREQUENCY_OPTIONS = [
  { value: 'daily',   label: 'Daily'   },
  { value: 'weekly',  label: 'Weekly'  },
  { value: 'monthly', label: 'Monthly' },
] as const;

const TRADE_SIZE_PRESETS = [
  { label: '$500',   value: 500   },
  { label: '$1k',    value: 1000  },
  { label: '$5k',    value: 5000  },
] as const;

export default function AutopilotPage() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [settings, setSettings]           = useState<AutopilotSettings | null>(null);
  const [runs, setRuns]                   = useState<AutopilotRun[]>([]);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [historyLoading, setHistoryLoading]   = useState(true);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [saveLoading, setSaveLoading]     = useState(false);
  const [running, setRunning]             = useState(false);
  const [runResult, setRunResult]         = useState<RunResultData | null>(null);
  const [error, setError]                 = useState<string | null>(null);

  // Local edits before saving
  const [localFrequency, setLocalFrequency]     = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [localMaxTrade, setLocalMaxTrade]        = useState<number>(1000);
  const [customTradeInput, setCustomTradeInput]  = useState('');
  const [showCustomInput, setShowCustomInput]    = useState(false);

  // ── Load settings ──────────────────────────────────────────────────────────
  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/autopilot/status');
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json() as { settings?: AutopilotSettings };
      const s = data.settings;
      if (!s) throw new Error('no settings in response');
      // Merge: localStorage overrides API defaults so settings survive tab switches
      const local = readLocal();
      const merged: AutopilotSettings = {
        ...s,
        ...(local.enabled        !== undefined && { enabled:        local.enabled }),
        ...(local.frequency      !== undefined && { frequency:      local.frequency }),
        ...(local.max_trade_size !== undefined && { max_trade_size: local.max_trade_size }),
      };
      setSettings(merged);
      setLocalFrequency(merged.frequency);
      setLocalMaxTrade(merged.max_trade_size);
    } catch {
      // Any failure — table missing, network error — use defaults merged with local
      const local = readLocal();
      const merged: AutopilotSettings = {
        ...DEFAULT_SETTINGS,
        ...(local.enabled        !== undefined && { enabled:        local.enabled }),
        ...(local.frequency      !== undefined && { frequency:      local.frequency }),
        ...(local.max_trade_size !== undefined && { max_trade_size: local.max_trade_size }),
      };
      setSettings(merged);
      setLocalFrequency(merged.frequency);
      setLocalMaxTrade(merged.max_trade_size);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  // ── Load history ───────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/autopilot/history?limit=20');
      if (!res.ok) throw new Error('Failed to load history');
      const { runs: r } = await res.json() as { runs: AutopilotRun[] };
      setRuns(r);
    } catch (err) {
      console.error('[autopilot] load history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    loadHistory();
  }, [loadSettings, loadHistory]);

  // ── Toggle enabled ─────────────────────────────────────────────────────────
  const handleToggle = useCallback(async () => {
    if (!settings) return;
    const newEnabled = !settings.enabled;

    // Optimistic update
    setSettings((prev) => prev ? { ...prev, enabled: newEnabled } : prev);
    setToggleLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/autopilot/status', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ enabled: newEnabled }),
      });
      if (!res.ok) throw new Error('Failed to update AutoPilot status');
      const { settings: updated } = await res.json() as { settings: AutopilotSettings };
      setSettings(updated);
      writeLocal({ enabled: updated.enabled });
    } catch {
      // API failed — keep optimistic UI and persist locally so it survives tab switches
      writeLocal({ enabled: newEnabled });
    } finally {
      setToggleLoading(false);
    }
  }, [settings]);

  // ── Save settings ──────────────────────────────────────────────────────────
  const handleSaveSettings = useCallback(async () => {
    setSaveLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/autopilot/status', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          frequency:      localFrequency,
          max_trade_size: localMaxTrade,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? 'Failed to save settings');
      }
      const { settings: updated } = await res.json() as { settings: AutopilotSettings };
      setSettings(updated);
      writeLocal({ frequency: updated.frequency, max_trade_size: updated.max_trade_size });
    } catch {
      // Persist locally even if API fails
      writeLocal({ frequency: localFrequency, max_trade_size: localMaxTrade });
    } finally {
      setSaveLoading(false);
    }
  }, [localFrequency, localMaxTrade]);

  // ── Run now ────────────────────────────────────────────────────────────────
  const handleRunNow = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/autopilot/run', { method: 'POST' });
      const data = await res.json() as {
        trades?: RunResultData['trades'];
        market_outlook?: string;
        summary?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? 'AutoPilot run failed');
      setRunResult({
        trades:         data.trades ?? [],
        market_outlook: data.market_outlook ?? '',
        summary:        data.summary ?? '',
      });
      // Sync holdings after run (best-effort)
      fetch('/api/alpaca/sync', { method: 'POST' }).catch(() => {});
      // Refresh history after run
      await loadHistory();
      await loadSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AutoPilot run failed. Please try again.');
    } finally {
      setRunning(false);
    }
  }, [loadHistory, loadSettings]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totalRuns      = runs.length;
  const totalTrades    = runs.reduce((s, r) => s + r.trades_executed, 0);
  const totalDeployed  = runs.reduce((s, r) => s + r.total_value, 0);
  const isEnabled      = settings?.enabled ?? false;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="AutoPilot" />

      {/* Running overlay */}
      {running && <RunningOverlay />}

      {/* Run result modal */}
      {runResult && (
        <RunResultModal result={runResult} onClose={() => setRunResult(null)} />
      )}

      <main className="flex-1 overflow-y-auto">

        {/* ── HERO SECTION ─────────────────────────────────────────────────── */}
        <section className="bg-[#0A1628] px-6 py-12 sm:px-10 sm:py-16">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">

              {/* Left: title + toggle */}
              <div className="flex-1">
                <p className="text-[10px] tracking-[0.3em] uppercase text-[#B8960C] mb-3">
                  Tavola AutoPilot
                </p>
                <h1 className="font-serif text-5xl font-light text-white mb-3 leading-tight">
                  AutoPilot
                </h1>
                <p className="text-white/60 text-lg mb-8 leading-relaxed">
                  Institutional-grade AI investing. Fully automated.
                </p>

                {/* Toggle */}
                <div className="flex items-center gap-5 mb-6">
                  <AutopilotToggle
                    enabled={isEnabled}
                    loading={toggleLoading || settingsLoading}
                    onToggle={handleToggle}
                  />
                  <div>
                    <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-white/40 mb-0.5">
                      Status
                    </p>
                    <div className="flex items-center gap-2">
                      {isEnabled ? (
                        <>
                          <span
                            className="h-2 w-2 bg-[#4ade80] animate-pulse"
                            style={{ borderRadius: 0 }}
                          />
                          <span className="font-mono text-sm text-[#4ade80] tracking-wide">
                            AUTOPILOT ON
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="h-2 w-2 bg-white/30" style={{ borderRadius: 0 }} />
                          <span className="font-mono text-sm text-white/40 tracking-wide">
                            AUTOPILOT OFF
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-white/30 mt-1">
                      {isEnabled
                        ? 'AI is actively managing your portfolio'
                        : 'AutoPilot is paused'}
                    </p>
                  </div>
                </div>

                {/* Next run info */}
                {isEnabled && settings?.next_run_at && (
                  <p className="text-[11px] text-white/30 tracking-wide">
                    Next scheduled run: {fmtDate(settings.next_run_at)}
                  </p>
                )}
              </div>

              {/* Right: stats strip */}
              <div className="flex flex-row gap-px lg:flex-col lg:gap-px">
                {[
                  { label: 'Total Runs',       value: totalRuns.toString(),    mono: true },
                  { label: 'Trades Executed',  value: totalTrades.toString(),  mono: true },
                  { label: 'Total Deployed',   value: fmtUSD(totalDeployed),   mono: true },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="border border-white/10 bg-white/5 px-6 py-4 min-w-[140px]"
                  >
                    <p className="text-[10px] tracking-[0.12em] uppercase text-white/40 mb-1">
                      {label}
                    </p>
                    <p className="font-mono text-xl text-white tabular-nums">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── SETTINGS SECTION ─────────────────────────────────────────────── */}
        <section className="bg-white border-b border-[#E2E8F0] px-6 py-10 sm:px-10">
          <div className="mx-auto max-w-6xl">
            <div className="border-b border-[#E2E8F0] pb-6 mb-8">
              <h2 className="font-serif text-2xl font-light text-[#0A1628]">Settings</h2>
              <p className="text-sm text-[#4A5568] mt-1">Configure your AutoPilot investment strategy</p>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">

              {/* Investment frequency */}
              <div className="border border-[#E2E8F0] p-6">
                <p className="text-[10px] tracking-[0.15em] uppercase text-[#4A5568] mb-1">
                  Investment Frequency
                </p>
                <p className="text-sm text-[#4A5568] mb-4">
                  How often AutoPilot analyzes and rebalances your portfolio
                </p>
                <div className="flex gap-px">
                  {FREQUENCY_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setLocalFrequency(value)}
                      className={cn(
                        'flex-1 py-2.5 text-[11px] tracking-[0.15em] uppercase transition-colors',
                        localFrequency === value
                          ? 'bg-[#0A1628] text-white'
                          : 'border border-[#E2E8F0] text-[#4A5568] hover:border-[#0A1628] hover:text-[#0A1628]',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Max trade size */}
              <div className="border border-[#E2E8F0] p-6">
                <p className="text-[10px] tracking-[0.15em] uppercase text-[#4A5568] mb-1">
                  Max Trade Size
                </p>
                <p className="text-sm text-[#4A5568] mb-4">
                  Maximum USD value per individual trade
                </p>
                <div className="flex gap-px flex-wrap">
                  {TRADE_SIZE_PRESETS.map(({ label, value }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setLocalMaxTrade(value);
                        setShowCustomInput(false);
                        setCustomTradeInput('');
                      }}
                      className={cn(
                        'px-4 py-2.5 text-[11px] tracking-[0.15em] uppercase transition-colors',
                        localMaxTrade === value && !showCustomInput
                          ? 'bg-[#0A1628] text-white'
                          : 'border border-[#E2E8F0] text-[#4A5568] hover:border-[#0A1628] hover:text-[#0A1628]',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowCustomInput((p) => !p)}
                    className={cn(
                      'px-4 py-2.5 text-[11px] tracking-[0.15em] uppercase transition-colors',
                      showCustomInput
                        ? 'bg-[#0A1628] text-white'
                        : 'border border-[#E2E8F0] text-[#4A5568] hover:border-[#0A1628] hover:text-[#0A1628]',
                    )}
                  >
                    Custom
                  </button>
                </div>

                {showCustomInput && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-[#4A5568] text-sm">$</span>
                    <input
                      type="number"
                      min={100}
                      max={50000}
                      value={customTradeInput}
                      onChange={(e) => {
                        setCustomTradeInput(e.target.value);
                        const v = parseInt(e.target.value, 10);
                        if (!isNaN(v) && v >= 100 && v <= 50000) {
                          setLocalMaxTrade(v);
                        }
                      }}
                      placeholder="100–50000"
                      className="border border-[#E2E8F0] px-3 py-2 text-sm font-mono w-32 focus:outline-none focus:border-[#0A1628] text-[#0A1628]"
                    />
                    <span className="text-xs text-[#4A5568]">
                      Current: {fmtUSD(localMaxTrade)}
                    </span>
                  </div>
                )}

                {!showCustomInput && (
                  <p className="mt-3 font-mono text-sm tabular-nums text-[#0A1628]">
                    Max: {fmtUSD(localMaxTrade)} per trade
                  </p>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={saveLoading}
                className="border border-[#0A1628] bg-[#0A1628] px-6 py-3 text-[11px] tracking-[0.2em] uppercase text-white hover:bg-[#0A1628]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saveLoading ? 'Saving...' : 'Save Settings'}
              </button>

              <div className="h-px sm:h-8 sm:w-px bg-[#E2E8F0] self-stretch sm:self-auto" />

              <button
                type="button"
                onClick={handleRunNow}
                disabled={running || !isEnabled}
                className={cn(
                  'border px-6 py-3 text-[11px] tracking-[0.2em] uppercase transition-colors',
                  isEnabled
                    ? 'border-[#B8960C] text-[#B8960C] hover:bg-[#B8960C] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed'
                    : 'border-[#E2E8F0] text-[#4A5568]/40 cursor-not-allowed',
                )}
              >
                {running ? (
                  <span className="flex items-center gap-2">
                    <span className="h-1 w-1 bg-current animate-pulse" />
                    Analyzing...
                  </span>
                ) : 'Run Now'}
              </button>

              {!isEnabled && (
                <p className="text-xs text-[#4A5568]">
                  Enable AutoPilot to trigger a run
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ── ACTIVITY LOG ─────────────────────────────────────────────────── */}
        <section id="history" className="bg-white px-6 py-10 sm:px-10 border-b border-[#E2E8F0]">
          <div className="mx-auto max-w-6xl">
            <div className="border-b border-[#E2E8F0] pb-6 mb-6">
              <h2 className="font-serif text-2xl font-light text-[#0A1628]">Recent Activity</h2>
              <p className="text-sm text-[#4A5568] mt-1">AutoPilot run history and decisions</p>
            </div>

            {historyLoading ? (
              <div className="border border-[#E2E8F0] px-6 py-12 text-center">
                <p className="text-[11px] tracking-[0.12em] uppercase text-[#4A5568]">Loading</p>
              </div>
            ) : runs.length === 0 ? (
              <div className="border border-[#E2E8F0] px-6 py-12 text-center">
                <p className="font-serif text-lg font-light text-[#0A1628] mb-2">
                  No runs yet.
                </p>
                <p className="text-sm text-[#4A5568]">
                  {isEnabled
                    ? 'Click "Run Now" to trigger your first AutoPilot analysis.'
                    : 'Enable AutoPilot and click "Run Now" to get started.'}
                </p>
              </div>
            ) : (
              <div className="border border-[#E2E8F0]">
                {runs.map((run) => (
                  <RunRow key={run.id} run={run} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
        <section className="bg-[#F8F9FA] px-6 py-12 sm:px-10">
          <div className="mx-auto max-w-6xl">
            <div className="border-b border-[#E2E8F0] pb-6 mb-8">
              <h2 className="font-serif text-2xl font-light text-[#0A1628]">How It Works</h2>
            </div>

            <div className="grid gap-px bg-[#E2E8F0] sm:grid-cols-3">
              {[
                {
                  step: '01',
                  title: 'AI Analyzes Markets',
                  body: 'Scans 20+ securities, reads your portfolio positions, evaluates sentiment and technical signals to identify opportunities aligned with your risk profile.',
                },
                {
                  step: '02',
                  title: 'Executes Trades',
                  body: 'Places orders through Alpaca based on your configured risk settings. Every trade is filtered through multi-layer risk guards before execution.',
                },
                {
                  step: '03',
                  title: 'Monitors Growth',
                  body: 'Continuously tracks portfolio health, position concentration, and market conditions. Adapts recommendations on each scheduled run.',
                },
              ].map(({ step, title, body }) => (
                <div key={step} className="bg-white px-8 py-8">
                  <p className="font-mono text-[10px] tracking-[0.2em] text-[#B8960C] mb-4">{step}</p>
                  <h3 className="font-serif text-lg font-light text-[#0A1628] mb-3">{title}</h3>
                  <p className="text-sm text-[#4A5568] leading-relaxed">{body}</p>
                </div>
              ))}
            </div>

            {/* Disclaimer */}
            <div className="mt-8 border border-[#E2E8F0] bg-white px-6 py-4">
              <p className="text-[11px] text-[#4A5568] leading-relaxed">
                <span className="font-medium text-[#0A1628]">Risk Disclosure.</span>{' '}
                AutoPilot executes trades on your behalf using AI analysis. All investing involves risk.
                Past performance does not guarantee future results. Trade limits and risk guards are applied
                but cannot eliminate loss. Monitor your portfolio regularly.
              </p>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
