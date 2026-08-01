/**
 * SEC EDGAR 13F-HR fetcher and parser.
 *
 * Rate limit: SEC requires max 10 req/sec; we use 110ms between requests.
 * User-Agent: required by SEC — must include contact info.
 */

const RATE_MS    = 110;
const USER_AGENT = 'Tavola/1.0 gageevans792@gmail.com';
const SEC_DATA   = 'https://data.sec.gov';
const SEC_ARCH   = 'https://www.sec.gov/Archives/edgar/data';

// ── Curated fund list ─────────────────────────────────────────────────────────

export const TRACKED_FUNDS: Record<string, string> = {
  '1067983':  'Berkshire Hathaway',
  '1350694':  'Bridgewater Associates',
  '1037389':  'Renaissance Technologies',
  '1167483':  'Tiger Global',
  '886346':   'Baupost Group',
  '802667':   'Appaloosa Management',
  '1336528':  'Pershing Square',
  '1040273':  'Third Point',
  '1536411':  'Duquesne Family Office',
  '1336264':  'Coatue Management',
  '1061165':  'Lone Pine Capital',
  '1103804':  'Viking Global',
  '1079114':  'Greenlight Capital',
  '813672':   'Icahn Associates',
  '1655075':  'Scion Asset Management',
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HoldingEntry {
  ticker:   string;
  name:     string;
  shares:   number;
  valueUsd: number; // converted from thousands
}

export interface FundFilingResult {
  fundName:  string;
  fundCik:   string;
  quarter:   string;   // '2026-Q1'
  filedAt:   string;   // 'YYYY-MM-DD'
  holdings:  HoldingEntry[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function secGet(url: string, asText = false): Promise<unknown> {
  await sleep(RATE_MS);
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: asText ? 'text/html' : 'application/json' },
  });
  if (!res.ok) throw new Error(`SEC ${res.status} ${url}`);
  return asText ? res.text() : res.json();
}

/** Convert '2024-03-31' → '2024-Q1' */
function periodToQuarter(period: string): string {
  const parts = period.split('-');
  const year  = parts[0];
  const month = parseInt(parts[1] ?? '3', 10);
  return `${year}-Q${Math.ceil(month / 3)}`;
}

/** Normalize company name for matching: uppercase, strip common suffixes + punctuation */
function normalizeName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/\b(INC|CORP|LTD|LLC|CO|PLC|NV|SA|AG|SE|CLASS\s+[A-Z]|COM|SHS|ETF|FUND|TRUST|HLDGS|HOLDINGS|GROUP|INTL|INTERNATIONAL)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Build a name→ticker map from SEC's company_tickers_exchange.json */
async function buildNameTickerMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    await sleep(RATE_MS);
    const res = await fetch('https://www.sec.gov/files/company_tickers_exchange.json', {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return map;
    const data = await res.json() as { fields: string[]; data: [number, string, string, string][] };
    for (const [, companyName, ticker] of data.data) {
      if (!ticker || !companyName) continue;
      const normalized = normalizeName(companyName);
      if (normalized && !map.has(normalized)) {
        map.set(normalized, ticker.toUpperCase());
      }
    }
  } catch {
    // non-fatal — fall back to name-only entries
  }
  return map;
}

function resolveTicker(issuerName: string, nameMap: Map<string, string>): string {
  const normalized = normalizeName(issuerName);
  if (nameMap.has(normalized)) return nameMap.get(normalized)!;
  // progressively strip trailing word until match or empty
  const words = normalized.split(' ');
  for (let i = words.length - 1; i > 0; i--) {
    const shorter = words.slice(0, i).join(' ');
    if (nameMap.has(shorter)) return nameMap.get(shorter)!;
  }
  return '';
}

/** Parse 13F infotable XML with regex (no external XML parser needed) */
function parseInfoTable(xml: string, nameMap: Map<string, string>): HoldingEntry[] {
  const entries: HoldingEntry[] = [];
  // Match each <infoTable> block (case-insensitive tag variants)
  const rows = xml.match(/<infoTable>[\s\S]*?<\/infoTable>/gi) ?? [];

  for (const row of rows) {
    const name   = (row.match(/<nameOfIssuer>(.*?)<\/nameOfIssuer>/i)?.[1] ?? '').trim();
    const sharesStr = row.match(/<sshPrnamt>(.*?)<\/sshPrnamt>/i)?.[1] ?? '0';
    const valueStr  = row.match(/<value>(.*?)<\/value>/i)?.[1] ?? '0';
    const type   = row.match(/<sshPrnamtType>(.*?)<\/sshPrnamtType>/i)?.[1] ?? 'SH';

    if (type !== 'SH') continue; // skip options/warrants
    if (!name) continue;

    const ticker   = resolveTicker(name, nameMap);
    if (!ticker) continue; // skip unmappable issuers

    const shares   = parseInt(sharesStr.replace(/[^0-9]/g, ''), 10) || 0;
    const valueUsd = (parseInt(valueStr.replace(/[^0-9]/g, ''), 10) || 0) * 1000;

    if (shares === 0) continue;

    entries.push({ ticker, name, shares, valueUsd });
  }

  return entries;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Fetch the most recent 13F-HR filing for a fund by CIK.
 * Returns null if no 13F-HR filing is found or on any error.
 */
export async function fetchFundHoldings(
  cik: string,
  fundName: string,
  nameMap: Map<string, string>,
): Promise<FundFilingResult | null> {
  try {
    const paddedCik = cik.padStart(10, '0');

    // 1. Get fund submissions (filing list)
    const submissions = await secGet(`${SEC_DATA}/submissions/CIK${paddedCik}.json`) as {
      filings: {
        recent: {
          form:            string[];
          filingDate:      string[];
          accessionNumber: string[];
          periodOfReport:  string[];
          primaryDocument: string[];
        };
      };
    };

    const recent = submissions.filings.recent;
    const idx    = recent.form.findIndex((f) => f === '13F-HR');
    if (idx === -1) return null;

    const accession = recent.accessionNumber[idx]; // '0001067983-24-000123'
    const filedAt   = recent.filingDate[idx];
    const period    = recent.periodOfReport[idx];  // '2024-12-31'
    const quarter   = periodToQuarter(period);

    // 2. Get filing document index
    const cikNumeric     = cik.replace(/^0+/, '');
    const accNoDashes    = accession.replace(/-/g, '');
    const indexUrl       = `${SEC_DATA}/Archives/edgar/data/${cikNumeric}/${accNoDashes}/${accNoDashes}-index.json`;

    const index = await secGet(indexUrl) as {
      directory?: { item?: Array<{ type: string; name: string }> };
    };

    const docs = index.directory?.item ?? [];

    // Find the infotable XML — prioritize 'INFORMATION TABLE' type
    const infoDoc =
      docs.find((d) => d.type?.toUpperCase().includes('INFORMATION TABLE')) ??
      docs.find((d) => d.name?.toLowerCase().includes('infotable') && d.name?.endsWith('.xml')) ??
      docs.find((d) => d.name?.endsWith('.xml') && !d.name?.toLowerCase().includes('primary'));

    if (!infoDoc?.name) return null;

    // 3. Fetch XML text
    const xmlUrl = `${SEC_ARCH}/${cikNumeric}/${accNoDashes}/${infoDoc.name}`;
    const xml    = await secGet(xmlUrl, true) as string;

    // 4. Parse holdings
    const holdings = parseInfoTable(xml, nameMap);

    return { fundName, fundCik: cik, quarter, filedAt, holdings };
  } catch (err) {
    console.warn(`[13f] Failed to fetch ${fundName} (CIK ${cik}):`, err instanceof Error ? err.message : err);
    return null;
  }
}

/** Build the shared name→ticker map. Call once per sync run. */
export { buildNameTickerMap };
