// ── Feed manifest ─────────────────────────────────────────────────────────────

const RSS_FEEDS = [
  { url: 'https://feeds.reuters.com/reuters/businessNews',   source: 'REUTERS'        },
  { url: 'https://feeds.reuters.com/reuters/technologyNews', source: 'REUTERS'        },
  { url: 'https://www.federalreserve.gov/feeds/press_all.xml', source: 'FEDERAL RESERVE' },
  { url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',   source: 'WSJ MARKETS'    },
  { url: 'https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml', source: 'WSJ BUSINESS'   },
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RssItem {
  id:           string;
  title:        string;
  summary:      string;
  url:          string;
  published_at: string;
  source:       string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return (h >>> 0).toString(36);
}

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([\da-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function stripCdata(str: string): string {
  return str.replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, '$1').trim();
}

function extractTag(block: string, tag: string): string {
  // Matches both plain and CDATA content
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m  = block.match(re);
  if (!m) return '';
  return decodeEntities(stripCdata(m[1].trim()));
}

function extractLink(block: string): string {
  // 1. Plain <link>url</link>
  const plain = block.match(/<link>([^<]+)<\/link>/i);
  if (plain) return plain[1].trim();

  // 2. <link rel="alternate" href="…" /> or <link href="…"/>
  const attr = block.match(/<link[^>]+href=["']([^"']+)["']/i);
  if (attr) return attr[1].trim();

  // 3. <guid> (often the URL)
  const guid = block.match(/<guid[^>]*>([^<]+)<\/guid>/i);
  if (guid) {
    const val = guid[1].trim();
    if (val.startsWith('http')) return val;
  }

  return '';
}

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function parseItems(xml: string): Array<{ title: string; summary: string; link: string; pubDate: string }> {
  const items: Array<{ title: string; summary: string; link: string; pubDate: string }> = [];
  let pos = 0;
  while (true) {
    const start = xml.indexOf('<item>', pos);
    if (start === -1) break;
    const end = xml.indexOf('</item>', start);
    if (end === -1) break;
    const block = xml.slice(start + 6, end);
    pos = end + 7;

    const title   = extractTag(block, 'title');
    const desc    = extractTag(block, 'description') || extractTag(block, 'content:encoded');
    const link    = extractLink(block);
    const pubDate =
      extractTag(block, 'pubDate')    ||
      extractTag(block, 'dc:date')    ||
      extractTag(block, 'published')  ||
      extractTag(block, 'updated')    ||
      '';

    if (title && link) {
      items.push({ title, summary: stripHtml(desc).slice(0, 400), link, pubDate });
    }
  }
  return items;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchRSS(url: string, source: string): Promise<RssItem[]> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Tavola/1.0; +https://tavola.app)' },
      next:    { revalidate: 600 },  // cache 10 minutes
    });

    if (!res.ok) {
      console.warn(`[rss] ${source} ${url} returned ${res.status}`);
      return [];
    }

    const xml   = await res.text();
    const items = parseItems(xml).slice(0, 10);

    return items.map((item): RssItem => {
      let published_at: string;
      try {
        published_at = item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString();
        // Reject obviously invalid dates (future > 7 days)
        if (new Date(published_at).getTime() > Date.now() + 7 * 86_400_000) {
          published_at = new Date().toISOString();
        }
      } catch {
        published_at = new Date().toISOString();
      }

      return {
        id:           `rss-${simpleHash(item.link || item.title)}`,
        title:        item.title,
        summary:      item.summary,
        url:          item.link,
        published_at,
        source,
      };
    });
  } catch (err) {
    console.warn(`[rss] ${source} fetch error:`, err instanceof Error ? err.message : err);
    return [];
  }
}

export async function fetchAllRssFeeds(): Promise<RssItem[]> {
  const results = await Promise.allSettled(
    RSS_FEEDS.map(({ url, source }) => fetchRSS(url, source)),
  );
  return results
    .filter((r): r is PromiseFulfilledResult<RssItem[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value);
}
