import { createClient } from '@supabase/supabase-js';

// Correlated-but-not-substantially-identical ETF replacement pairs
export const REPLACEMENT_MAP: Record<string, string> = {
  VTI:  'ITOT',
  ITOT: 'VTI',
  VOO:  'SPLG',
  SPLG: 'VOO',
  SPY:  'IVV',
  IVV:  'SPY',
  QQQ:  'QQQM',
  QQQM: 'QQQ',
  SCHD: 'DGRO',
  DGRO: 'SCHD',
  VUG:  'SPYG',
  SPYG: 'VUG',
  VTV:  'SPYD',
  SPYD: 'VTV',
  BND:  'AGG',
  AGG:  'BND',
  GLD:  'IAU',
  IAU:  'GLD',
  XLK:  'IYW',
  IYW:  'XLK',
  XLF:  'VFH',
  VFH:  'XLF',
  XLV:  'VHT',
  VHT:  'XLV',
  XLE:  'VDE',
  VDE:  'XLE',
  XLI:  'VIS',
  VIS:  'XLI',
  XLP:  'VDC',
  VDC:  'XLP',
  XLU:  'IDU',
  IDU:  'XLU',
  IWM:  'VBR',
  VBR:  'IWM',
};

export interface HarvestOpportunity {
  ticker:               string;
  unrealized_loss:      number;
  potential_tax_savings: number;
  replacement_ticker:   string | null;
  wash_sale_safe_date:  string; // ISO date
}

/** Minimum unrealized loss to consider ($) */
const MIN_LOSS_THRESHOLD = 500;

/** Compute potential tax savings from loss at given combined rate */
function computeSavings(loss: number, marginalRate: number, stateRate: number): number {
  return Math.abs(loss) * (marginalRate + stateRate);
}

/** Add N days to today, return ISO date string (YYYY-MM-DD) */
function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Scan a user's positions for tax-loss harvesting opportunities.
 * Positions with unrealized_loss > $500 are ranked by potential tax savings.
 */
export async function computeHarvestOpportunities(
  userId: string,
  positions: Array<{
    symbol:           string;
    qty:              string;
    avg_entry_price:  string;
    current_price?:   number;
    unrealized_pl?:   string;
    unrealized_plpc?: string;
    market_value?:    string;
  }>,
  prices: Record<string, number>,
  marginalRate: number,
  stateTaxRate: number,
): Promise<HarvestOpportunity[]> {
  const opportunities: HarvestOpportunity[] = [];

  for (const pos of positions) {
    const qty        = parseFloat(pos.qty);
    const avgCost    = parseFloat(pos.avg_entry_price);
    const curPrice   = pos.current_price ?? prices[pos.symbol] ?? avgCost;

    const unrealizedLoss = qty * (curPrice - avgCost); // negative = loss

    if (unrealizedLoss >= -MIN_LOSS_THRESHOLD) continue; // not a meaningful loss

    const savings         = computeSavings(unrealizedLoss, marginalRate, stateTaxRate);
    const replacement     = REPLACEMENT_MAP[pos.symbol] ?? null;
    const washSafeDayDate = addDays(31); // 31-day buffer (wash sale is 30 days)

    opportunities.push({
      ticker:               pos.symbol,
      unrealized_loss:      unrealizedLoss,
      potential_tax_savings: savings,
      replacement_ticker:   replacement,
      wash_sale_safe_date:  washSafeDayDate,
    });
  }

  opportunities.sort((a, b) => b.potential_tax_savings - a.potential_tax_savings);
  return opportunities;
}

/**
 * Upsert harvest opportunities to DB for a given user.
 * Marks previously open opportunities for tickers no longer qualifying as expired.
 */
export async function saveHarvestOpportunities(
  userId: string,
  opportunities: HarvestOpportunity[],
): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Expire previously open opportunities
  await supabase
    .from('harvest_opportunities')
    .update({ status: 'expired' })
    .eq('user_id', userId)
    .eq('status', 'open')
    .not('ticker', 'in', `(${opportunities.map((o) => `"${o.ticker}"`).join(',')})`);

  if (opportunities.length === 0) return;

  const rows = opportunities.map((o) => ({
    user_id:               userId,
    ticker:                o.ticker,
    unrealized_loss:       o.unrealized_loss,
    potential_tax_savings: o.potential_tax_savings,
    replacement_ticker:    o.replacement_ticker,
    wash_sale_safe_date:   o.wash_sale_safe_date,
    status:                'open',
    created_at:            new Date().toISOString(),
  }));

  await supabase
    .from('harvest_opportunities')
    .upsert(rows, { onConflict: 'user_id,ticker' });
}

/** Fetch user tax settings from DB (with defaults). */
export async function getTaxSettings(userId: string): Promise<{
  marginal_rate: number;
  state_tax_enabled: boolean;
  state_tax_rate: number;
}> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data } = await supabase
    .from('tax_settings')
    .select('marginal_rate, state_tax_enabled, state_tax_rate')
    .eq('user_id', userId)
    .maybeSingle();

  return {
    marginal_rate:    data?.marginal_rate    ?? 0.24,
    state_tax_enabled: data?.state_tax_enabled ?? false,
    state_tax_rate:   data?.state_tax_rate   ?? 0.00,
  };
}
