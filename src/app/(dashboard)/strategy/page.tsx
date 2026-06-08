'use client';

import { useState, useEffect, useCallback } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { StrategyCard, type InvestmentStrategy } from '@/components/strategy/StrategyCard';
import { cn } from '@/lib/utils';

interface UserPrefs {
  strategy_id: string;
  auto_execute: boolean;
  max_trade_value: number;
}

interface StrategyResponse {
  strategy: InvestmentStrategy;
  user_prefs: UserPrefs | null;
  all_strategies: InvestmentStrategy[];
}

interface PostStrategyResponse {
  strategy: InvestmentStrategy;
  user_prefs: UserPrefs;
}

type SaveMsg = { type: 'success' | 'error'; text: string };

export default function StrategyPage() {
  const [activeStrategy, setActiveStrategy] = useState<InvestmentStrategy | null>(null);
  const [allStrategies, setAllStrategies] = useState<InvestmentStrategy[]>([]);
  const [userPrefs, setUserPrefs] = useState<UserPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Activating state — tracks which strategy id is currently being activated
  const [activatingId, setActivatingId] = useState<string | null>(null);

  // Settings panel state
  const [autoExecute, setAutoExecute] = useState(false);
  const [maxTradeValue, setMaxTradeValue] = useState<number>(5000);
  const [savingSettings, setSavingSettings] = useState(false);
  const [saveMsg, setSaveMsg] = useState<SaveMsg | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/strategy');
      if (!res.ok) throw new Error(`Failed to load strategies (${res.status})`);
      const data: StrategyResponse = await res.json();
      setActiveStrategy(data.strategy);
      setAllStrategies(data.all_strategies);
      setUserPrefs(data.user_prefs);
      if (data.user_prefs) {
        setAutoExecute(data.user_prefs.auto_execute);
        setMaxTradeValue(data.user_prefs.max_trade_value);
      }
    } catch {
      setError('Unable to load strategies. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleActivate(strategyId: string) {
    setActivatingId(strategyId);
    setError(null);
    try {
      const res = await fetch('/api/ai/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy_id: strategyId }),
      });
      if (!res.ok) throw new Error(`Failed to activate strategy (${res.status})`);
      const data: PostStrategyResponse = await res.json();
      setActiveStrategy(data.strategy);
      setUserPrefs(data.user_prefs);
      setAutoExecute(data.user_prefs.auto_execute);
      setMaxTradeValue(data.user_prefs.max_trade_value);
    } catch {
      setError('Unable to activate strategy. Please try again.');
    } finally {
      setActivatingId(null);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!userPrefs) return;
    setSavingSettings(true);
    setSaveMsg(null);
    try {
      const res = await fetch('/api/ai/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy_id: userPrefs.strategy_id,
          auto_execute: autoExecute,
          max_trade_value: maxTradeValue,
        }),
      });
      if (!res.ok) throw new Error(`Failed to save settings (${res.status})`);
      const data: PostStrategyResponse = await res.json();
      setUserPrefs(data.user_prefs);
      setSaveMsg({ type: 'success', text: 'Settings saved.' });
    } catch {
      setSaveMsg({ type: 'error', text: 'Unable to save settings. Please try again.' });
    } finally {
      setSavingSettings(false);
      setTimeout(() => setSaveMsg(null), 4000);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="Strategy Hub" />

      <main className="flex-1 overflow-y-auto bg-[#F8F9FA] p-4 sm:p-8">
        <div className="mx-auto max-w-7xl space-y-10">

          {/* Page header */}
          <div className="border-b border-[#E2E8F0] pb-6">
            <h2 className="font-serif text-2xl font-light text-[#0A1628]">Investment Strategy</h2>
            <p className="mt-1 text-sm text-[#4A5568]">
              Select your investment philosophy. The AI agent will tailor every recommendation and
              trade to your chosen strategy.
            </p>
          </div>

          {/* Error state */}
          {error && (
            <div className="border border-[#C41E3A]/20 bg-[#C41E3A]/5 text-[#C41E3A] px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* Active strategy banner */}
          {userPrefs && activeStrategy && (
            <div className="flex flex-col gap-3 border border-[#B8960C]/30 bg-[#B8960C]/5 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span
                  className="h-2 w-2 shrink-0"
                  style={{ backgroundColor: activeStrategy.accent_color }}
                />
                <div>
                  <p className="text-[10px] tracking-[0.15em] uppercase text-[#B8960C]">
                    Active Strategy
                  </p>
                  <p className="font-serif text-[18px] font-light text-[#0A1628]">
                    {activeStrategy.name}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="border border-[#B8960C]/40 px-3 py-1 text-[10px] tracking-[0.12em] uppercase text-[#B8960C]">
                  Mode: {userPrefs.auto_execute ? 'Auto Execute' : 'Review'}
                </span>
                <button
                  onClick={() => {
                    const settingsEl = document.getElementById('agent-settings');
                    settingsEl?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="text-[11px] tracking-[0.12em] uppercase text-[#4A5568] underline underline-offset-2 hover:text-[#0A1628] transition-colors"
                >
                  Settings
                </button>
              </div>
            </div>
          )}

          {/* Strategy grid */}
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-72 animate-pulse bg-[#E2E8F0]" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {allStrategies.map((strategy) => (
                <StrategyCard
                  key={strategy.id}
                  strategy={strategy}
                  isActive={userPrefs?.strategy_id === strategy.id}
                  onActivate={() => handleActivate(strategy.id)}
                  activating={activatingId === strategy.id}
                />
              ))}
            </div>
          )}

          {/* Agent settings panel */}
          {userPrefs && !loading && (
            <div id="agent-settings" className="bg-white border border-[#E2E8F0] p-6 sm:p-8">
              <p className="mb-6 text-[10px] tracking-[0.15em] uppercase text-[#B8960C]">
                Agent Settings
              </p>

              <form onSubmit={handleSaveSettings} className="space-y-8">

                {/* Execution mode */}
                <div>
                  <p className="mb-1 text-[11px] tracking-[0.12em] uppercase text-[#0A1628]/40">
                    Execution Mode
                  </p>
                  <p className="mb-3 text-sm text-[#4A5568]">
                    Choose how the AI agent handles trade recommendations.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => setAutoExecute(false)}
                      className={cn(
                        'flex-1 border px-5 py-4 text-left transition-colors',
                        !autoExecute
                          ? 'border-[#0A1628] bg-[#F8F9FA]'
                          : 'border-[#E2E8F0] hover:border-[#0A1628]/30',
                      )}
                    >
                      <p className="text-sm font-medium text-[#0A1628]">Review Mode</p>
                      <p className="mt-0.5 text-[11px] text-[#4A5568]">
                        AI recommends, you approve each trade
                      </p>
                      {!autoExecute && (
                        <span className="mt-2 block text-[10px] tracking-[0.15em] uppercase text-[#B8960C]">
                          Selected
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAutoExecute(true)}
                      className={cn(
                        'flex-1 border px-5 py-4 text-left transition-colors',
                        autoExecute
                          ? 'border-[#0A1628] bg-[#F8F9FA]'
                          : 'border-[#E2E8F0] hover:border-[#0A1628]/30',
                      )}
                    >
                      <p className="text-sm font-medium text-[#0A1628]">Auto Execute</p>
                      <p className="mt-0.5 text-[11px] text-[#4A5568]">
                        AI executes approved trades automatically
                      </p>
                      {autoExecute && (
                        <span className="mt-2 block text-[10px] tracking-[0.15em] uppercase text-[#B8960C]">
                          Selected
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Max trade size */}
                <div>
                  <p className="mb-1 text-[11px] tracking-[0.12em] uppercase text-[#0A1628]/40">
                    Maximum Trade Size
                  </p>
                  <p className="mb-3 text-sm text-[#4A5568]">
                    The maximum USD value for any single trade placed by the AI agent.
                  </p>
                  <div className="flex items-center gap-0">
                    <span className="flex h-10 items-center border border-r-0 border-[#E2E8F0] bg-[#F8F9FA] px-3 text-sm text-[#4A5568]">
                      $
                    </span>
                    <input
                      type="number"
                      min={100}
                      max={1000000}
                      step={100}
                      value={maxTradeValue}
                      onChange={(e) => setMaxTradeValue(Number(e.target.value))}
                      className="h-10 w-40 border border-[#E2E8F0] px-3 font-mono tabular-nums text-sm text-[#0A1628] outline-none focus:border-[#0A1628] transition-colors"
                    />
                    <span className="flex h-10 items-center border border-l-0 border-[#E2E8F0] bg-[#F8F9FA] px-3 text-sm text-[#4A5568]">
                      per trade
                    </span>
                  </div>
                </div>

                {/* Auto execute warning */}
                {autoExecute && (
                  <div className="border border-[#C41E3A]/20 bg-[#C41E3A]/5 px-4 py-3 text-sm text-[#C41E3A]">
                    Auto Execute will place real trades on your behalf. Trades are subject to risk
                    limits and confidence thresholds.
                  </div>
                )}

                {/* Save */}
                <div className="flex items-center gap-4 pt-2">
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="bg-[#0A1628] text-white text-[11px] tracking-[0.2em] uppercase h-10 px-6 hover:bg-[#1a2f4a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingSettings ? 'Saving' : 'Save Settings'}
                  </button>
                  {saveMsg && (
                    <p
                      className={cn(
                        'text-xs',
                        saveMsg.type === 'success' ? 'text-[#166534]' : 'text-[#C41E3A]',
                      )}
                    >
                      {saveMsg.text}
                    </p>
                  )}
                </div>
              </form>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
