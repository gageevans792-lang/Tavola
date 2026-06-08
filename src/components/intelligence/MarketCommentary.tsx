'use client';

import { useEffect, useState, useCallback } from 'react';
import type { CommentaryResponse } from '@/app/api/ai/market-commentary/route';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatGeneratedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

// ── Shimmer skeleton ──────────────────────────────────────────────────────────

function CommentaryShimmer() {
  return (
    <div className="space-y-3">
      <div className="h-4 w-full animate-pulse bg-[#E2E8F0]" />
      <div className="h-4 w-[92%] animate-pulse bg-[#E2E8F0]" />
      <div className="h-4 w-[85%] animate-pulse bg-[#E2E8F0]" />
      <div className="mt-4 h-4 w-full animate-pulse bg-[#E2E8F0]" />
      <div className="h-4 w-[96%] animate-pulse bg-[#E2E8F0]" />
      <div className="h-4 w-[78%] animate-pulse bg-[#E2E8F0]" />
      <div className="mt-4 h-4 w-full animate-pulse bg-[#E2E8F0]" />
      <div className="h-4 w-[88%] animate-pulse bg-[#E2E8F0]" />
      <div className="h-4 w-[60%] animate-pulse bg-[#E2E8F0]" />
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MarketCommentary() {
  const [data, setData] = useState<CommentaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchCommentary = useCallback(async () => {
    setError(false);
    try {
      const res = await fetch('/api/ai/market-commentary');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as CommentaryResponse;
      setData(json);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    void fetchCommentary();
  }, [fetchCommentary]);

  // Refresh every 60 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      void fetchCommentary();
    }, 60 * 60 * 1_000);
    return () => clearInterval(interval);
  }, [fetchCommentary]);

  // ── Split commentary into paragraphs ────────────────────────────────────────

  const paragraphs: string[] = data?.commentary
    ? data.commentary
        .split(/\n\n+/)
        .map((p) => p.trim())
        .filter(Boolean)
    : [];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="bg-[#FAFAFA] border border-[#E2E8F0]"
      style={{ borderLeft: '3px solid #B8960C' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
        <span className="text-[10px] tracking-[0.15em] uppercase text-[#B8960C] font-medium">
          Market Intelligence
        </span>
        {data?.generated_at && (
          <span className="text-[10px] text-[#4A5568]">
            Generated {formatGeneratedAt(data.generated_at)}
          </span>
        )}
      </div>

      {/* Divider */}
      <div className="mx-6 border-t border-[#E2E8F0]" />

      {/* Body */}
      <div className="px-6 py-5">
        {loading ? (
          <CommentaryShimmer />
        ) : error ? (
          <p className="text-[14px] leading-relaxed text-[#4A5568]">
            Market analysis temporarily unavailable.
          </p>
        ) : paragraphs.length === 0 ? (
          <p className="text-[14px] leading-relaxed text-[#4A5568]">
            No commentary available at this time.
          </p>
        ) : (
          <div className="space-y-4">
            {paragraphs.map((para, idx) => (
              <p
                key={idx}
                className="text-[14px] leading-relaxed text-[#0A1628]"
              >
                {para}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
