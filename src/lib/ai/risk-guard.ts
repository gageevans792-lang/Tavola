import {
  AutoInvestConfig,
  TradeRecommendation,
  RejectedRecommendation,
} from '@/types';

export interface GuardContext {
  portfolioValue: number;
  availableCash: number;
  currentPositionValues: Record<string, number>; // symbol → current market_value
  latestPrices: Record<string, number>;          // symbol → current price
}

export interface GuardResult {
  approved: TradeRecommendation[];
  rejected: RejectedRecommendation[];
}

export function applyRiskGuard(
  recommendations: TradeRecommendation[],
  config: AutoInvestConfig,
  ctx: GuardContext,
): GuardResult {
  const approved: TradeRecommendation[] = [];
  const rejected: RejectedRecommendation[] = [];

  let cashReserved = 0;

  for (const rec of recommendations) {
    // Hold recommendations carry no execution — pass through for display only
    if (rec.action === 'hold') {
      approved.push(rec);
      continue;
    }

    const reject = (reason: string) =>
      rejected.push({ ...rec, rejection_reason: reason });

    // ── Confidence gate ────────────────────────────────────────────────────────
    if (rec.confidence < config.confidence_threshold) {
      reject(
        `Confidence ${rec.confidence} is below the ${config.confidence_threshold} threshold`,
      );
      continue;
    }

    // ── Qty sanity ─────────────────────────────────────────────────────────────
    if (rec.qty <= 0) {
      reject('Quantity must be ≥ 1');
      continue;
    }

    const price = ctx.latestPrices[rec.symbol];
    if (!price) {
      reject(`No current price available for ${rec.symbol}`);
      continue;
    }

    const tradeValue = rec.qty * price;
    rec.estimated_value = tradeValue;

    if (rec.action === 'buy') {
      // ── Max single-trade value ─────────────────────────────────────────────
      if (tradeValue > config.max_trade_value) {
        reject(
          `Trade value $${tradeValue.toFixed(0)} exceeds max $${config.max_trade_value} per trade`,
        );
        continue;
      }

      // ── Buying power ───────────────────────────────────────────────────────
      if (cashReserved + tradeValue > ctx.availableCash) {
        reject(
          `Insufficient buying power — need $${tradeValue.toFixed(0)}, $${(ctx.availableCash - cashReserved).toFixed(0)} remaining`,
        );
        continue;
      }

      // ── Position concentration ─────────────────────────────────────────────
      const currentValue = ctx.currentPositionValues[rec.symbol] ?? 0;
      const projectedValue = currentValue + tradeValue;
      const projectedPct = projectedValue / ctx.portfolioValue;

      if (projectedPct > config.max_position_pct) {
        reject(
          `Would create ${(projectedPct * 100).toFixed(1)}% concentration — max is ${(config.max_position_pct * 100).toFixed(0)}%`,
        );
        continue;
      }

      cashReserved += tradeValue;
    }

    if (rec.action === 'sell') {
      // ── Has position to sell ───────────────────────────────────────────────
      if (!ctx.currentPositionValues[rec.symbol]) {
        reject(`No existing position in ${rec.symbol} to sell`);
        continue;
      }
    }

    approved.push(rec);
  }

  return { approved, rejected };
}
