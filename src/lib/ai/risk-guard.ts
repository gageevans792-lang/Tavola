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
  warnings: string[];
}

/** Hard cap: no single trade may exceed this fraction of portfolio value */
const MAX_TRADE_PORTFOLIO_PCT = 0.10;

/** Minimum notional value per trade */
const MIN_TRADE_NOTIONAL = 10;

/** Warn (do not reject) when position count would exceed this */
const MAX_POSITION_COUNT_WARN = 20;

export function applyRiskGuard(
  recommendations: TradeRecommendation[],
  config: AutoInvestConfig,
  ctx: GuardContext,
): GuardResult {
  const approved: TradeRecommendation[] = [];
  const rejected: RejectedRecommendation[] = [];
  const warnings: string[] = [];

  let cashReserved = 0;

  // Compute current distinct position count (symbols with a non-zero value)
  const existingPositionCount = Object.values(ctx.currentPositionValues).filter((v) => v > 0).length;

  // Track new symbols being bought (for position-count warning)
  const newPositions = new Set<string>();

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

    // ── Minimum trade value ────────────────────────────────────────────────────
    if (tradeValue < MIN_TRADE_NOTIONAL) {
      reject(
        `Trade notional $${tradeValue.toFixed(2)} is below the $${MIN_TRADE_NOTIONAL} minimum`,
      );
      continue;
    }

    // ── Hard cap: 10% of total portfolio value per trade ───────────────────────
    if (ctx.portfolioValue > 0) {
      const tradePct = tradeValue / ctx.portfolioValue;
      if (tradePct > MAX_TRADE_PORTFOLIO_PCT) {
        reject(
          `Trade value $${tradeValue.toFixed(0)} is ${(tradePct * 100).toFixed(1)}% of portfolio — hard cap is ${MAX_TRADE_PORTFOLIO_PCT * 100}%`,
        );
        continue;
      }
    }

    if (rec.action === 'buy') {
      // ── Max single-trade value (config-level) ──────────────────────────────
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
      if (ctx.portfolioValue > 0) {
        const currentValue   = ctx.currentPositionValues[rec.symbol] ?? 0;
        const projectedValue = currentValue + tradeValue;
        const projectedPct   = projectedValue / ctx.portfolioValue;

        if (projectedPct > config.max_position_pct) {
          reject(
            `Would create ${(projectedPct * 100).toFixed(1)}% concentration — max is ${(config.max_position_pct * 100).toFixed(0)}%`,
          );
          continue;
        }
      }

      cashReserved += tradeValue;

      // ── Position count warning ─────────────────────────────────────────────
      // Only flag if this is a brand-new position (not an add-on)
      const currentValue = ctx.currentPositionValues[rec.symbol] ?? 0;
      if (currentValue === 0) {
        newPositions.add(rec.symbol);
        const projectedCount = existingPositionCount + newPositions.size;
        if (projectedCount > MAX_POSITION_COUNT_WARN) {
          warnings.push(
            `Portfolio would have ${projectedCount} positions after buying ${rec.symbol} — consider diversification risk (warning threshold: ${MAX_POSITION_COUNT_WARN})`,
          );
        }
      }
    }

    if (rec.action === 'sell') {
      // ── Has position to sell ───────────────────────────────────────────────
      if (ctx.currentPositionValues[rec.symbol] === undefined) {
        reject(`No existing position in ${rec.symbol} to sell`);
        continue;
      }
    }

    approved.push(rec);
  }

  return { approved, rejected, warnings };
}
