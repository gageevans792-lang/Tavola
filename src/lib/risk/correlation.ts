import { getDailyBars } from '@/lib/alpaca/client';

export interface CorrelationPair {
  symbolA: string;
  symbolB: string;
  correlation: number;  // -1 to +1
  risk_level: 'low' | 'medium' | 'high';
}

export interface CorrelationMatrix {
  symbols: string[];
  pairs: CorrelationPair[];
  high_correlation_pairs: CorrelationPair[];
  generated_at: string;
}

/** Compute Pearson correlation between two return series */
function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 5) return 0;

  const xs = x.slice(0, n);
  const ys = y.slice(0, n);

  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;

  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num  += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const denom = Math.sqrt(denX * denY);
  return denom === 0 ? 0 : Math.round((num / denom) * 100) / 100;
}

/** Compute daily returns from an array of close prices */
function dailyReturns(closes: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] !== 0) {
      returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
  }
  return returns;
}

/**
 * Compute 90-day return correlation matrix for given symbols.
 * Returns pairs with correlation > 0.85 flagged as high concentration risk.
 *
 * getDailyBars(symbol, days) fetches N trading days of daily bars.
 * We request 90 days (calendar) → ~65 trading days.
 */
export async function computeCorrelationMatrix(symbols: string[]): Promise<CorrelationMatrix> {
  if (symbols.length < 2) {
    return { symbols, pairs: [], high_correlation_pairs: [], generated_at: new Date().toISOString() };
  }

  // Fetch ~90 calendar days (~65 trading days) of daily bars for all symbols in parallel
  const barResults = await Promise.allSettled(
    symbols.map(sym => getDailyBars(sym, 90)),
  );

  // Build returns map
  const returnsMap: Record<string, number[]> = {};
  symbols.forEach((sym, i) => {
    const res = barResults[i];
    if (res.status === 'fulfilled' && res.value.length >= 10) {
      const closes = res.value.map((b: { close: number }) => b.close);
      returnsMap[sym] = dailyReturns(closes);
    }
  });

  const validSymbols = Object.keys(returnsMap);
  const pairs: CorrelationPair[] = [];

  for (let i = 0; i < validSymbols.length; i++) {
    for (let j = i + 1; j < validSymbols.length; j++) {
      const symA = validSymbols[i];
      const symB = validSymbols[j];
      const corr = pearsonCorrelation(returnsMap[symA], returnsMap[symB]);
      const absCorr = Math.abs(corr);
      const risk_level: CorrelationPair['risk_level'] =
        absCorr >= 0.85 ? 'high' : absCorr >= 0.65 ? 'medium' : 'low';

      pairs.push({ symbolA: symA, symbolB: symB, correlation: corr, risk_level });
    }
  }

  pairs.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

  return {
    symbols: validSymbols,
    pairs,
    high_correlation_pairs: pairs.filter(p => p.risk_level === 'high'),
    generated_at: new Date().toISOString(),
  };
}

/** Format high-correlation pairs as a prompt section for AutoPilot */
export function buildCorrelationPromptSection(matrix: CorrelationMatrix): string {
  if (!matrix.high_correlation_pairs.length) return '';

  const lines = matrix.high_correlation_pairs.slice(0, 5).map(p =>
    `  ${p.symbolA} / ${p.symbolB}: ${(p.correlation * 100).toFixed(0)}% correlated (90d) — HIGH concentration risk`,
  );

  return `
CONCENTRATION RISK: HIGHLY CORRELATED POSITIONS
================================================
${lines.join('\n')}

If adding a new position, avoid symbols highly correlated with existing holdings.
Consider reducing one of each highly-correlated pair to improve diversification.`;
}
