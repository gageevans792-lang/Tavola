import type { SyncedHolding } from '@/lib/alpaca/sync';

const FOUNDER_USER_ID    = (process.env.FOUNDER_USER_ID ?? '').trim();
const FOUNDER_USER_EMAIL = (process.env.FOUNDER_EMAIL   ?? '').trim().toLowerCase();

export function isFounder(userId: string, email?: string | null): boolean {
  if (FOUNDER_USER_ID && userId === FOUNDER_USER_ID) return true;
  if (FOUNDER_USER_EMAIL && email && email.trim().toLowerCase() === FOUNDER_USER_EMAIL) return true;
  return false;
}

export function newUserPortfolio() {
  const BASELINE = 100_000;
  const today = new Date();
  const chart = Array.from({ length: 90 }, (_, i) => {
    const d = new Date(today.getTime() - (89 - i) * 86_400_000);
    return { date: d.toISOString().slice(0, 10), value: BASELINE };
  });
  return {
    equity:            BASELINE,
    last_equity:       BASELINE,
    cash:              BASELINE,
    buying_power:      BASELINE,
    long_market_value: 0,
    portfolio_value:   BASELINE,
    day_pl:            0,
    day_pl_pct:        0,
    total_return:      0,
    total_return_pct:  0,
    chart,
    allocation:        [] as { name: string; value: number; color: string }[],
    holdings:          [] as SyncedHolding[],
    positions_synced:  0,
  };
}
