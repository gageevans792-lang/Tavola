'use client';

import { useCallback, useEffect, useState } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { cn } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';

interface HarvestOpportunity {
  id:                   string;
  ticker:               string;
  unrealized_loss:      number;
  potential_tax_savings: number;
  replacement_ticker:   string | null;
  wash_sale_safe_date:  string;
  status:               string;
}

interface TaxData {
  opportunities:         HarvestOpportunity[];
  ytd_realized_loss:     number;
  total_potential_savings: number;
}

interface TaxSettingsData {
  marginal_rate:     number;
  state_tax_enabled: boolean;
  state_tax_rate:    number;
}

const DEFAULT_SETTINGS: TaxSettingsData = {
  marginal_rate:     0.24,
  state_tax_enabled: false,
  state_tax_rate:    0.00,
};

function fmtUSD(n: number): string {
  return '$' + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtPct(n: number): string {
  return (n * 100).toFixed(1) + '%';
}

export default function TaxPage() {
  const [data,          setData]          = useState<TaxData | null>(null);
  const [settings,      setSettings]      = useState<TaxSettingsData>(DEFAULT_SETTINGS);
  const [loading,       setLoading]       = useState(true);
  const [scanning,      setScanning]      = useState(false);
  const [harvested,     setHarvested]     = useState<Set<string>>(new Set());
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [editingSettings, setEditingSettings] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [oppsRes, settingsRes] = await Promise.all([
        fetch('/api/tax/opportunities'),
        fetch('/api/tax/settings'),
      ]);
      if (oppsRes.ok) {
        const d = await oppsRes.json() as TaxData;
        setData(d);
      }
      if (settingsRes.ok) {
        const s = await settingsRes.json() as { settings: TaxSettingsData };
        if (s.settings) setSettings(s.settings);
      }
    } catch { /* non-fatal */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleScan() {
    setScanning(true);
    try {
      const res = await fetch('/api/tax/harvest-scan', { method: 'POST' });
      if (res.ok) await fetchData();
    } catch { /* non-fatal */ } finally {
      setScanning(false);
    }
  }

  async function handleHarvest(id: string) {
    setHarvested((prev) => new Set([...prev, id]));
    try {
      await fetch('/api/tax/opportunities', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id }),
      });
    } catch { /* non-fatal */ }
  }

  async function handleSaveSettings() {
    try {
      await fetch('/api/tax/settings', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(settings),
      });
      setSettingsSaved(true);
      setEditingSettings(false);
      await handleScan();
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch { /* non-fatal */ }
  }

  const opportunities = data?.opportunities ?? [];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="Tax Optimization" />
      <main className="flex-1 overflow-y-auto bg-[#F8F9FA]">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8 space-y-6">

          {/* Disclaimer */}
          <div className="border border-amber-200 bg-amber-50 px-4 py-4">
            <p className="text-[11px] font-medium text-amber-800 mb-1 tracking-[0.1em] uppercase">Important Disclaimer</p>
            <p className="text-[12px] text-amber-700 leading-relaxed">
              Tax guidance is informational only. Consult a qualified tax professional before acting.
              Wash-sale rules apply across all your accounts including IRAs, 401(k)s, and spousal accounts,
              which Tavola cannot see. Tax impact depends on your individual circumstances.
              This is not tax advice.
            </p>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white border border-[#E2E8F0] px-6 py-5">
              <p className="text-[10px] tracking-[0.18em] uppercase text-[#B8960C] mb-1">Potential Tax Savings</p>
              <p className="font-serif text-2xl font-light text-[#0A1628]">
                {loading ? '—' : fmtUSD(data?.total_potential_savings ?? 0)}
              </p>
              <p className="text-[11px] text-[#4A5568] mt-1">from {opportunities.length} open {opportunities.length === 1 ? 'opportunity' : 'opportunities'}</p>
            </div>
            <div className="bg-white border border-[#E2E8F0] px-6 py-5">
              <p className="text-[10px] tracking-[0.18em] uppercase text-[#4A5568] mb-1">YTD Realized Losses</p>
              <p className="font-serif text-2xl font-light text-[#0A1628]">
                {loading ? '—' : data && data.ytd_realized_loss < 0 ? fmtUSD(data.ytd_realized_loss) : '$0'}
              </p>
              <p className="text-[11px] text-[#4A5568] mt-1">banked for tax purposes</p>
            </div>
          </div>

          {/* Settings panel */}
          <div className="bg-white border border-[#E2E8F0]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
              <div>
                <p className="text-[10px] tracking-[0.18em] uppercase text-[#4A5568]">Tax Rate Settings</p>
                <p className="text-[12px] text-[#4A5568]/70 mt-0.5">Used to estimate potential savings</p>
              </div>
              <button
                onClick={() => setEditingSettings((v) => !v)}
                className="text-[11px] tracking-[0.1em] uppercase text-[#B8960C] hover:underline underline-offset-2"
              >
                {editingSettings ? 'Cancel' : 'Edit'}
              </button>
            </div>

            {editingSettings ? (
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-[11px] tracking-[0.1em] uppercase text-[#4A5568] mb-2">
                    Federal Marginal Rate
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={60}
                      step={1}
                      value={Math.round(settings.marginal_rate * 100)}
                      onChange={(e) => setSettings({ ...settings, marginal_rate: Number(e.target.value) / 100 })}
                      className="w-24 border border-[#E2E8F0] px-3 py-2 text-sm text-[#0A1628] outline-none focus:border-[#0A1628]"
                    />
                    <span className="text-sm text-[#4A5568]">%</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <label className="text-[11px] tracking-[0.1em] uppercase text-[#4A5568]">State Tax</label>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.state_tax_enabled}
                    onClick={() => setSettings({ ...settings, state_tax_enabled: !settings.state_tax_enabled })}
                    className={cn(
                      'relative inline-flex h-5 w-9 items-center transition-colors shrink-0 border border-[#E2E8F0]',
                      settings.state_tax_enabled ? 'bg-[#0A1628]' : 'bg-[#E2E8F0]',
                    )}
                  >
                    <span className={cn('inline-block h-3 w-3 bg-white transition-transform', settings.state_tax_enabled ? 'translate-x-5' : 'translate-x-1')} />
                  </button>
                  {settings.state_tax_enabled && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={25}
                        step={0.5}
                        value={(settings.state_tax_rate * 100).toFixed(1)}
                        onChange={(e) => setSettings({ ...settings, state_tax_rate: Number(e.target.value) / 100 })}
                        className="w-20 border border-[#E2E8F0] px-3 py-2 text-sm text-[#0A1628] outline-none focus:border-[#0A1628]"
                      />
                      <span className="text-sm text-[#4A5568]">%</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    onClick={handleSaveSettings}
                    className="bg-[#0A1628] text-white text-[11px] tracking-[0.2em] uppercase h-9 px-5 hover:bg-[#1a2f4a] transition-colors"
                  >
                    Save & Rescan
                  </button>
                  {settingsSaved && <span className="text-[12px] text-[#166534]">Saved</span>}
                </div>
              </div>
            ) : (
              <div className="px-6 py-4 flex items-center gap-6">
                <div>
                  <p className="text-[10px] text-[#4A5568]">Federal rate</p>
                  <p className="text-sm font-medium text-[#0A1628]">{fmtPct(settings.marginal_rate)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#4A5568]">State tax</p>
                  <p className="text-sm font-medium text-[#0A1628]">
                    {settings.state_tax_enabled ? fmtPct(settings.state_tax_rate) : 'Off'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Scan + opportunities */}
          <div className="bg-white border border-[#E2E8F0]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
              <p className="text-[10px] tracking-[0.18em] uppercase text-[#4A5568]">Harvest Opportunities</p>
              <button
                onClick={handleScan}
                disabled={scanning}
                className="flex items-center gap-2 text-[11px] tracking-[0.1em] uppercase text-[#0A1628] border border-[#E2E8F0] hover:border-[#0A1628] px-3 py-1.5 transition-colors disabled:opacity-40"
              >
                <RefreshCw className={cn('h-3 w-3', scanning && 'animate-spin')} />
                {scanning ? 'Scanning…' : 'Scan now'}
              </button>
            </div>

            {loading ? (
              <div className="px-6 py-10 space-y-3">
                {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse bg-[#F0F2F5]" />)}
              </div>
            ) : opportunities.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <p className="text-[10px] tracking-[0.2em] uppercase text-[#B8960C] mb-3">All Clear</p>
                <p className="font-serif text-[18px] font-light text-[#0A1628] mb-2">No harvest opportunities found.</p>
                <p className="text-[13px] text-[#4A5568]">Positions with unrealized losses greater than $500 will appear here.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#E2E8F0]">
                {opportunities.map((opp) => {
                  const isHarvested = harvested.has(opp.id);
                  return (
                    <div key={opp.id} className="px-6 py-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-mono text-sm font-bold text-[#0A1628] tracking-wide">{opp.ticker}</span>
                            {opp.replacement_ticker && (
                              <span className="text-[10px] text-[#4A5568]">
                                → {opp.replacement_ticker}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-[12px]">
                            <div>
                              <span className="text-[#4A5568]">Unrealized loss: </span>
                              <span className="text-[#991b1b] font-medium">{fmtUSD(opp.unrealized_loss)}</span>
                            </div>
                            <div>
                              <span className="text-[#4A5568]">Est. savings: </span>
                              <span className="text-[#166534] font-medium">{fmtUSD(opp.potential_tax_savings)}</span>
                            </div>
                            <div>
                              <span className="text-[#4A5568]">Safe to rebuy: </span>
                              <span className="text-[#0A1628]">{new Date(opp.wash_sale_safe_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            </div>
                          </div>
                          {opp.replacement_ticker && (
                            <p className="mt-2 text-[11px] text-[#4A5568]">
                              Sell {opp.ticker}, buy {opp.replacement_ticker} to maintain exposure. Wait until {new Date(opp.wash_sale_safe_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} to repurchase {opp.ticker}.
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleHarvest(opp.id)}
                          disabled={isHarvested}
                          className={cn(
                            'shrink-0 text-[10px] tracking-[0.15em] uppercase h-8 px-4 border transition-colors',
                            isHarvested
                              ? 'border-[#166534] text-[#166534] cursor-default'
                              : 'border-[#0A1628] text-[#0A1628] hover:bg-[#0A1628] hover:text-white',
                          )}
                        >
                          {isHarvested ? 'Logged' : 'Log Harvest'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Extended disclaimer */}
          <div className="border border-[#E2E8F0] bg-white px-6 py-5">
            <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#4A5568] mb-3">How Tax-Loss Harvesting Works</p>
            <div className="space-y-2 text-[12px] text-[#4A5568] leading-relaxed">
              <p>Selling a position at a loss realizes that loss, which can offset capital gains or up to $3,000 of ordinary income per year ($1,500 if married filing separately). Excess losses carry forward to future tax years.</p>
              <p><strong className="text-[#0A1628]">Wash-sale rule:</strong> You cannot buy a substantially identical security within 30 days before or after the sale. Violations disallow the deduction. Tavola cannot track your other accounts — apply wash-sale rules manually across all accounts including IRAs.</p>
              <p><strong className="text-[#0A1628]">Replacement securities:</strong> Correlated ETFs maintain market exposure while respecting wash-sale rules. These are suggestions only — consult a tax advisor.</p>
              <p className="text-[#991b1b]"><strong>This tool logs your intent. It does not place trades. You must execute sales manually through your brokerage and consult a qualified tax professional.</strong></p>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
