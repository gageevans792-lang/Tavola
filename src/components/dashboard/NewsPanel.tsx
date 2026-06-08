'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Article, NewsResponse } from '@/app/api/market/news/route';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day:   'numeric',
      hour:  'numeric',
      minute:'2-digit',
    });
  } catch {
    return '';
  }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonArticle() {
  return (
    <div className="border-b border-[#E2E8F0] py-4 last:border-0">
      <div className="mb-1.5 flex justify-between">
        <div className="h-2.5 w-20 animate-pulse bg-[#E2E8F0]" />
        <div className="h-2.5 w-24 animate-pulse bg-[#E2E8F0]" />
      </div>
      <div className="mb-1.5 h-4 w-full animate-pulse bg-[#E2E8F0]" />
      <div className="h-4 w-4/5 animate-pulse bg-[#E2E8F0]" />
      <div className="mt-2 h-3 w-3/4 animate-pulse bg-[#E2E8F0]" />
    </div>
  );
}

// ── Article row ───────────────────────────────────────────────────────────────

interface ArticleRowProps {
  article:         Article;
  holdingSymbols:  Set<string>;
}

function ArticleRow({ article, holdingSymbols }: ArticleRowProps) {
  const hasHolding = article.symbols.some((s) => holdingSymbols.has(s));

  return (
    <div className="border-b border-[#E2E8F0] py-4 last:border-0">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {hasHolding && (
            <span className="h-1.5 w-1.5 rounded-full bg-[#B8960C] shrink-0" />
          )}
          <span className="text-[10px] text-[#4A5568] font-medium">{article.source}</span>
        </div>
        <span className="shrink-0 text-[10px] text-[#4A5568]/70">{fmtDate(article.created_at)}</span>
      </div>

      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-sm font-medium leading-snug text-[#0A1628] hover:text-[#B8960C] transition-colors"
      >
        {article.headline}
      </a>

      {article.summary && (
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#4A5568]">
          {article.summary}
        </p>
      )}

      {article.symbols.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {article.symbols.slice(0, 5).map((sym) => (
            <span
              key={sym}
              className="border border-[#B8960C]/30 px-1.5 py-0.5 text-[10px] font-mono font-medium tracking-wide text-[#0A1628]"
            >
              {sym}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

export function NewsPanel() {
  const [articles, setArticles]     = useState<Article[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(false);
  const [shown, setShown]           = useState(PAGE_SIZE);
  const [holdingSymbols, setHolding] = useState<Set<string>>(new Set());

  // Load user holdings so we can highlight relevant articles
  useEffect(() => {
    async function loadHoldings() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from('holdings')
          .select('ticker')
          .eq('user_id', user.id);

        if (data) {
          setHolding(new Set(data.map((h: { ticker: string }) => h.ticker)));
        }
      } catch {
        // non-critical — continue without highlighting
      }
    }
    loadHoldings();
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/market/news');
      if (!res.ok) throw new Error('fetch failed');
      const data: NewsResponse = await res.json();
      setArticles(data.articles);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5 * 60 * 1_000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div className="border border-[#E2E8F0] bg-white p-6">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="mb-4">
        <p className="text-[11px] tracking-[0.15em] uppercase text-[#B8960C]">
          Market Intelligence
        </p>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      {error && (
        <p className="text-sm text-[#4A5568]">Market intelligence unavailable.</p>
      )}

      {!error && (
        <>
          <div>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonArticle key={i} />)
              : articles.length === 0
                ? <p className="text-sm text-[#4A5568]">No articles available.</p>
                : articles.slice(0, shown).map((article) => (
                    <ArticleRow
                      key={article.id}
                      article={article}
                      holdingSymbols={holdingSymbols}
                    />
                  ))
            }
          </div>

          {!loading && articles.length > shown && (
            <button
              onClick={() => setShown((prev) => prev + PAGE_SIZE)}
              className="mt-4 text-xs tracking-[0.12em] uppercase text-[#4A5568] hover:text-[#0A1628] transition-colors"
            >
              Load more
            </button>
          )}
        </>
      )}
    </div>
  );
}
