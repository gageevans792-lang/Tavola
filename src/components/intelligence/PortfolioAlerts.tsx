'use client';

import type { MarketSignal, SignalType } from '@/app/api/market/signals/route';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PortfolioAlertsProps {
  signals: MarketSignal[];
}

// ── Alert signal types that require attention ─────────────────────────────────

const ACTIONABLE_SIGNALS = new Set<SignalType>([
  'take_profit',
  'cut_loss',
  'strong_buy',
  'strong_sell',
]);

// ── Config per signal type ────────────────────────────────────────────────────

interface AlertConfig {
  badge: string;
  badgeColor: string;
  borderColor: string;
  bgColor: string;
}

const ALERT_CONFIG: Record<string, AlertConfig> = {
  cut_loss: {
    badge: 'CUT LOSS',
    badgeColor: '#991b1b',
    borderColor: '#991b1b',
    bgColor: '#F8F9FA',
  },
  strong_sell: {
    badge: 'SELL SIGNAL',
    badgeColor: '#B8960C',
    borderColor: '#B8960C',
    bgColor: '#FFF7ED',
  },
  take_profit: {
    badge: 'TAKE PROFIT',
    badgeColor: '#166534',
    borderColor: '#166534',
    bgColor: '#F0FDF4',
  },
  strong_buy: {
    badge: 'BUY SIGNAL',
    badgeColor: '#0A1628',
    borderColor: '#0A1628',
    bgColor: '#EFF6FF',
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPrice(n: number): string {
  if (n === 0) return '–';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Alert Card ────────────────────────────────────────────────────────────────

function AlertCard({ signal }: { signal: MarketSignal }) {
  const cfg = ALERT_CONFIG[signal.signal] ?? ALERT_CONFIG['cut_loss'];

  return (
    <div
      className="flex items-start justify-between gap-4 px-5 py-4"
      style={{
        borderLeft: `3px solid ${cfg.borderColor}`,
        backgroundColor: cfg.bgColor,
      }}
    >
      {/* Left: ticker, badge, reasoning */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2.5">
          <span className="font-mono font-semibold text-sm text-[#0A1628]">
            {signal.ticker}
          </span>
          <span
            className="inline-block px-2 py-0.5 text-[10px] tracking-[0.08em] font-semibold uppercase text-white"
            style={{ backgroundColor: cfg.badgeColor }}
          >
            {cfg.badge}
          </span>
        </div>
        <p className="text-xs text-[#4A5568] line-clamp-1">{signal.reasoning}</p>
        <button
          className="text-[11px] font-medium tracking-[0.05em] hover:opacity-70 transition-opacity"
          style={{ color: cfg.borderColor }}
          type="button"
          onClick={() => window.location.href = '/holdings'}
        >
          Review Position &rarr;
        </button>
      </div>

      {/* Right: price and confidence */}
      <div className="text-right shrink-0 space-y-1">
        <p className="font-mono tabular-nums text-sm font-medium text-[#0A1628]">
          {fmtPrice(signal.price)}
        </p>
        <p className="text-[11px] text-[#4A5568] tabular-nums">
          Confidence {signal.confidence}%
        </p>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PortfolioAlerts({ signals }: PortfolioAlertsProps) {
  // Filter to held positions with actionable signals
  const alerts = signals.filter(
    (s) => s.is_held && ACTIONABLE_SIGNALS.has(s.signal),
  );

  if (alerts.length === 0) return null;

  return (
    <div className="border border-[#E2E8F0] bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
        <span className="text-[10px] tracking-[0.15em] uppercase text-[#B8960C] font-medium">
          Portfolio Alerts
        </span>
        <span className="text-[11px] text-[#4A5568]">
          {alerts.length} position{alerts.length === 1 ? '' : 's'}{' '}
          {alerts.length === 1 ? 'requires' : 'require'} attention
        </span>
      </div>

      {/* Alert cards — no gap between them */}
      <div className="divide-y divide-[#E2E8F0]">
        {alerts.map((sig) => (
          <AlertCard key={sig.ticker} signal={sig} />
        ))}
      </div>
    </div>
  );
}
