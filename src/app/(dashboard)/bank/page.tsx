'use client';

import { useEffect, useState, useCallback } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import type { BankAccount } from '@/app/api/bank/account/route';
import type { RecurringDeposit } from '@/app/api/bank/schedule/route';
import type { Transfer } from '@/app/api/bank/transfers/route';

// ── Types ─────────────────────────────────────────────────────────────────────

type Frequency = 'weekly' | 'biweekly' | 'monthly';
type AccountType = 'checking' | 'savings';

const PRESET_AMOUNTS = [500, 1000, 2500, 5000] as const;

const BANKS = [
  'Chase',
  'Bank of America',
  'Wells Fargo',
  'Citibank',
  'US Bank',
  'Other',
] as const;

const FREQUENCIES: { label: string; value: Frequency }[] = [
  { label: 'Weekly',    value: 'weekly'   },
  { label: 'Bi-weekly', value: 'biweekly' },
  { label: 'Monthly',   value: 'monthly'  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day:   'numeric',
    year:  'numeric',
  });
}

function formatAmount(n: number): string {
  return '$' + n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function statusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'completed': return 'text-[#166534]';
    case 'scheduled': return 'text-[#B8960C]';
    case 'failed':    return 'text-[#991b1b]';
    default:          return 'text-[#4A5568]';
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] tracking-[0.15em] uppercase text-[#B8960C] mb-3">
      {children}
    </p>
  );
}

// ── Disconnected State ────────────────────────────────────────────────────────

interface ConnectFlowProps {
  onConnected: (account: BankAccount) => void;
}

function ConnectFlow({ onConnected }: ConnectFlowProps) {
  const [selectedBank, setSelectedBank]       = useState<string>('');
  const [accountType, setAccountType]         = useState<AccountType>('checking');
  const [lastFour, setLastFour]               = useState('');
  const [routingNumber, setRoutingNumber]     = useState('');
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState<string | null>(null);

  async function handleConnect() {
    if (!selectedBank) { setError('Please select a bank.'); return; }
    if (!/^\d{4}$/.test(lastFour)) { setError('Please enter exactly 4 digits for your account number.'); return; }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/bank/account', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          bank_name:      selectedBank,
          account_type:   accountType,
          last_four:      lastFour,
          routing_number: routingNumber || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Connection failed');
      onConnected(json.account as BankAccount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect account.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 overflow-y-auto bg-[#F8F9FA] p-4 sm:p-6">
      <div className="mx-auto max-w-xl">

        {/* Hero */}
        <div className="mb-10 text-center">
          <h2 className="font-serif text-4xl font-light text-[#0A1628] mb-3">
            Connect Your Bank
          </h2>
          <p className="text-sm text-[#4A5568] leading-relaxed">
            Link your bank account to enable automatic deposits and seamless investing.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#991b1b]">
            {error}
          </div>
        )}

        {/* Bank selector */}
        <div className="mb-6">
          <SectionLabel>Select Your Bank</SectionLabel>
          <div className="grid grid-cols-3 gap-2">
            {BANKS.map((bank) => (
              <button
                key={bank}
                type="button"
                onClick={() => setSelectedBank(bank)}
                className={`
                  border px-3 py-4 text-sm font-medium text-[#0A1628] transition-colors text-center
                  ${selectedBank === bank
                    ? 'border-[#B8960C] bg-[#FFFBEB]'
                    : 'border-[#E2E8F0] bg-white hover:border-[#0A1628]'
                  }
                `}
              >
                {bank}
              </button>
            ))}
          </div>
        </div>

        {/* Account type */}
        <div className="mb-6">
          <SectionLabel>Account Type</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {(['checking', 'savings'] as AccountType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setAccountType(type)}
                className={`
                  border px-4 py-4 text-sm font-medium capitalize transition-colors
                  ${accountType === type
                    ? 'border-[#B8960C] bg-[#FFFBEB] text-[#0A1628]'
                    : 'border-[#E2E8F0] bg-white text-[#0A1628] hover:border-[#0A1628]'
                  }
                `}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Account details */}
        <div className="mb-6 space-y-3">
          <SectionLabel>Account Details</SectionLabel>
          <div>
            <label className="block text-[11px] tracking-[0.08em] uppercase text-[#4A5568] mb-1.5">
              Last 4 digits of account number
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={lastFour}
              onChange={(e) => setLastFour(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="4521"
              className="w-full border border-[#E2E8F0] bg-white px-3 py-2.5 font-mono text-sm text-[#0A1628] placeholder:text-[#94A3B8] focus:border-[#0A1628] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] tracking-[0.08em] uppercase text-[#4A5568] mb-1.5">
              Routing number <span className="normal-case text-[#94A3B8]">(optional)</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={9}
              value={routingNumber}
              onChange={(e) => setRoutingNumber(e.target.value.replace(/\D/g, '').slice(0, 9))}
              placeholder="021000021"
              className="w-full border border-[#E2E8F0] bg-white px-3 py-2.5 font-mono text-sm text-[#0A1628] placeholder:text-[#94A3B8] focus:border-[#0A1628] focus:outline-none"
            />
          </div>
        </div>

        {/* Connect button */}
        <button
          type="button"
          onClick={handleConnect}
          disabled={loading}
          className="w-full bg-[#0A1628] px-6 py-3.5 text-sm font-medium tracking-[0.06em] uppercase text-white transition-opacity disabled:opacity-50 hover:opacity-90"
        >
          {loading ? 'Connecting...' : 'Connect Account'}
        </button>

        {/* Security note */}
        <p className="mt-4 text-center text-[11px] text-[#4A5568]">
          256-bit encryption. We never store your full account number.
        </p>

      </div>
    </main>
  );
}

// ── Connected State ───────────────────────────────────────────────────────────

interface ConnectedViewProps {
  account:    BankAccount;
  schedule:   RecurringDeposit | null;
  transfers:  Transfer[];
  onDisconnected: () => void;
  onScheduleSaved: (s: RecurringDeposit) => void;
  loadMoreTransfers: () => void;
  hasMoreTransfers: boolean;
}

function ConnectedView({
  account,
  schedule,
  transfers,
  onDisconnected,
  onScheduleSaved,
  loadMoreTransfers,
  hasMoreTransfers,
}: ConnectedViewProps) {
  // Schedule form state
  const [scheduleActive, setScheduleActive]   = useState(schedule?.is_active ?? false);
  const [amount, setAmount]                   = useState<number>(schedule?.amount ?? 500);
  const [customAmount, setCustomAmount]       = useState<string>('');
  const [isCustom, setIsCustom]               = useState(
    schedule ? !PRESET_AMOUNTS.includes(schedule.amount as typeof PRESET_AMOUNTS[number]) : false,
  );
  const [frequency, setFrequency]             = useState<Frequency>(schedule?.frequency ?? 'monthly');
  const [autoInvest, setAutoInvest]           = useState(schedule?.auto_invest ?? true);
  const [saving, setSaving]                   = useState(false);
  const [saveError, setSaveError]             = useState<string | null>(null);

  // Disconnect confirm state
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, setDisconnecting]         = useState(false);

  const effectiveAmount = isCustom ? parseFloat(customAmount || '0') : amount;

  async function handleSaveSchedule() {
    if (isCustom && (isNaN(effectiveAmount) || effectiveAmount < 50 || effectiveAmount > 50_000)) {
      setSaveError('Amount must be between $50 and $50,000.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/bank/schedule', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ amount: effectiveAmount, frequency, auto_invest: autoInvest }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to save');
      onScheduleSaved(json.schedule as RecurringDeposit);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save schedule.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await fetch('/api/bank/account', { method: 'DELETE' });
      onDisconnected();
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <main className="flex-1 overflow-y-auto bg-[#F8F9FA] p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-6">

        {/* AI AutoPilot banner */}
        {autoInvest && scheduleActive && (
          <div className="flex items-start gap-3 border-l-4 border-[#B8960C] bg-[#FFFBEB] px-5 py-4">
            <div>
              <p className="text-[10px] tracking-[0.15em] uppercase text-[#B8960C] mb-0.5">AutoPilot</p>
              <p className="text-sm font-medium text-[#0A1628]">
                AI AutoPilot Active — Deposits automatically invested by your AI agent
              </p>
            </div>
          </div>
        )}

        {/* Connected account card */}
        <div className="border border-[#E2E8F0] bg-white">
          <div className="border-l-4 border-[#B8960C] px-5 py-4 flex items-start justify-between gap-4">
            <div>
              <SectionLabel>Connected Account</SectionLabel>
              <p className="font-medium text-[#0A1628]">
                {account.bank_name} {account.account_type.charAt(0).toUpperCase() + account.account_type.slice(1)} &bull;&bull;&bull;&bull; {account.last_four}
              </p>
              <p className="mt-1 text-xs text-[#4A5568]">
                Connected {formatDate(account.connected_at)}
              </p>
            </div>

            <div className="shrink-0">
              {!confirmDisconnect ? (
                <button
                  type="button"
                  onClick={() => setConfirmDisconnect(true)}
                  className="text-xs text-[#991b1b] hover:underline"
                >
                  Remove Account
                </button>
              ) : (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                  <span className="text-xs text-[#0A1628]">Are you sure?</span>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setConfirmDisconnect(false)}
                      className="text-xs text-[#4A5568] hover:underline"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      disabled={disconnecting}
                      className="text-xs text-[#991b1b] hover:underline disabled:opacity-50"
                    >
                      {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recurring deposits card */}
        <div className="border border-[#E2E8F0] bg-white px-5 py-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <SectionLabel>Automatic Deposits</SectionLabel>
              <p className="text-base font-medium text-[#0A1628]">Recurring Deposit Schedule</p>
            </div>
            {/* Toggle */}
            <button
              type="button"
              onClick={() => setScheduleActive((v) => !v)}
              className={`
                relative h-6 w-11 shrink-0 transition-colors
                ${scheduleActive ? 'bg-[#0A1628]' : 'bg-[#E2E8F0]'}
              `}
              aria-label={scheduleActive ? 'Disable recurring deposits' : 'Enable recurring deposits'}
            >
              <span
                className={`
                  absolute top-1 h-4 w-4 bg-white transition-transform
                  ${scheduleActive ? 'translate-x-6' : 'translate-x-1'}
                `}
              />
            </button>
          </div>

          {scheduleActive && (
            <div className="space-y-5">

              {/* Amount presets */}
              <div>
                <label className="block text-[11px] tracking-[0.08em] uppercase text-[#4A5568] mb-2">
                  Amount
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_AMOUNTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => { setAmount(p); setIsCustom(false); }}
                      className={`
                        border px-4 py-2 font-mono text-sm transition-colors
                        ${!isCustom && amount === p
                          ? 'border-[#0A1628] bg-[#0A1628] text-white'
                          : 'border-[#E2E8F0] bg-white text-[#0A1628] hover:border-[#0A1628]'
                        }
                      `}
                    >
                      {p >= 1000 ? `$${p / 1000}k` : `$${p}`}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setIsCustom(true)}
                    className={`
                      border px-4 py-2 text-sm transition-colors
                      ${isCustom
                        ? 'border-[#0A1628] bg-[#0A1628] text-white'
                        : 'border-[#E2E8F0] bg-white text-[#0A1628] hover:border-[#0A1628]'
                      }
                    `}
                  >
                    Custom
                  </button>
                </div>
                {isCustom && (
                  <div className="mt-2">
                    <input
                      type="number"
                      min={50}
                      max={50000}
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      placeholder="Enter amount"
                      className="w-full sm:w-40 border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-sm text-[#0A1628] focus:border-[#0A1628] focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Frequency */}
              <div>
                <label className="block text-[11px] tracking-[0.08em] uppercase text-[#4A5568] mb-2">
                  Frequency
                </label>
                <div className="flex flex-wrap gap-2">
                  {FREQUENCIES.map(({ label, value }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFrequency(value)}
                      className={`
                        border px-4 py-2 text-sm transition-colors
                        ${frequency === value
                          ? 'border-[#0A1628] bg-[#0A1628] text-white'
                          : 'border-[#E2E8F0] bg-white text-[#0A1628] hover:border-[#0A1628]'
                        }
                      `}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Auto-Invest toggle */}
              <div className="flex items-center justify-between border border-[#E2E8F0] px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-[#0A1628]">AI Auto-Invest</p>
                  <p className="text-xs text-[#4A5568]">AI immediately invests each deposit</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoInvest((v) => !v)}
                  className={`
                    relative h-6 w-11 shrink-0 transition-colors
                    ${autoInvest ? 'bg-[#B8960C]' : 'bg-[#E2E8F0]'}
                  `}
                  aria-label={autoInvest ? 'Disable AI auto-invest' : 'Enable AI auto-invest'}
                >
                  <span
                    className={`
                      absolute top-1 h-4 w-4 bg-white transition-transform
                      ${autoInvest ? 'translate-x-6' : 'translate-x-1'}
                    `}
                  />
                </button>
              </div>

              {/* Next deposit */}
              {schedule?.next_deposit_at && (
                <p className="text-xs text-[#4A5568]">
                  Next deposit:{' '}
                  <span className="font-mono text-[#0A1628]">
                    {formatDate(schedule.next_deposit_at)}
                  </span>
                </p>
              )}

              {saveError && (
                <div className="border border-red-200 bg-red-50 px-3 py-2 text-xs text-[#991b1b]">
                  {saveError}
                </div>
              )}

              <button
                type="button"
                onClick={handleSaveSchedule}
                disabled={saving}
                className="bg-[#0A1628] px-6 py-2.5 text-sm font-medium tracking-[0.06em] uppercase text-white transition-opacity disabled:opacity-50 hover:opacity-90"
              >
                {saving ? 'Saving...' : 'Save Schedule'}
              </button>

            </div>
          )}
        </div>

        {/* Transfer history */}
        <div className="border border-[#E2E8F0] bg-white">
          <div className="border-b border-[#E2E8F0] px-5 py-4">
            <SectionLabel>Transfer History</SectionLabel>
          </div>

          {transfers.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-[#4A5568]">No transfers yet.</p>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-[#E2E8F0] px-5 py-2.5 bg-[#F8F9FA]">
                <span className="text-[10px] tracking-[0.12em] uppercase text-[#4A5568]">Date</span>
                <span className="text-[10px] tracking-[0.12em] uppercase text-[#4A5568]">Type</span>
                <span className="text-[10px] tracking-[0.12em] uppercase text-[#4A5568] text-right">Amount</span>
                <span className="text-[10px] tracking-[0.12em] uppercase text-[#4A5568] text-right">Status</span>
              </div>

              {transfers.map((t) => (
                <div
                  key={t.id}
                  className="grid grid-cols-2 sm:grid-cols-4 items-center border-b border-[#E2E8F0] px-5 py-3 last:border-b-0 hover:bg-[#F8F9FA] transition-colors"
                >
                  <span className="text-xs text-[#4A5568]">{formatDate(t.created_at)}</span>
                  <span className="text-xs capitalize text-[#0A1628]">{t.type}</span>
                  <span className="font-mono text-sm text-[#0A1628] sm:text-right">
                    {formatAmount(t.amount)}
                  </span>
                  <span className={`text-xs capitalize sm:text-right ${statusColor(t.status)}`}>
                    {t.status}
                  </span>
                </div>
              ))}

              {hasMoreTransfers && (
                <div className="px-5 py-4 text-center">
                  <button
                    type="button"
                    onClick={loadMoreTransfers}
                    className="border border-[#E2E8F0] px-6 py-2 text-xs text-[#4A5568] hover:border-[#0A1628] hover:text-[#0A1628] transition-colors"
                  >
                    Load more
                  </button>
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </main>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BankPage() {
  const [account,   setAccount]   = useState<BankAccount | null>(null);
  const [schedule,  setSchedule]  = useState<RecurringDeposit | null>(null);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [hasMore,   setHasMore]   = useState(false);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [acctRes, schedRes, xferRes] = await Promise.all([
        fetch('/api/bank/account'),
        fetch('/api/bank/schedule'),
        fetch('/api/bank/transfers'),
      ]);
      const [acctJson, schedJson, xferJson] = await Promise.all([
        acctRes.json(),
        schedRes.json(),
        xferRes.json(),
      ]);
      setAccount(acctJson.account   ?? null);
      setSchedule(schedJson.schedule ?? null);

      const fetched: Transfer[] = xferJson.transfers ?? [];
      setTransfers(fetched);
      setHasMore(fetched.length >= 20);
    } catch (err) {
      console.error('[bank page] load error:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadInitialData(); }, [loadInitialData]);

  async function loadMoreTransfers() {
    try {
      const res  = await fetch(`/api/bank/transfers`);
      const json = await res.json();
      const more: Transfer[] = json.transfers ?? [];
      setTransfers((prev) => {
        const ids = new Set(prev.map((t) => t.id));
        return [...prev, ...more.filter((t) => !ids.has(t.id))];
      });
      setHasMore(more.length >= 20);
    } catch (err) {
      console.error('[bank page] load more error:', err);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title="Banking" />
        <main className="flex-1 overflow-y-auto bg-[#F8F9FA] p-4 sm:p-6">
          <div className="mx-auto max-w-3xl space-y-6">
            <div className="border border-[#E2E8F0] bg-white px-5 py-5">
              <div className="h-3 w-32 animate-pulse bg-[#E2E8F0] rounded mb-3" />
              <div className="h-5 w-64 animate-pulse bg-[#E2E8F0] rounded mb-2" />
              <div className="h-3 w-40 animate-pulse bg-[#E2E8F0] rounded" />
            </div>
            <div className="border border-[#E2E8F0] bg-white px-5 py-5 space-y-3">
              <div className="h-3 w-40 animate-pulse bg-[#E2E8F0] rounded" />
              <div className="h-8 w-full animate-pulse bg-[#E2E8F0] rounded" />
              <div className="h-8 w-3/4 animate-pulse bg-[#E2E8F0] rounded" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title="Banking" />
        <main className="flex-1 flex flex-col items-center justify-center bg-[#F8F9FA] gap-4">
          <p className="text-[13px] text-[#4A5568]">Unable to load banking data. Please try again.</p>
          <button
            onClick={loadInitialData}
            className="border border-[#0A1628] px-5 py-2.5 text-[12px] tracking-[0.1em] uppercase text-[#0A1628] hover:bg-[#0A1628] hover:text-white transition-colors"
          >
            Retry
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="Banking" />

      {account ? (
        <ConnectedView
          account={account}
          schedule={schedule}
          transfers={transfers}
          onDisconnected={() => {
            setAccount(null);
            setSchedule(null);
            setTransfers([]);
          }}
          onScheduleSaved={(s) => setSchedule(s)}
          loadMoreTransfers={loadMoreTransfers}
          hasMoreTransfers={hasMore}
        />
      ) : (
        <ConnectFlow onConnected={(a) => setAccount(a)} />
      )}
    </div>
  );
}
