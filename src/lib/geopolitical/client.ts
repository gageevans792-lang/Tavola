export interface GeopoliticalEvent {
  id:               string;
  headline:         string;
  description:      string;
  source:           string;
  event_category:   string;
  ai_analysis:      string;
  affected_sectors: string[];
  rotation_hedges:  string[];
  confidence:       number;
  created_at:       string;
}

export function buildGeopoliticalPromptSection(events: GeopoliticalEvent[]): string {
  if (!events.length) return '';

  const lines = events.slice(0, 3).map((e, i) => {
    const sectors = e.affected_sectors.length ? e.affected_sectors.join(', ') : 'broad market';
    const hedges  = e.rotation_hedges.length  ? e.rotation_hedges.join(', ')  : 'none';
    return (
      `${i + 1}. [${e.confidence}% confidence] ${e.headline}\n` +
      `   Analysis: ${e.ai_analysis}\n` +
      `   Sectors affected: ${sectors}\n` +
      `   Rotation/hedges: ${hedges}`
    );
  }).join('\n\n');

  return `
LIVE GEOPOLITICAL & MARKET INTELLIGENCE (updated hourly)
=========================================================
${lines}

Apply these signals when making recommendations. High-confidence events should influence sector weights.`;
}
