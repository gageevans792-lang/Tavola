import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAccount, getPositions } from '@/lib/alpaca/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PortfolioAnalytics {
  win_rate: number;
  best_performer: { symbol: string; unrealized_plpc: number } | null;
  worst_performer: { symbol: string; unrealized_plpc: number } | null;
  concentration_risk: 'low' | 'medium' | 'high';
  total_unrealized_pl: number;
  total_unrealized_plpc: number;
  position_count: number;
  sector_exposure: Record<string, number>;
}

// ── Sector mapping ────────────────────────────────────────────────────────────

const SECTOR_MAP: Record<string, string> = {
  NVDA: 'Technology',
  AMD:  'Technology',
  AAPL: 'Technology',
  MSFT: 'Technology',
  GOOGL:'Technology',
  META: 'Technology',
  NFLX: 'Technology',
  BABA: 'Technology',
  JPM:  'Financials',
  GS:   'Financials',
  BAC:  'Financials',
  V:    'Financials',
  MA:   'Financials',
  'BRK.B': 'Financials',
  JNJ:  'Healthcare',
  UNH:  'Healthcare',
  PFE:  'Healthcare',
  XOM:  'Energy',
  CVX:  'Energy',
  AMZN: 'Consumer Discretionary',
  TSLA: 'Consumer Discretionary',
  PG:   'Consumer',
};

function getSector(symbol: string): string {
  return SECTOR_MAP[symbol.toUpperCase()] ?? 'Other';
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const [account, positions] = await Promise.all([
      getAccount(),
      getPositions(),
    ]);

    const equity = parseFloat(account.equity);

    if (positions.length === 0) {
      return NextResponse.json({
        win_rate:              0,
        best_performer:        null,
        worst_performer:       null,
        concentration_risk:    'low' as const,
        total_unrealized_pl:   0,
        total_unrealized_plpc: 0,
        position_count:        0,
        sector_exposure:       {},
      } satisfies PortfolioAnalytics);
    }

    // ── Win rate ──────────────────────────────────────────────────────────────
    const winners  = positions.filter((p) => parseFloat(p.unrealized_pl) > 0);
    const win_rate = Math.round((winners.length / positions.length) * 100);

    // ── Best / worst performer ────────────────────────────────────────────────
    let bestPos  = positions[0];
    let worstPos = positions[0];

    for (const p of positions) {
      if (parseFloat(p.unrealized_plpc) > parseFloat(bestPos.unrealized_plpc)) {
        bestPos = p;
      }
      if (parseFloat(p.unrealized_plpc) < parseFloat(worstPos.unrealized_plpc)) {
        worstPos = p;
      }
    }

    const best_performer: PortfolioAnalytics['best_performer'] = {
      symbol:          bestPos.symbol,
      unrealized_plpc: parseFloat(bestPos.unrealized_plpc) * 100,
    };

    const worst_performer: PortfolioAnalytics['worst_performer'] =
      worstPos.symbol !== bestPos.symbol
        ? { symbol: worstPos.symbol, unrealized_plpc: parseFloat(worstPos.unrealized_plpc) * 100 }
        : null;

    // ── Concentration risk ────────────────────────────────────────────────────
    const maxValue = Math.max(...positions.map((p) => parseFloat(p.market_value)));
    const maxPct   = equity > 0 ? (maxValue / equity) * 100 : 0;

    const concentration_risk: PortfolioAnalytics['concentration_risk'] =
      maxPct > 30 ? 'high'   :
      maxPct > 15 ? 'medium' : 'low';

    // ── Total unrealized P&L ──────────────────────────────────────────────────
    const total_unrealized_pl = positions.reduce(
      (sum, p) => sum + parseFloat(p.unrealized_pl),
      0,
    );

    const total_unrealized_plpc = equity > 0 ? (total_unrealized_pl / equity) * 100 : 0;

    // ── Sector exposure ───────────────────────────────────────────────────────
    const sectorValues: Record<string, number> = {};

    for (const p of positions) {
      const sector = getSector(p.symbol);
      const value  = parseFloat(p.market_value);
      sectorValues[sector] = (sectorValues[sector] ?? 0) + value;
    }

    const investedValue = positions.reduce(
      (sum, p) => sum + parseFloat(p.market_value),
      0,
    );

    const sector_exposure: Record<string, number> = {};
    for (const [sector, value] of Object.entries(sectorValues)) {
      sector_exposure[sector] =
        investedValue > 0 ? Math.round((value / investedValue) * 100) : 0;
    }

    return NextResponse.json({
      win_rate,
      best_performer,
      worst_performer,
      concentration_risk,
      total_unrealized_pl,
      total_unrealized_plpc,
      position_count: positions.length,
      sector_exposure,
    } satisfies PortfolioAnalytics);

  } catch {
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
