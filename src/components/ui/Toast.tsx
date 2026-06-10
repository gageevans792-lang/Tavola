'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface ToastData {
  ticker:  string;
  action:  'buy' | 'sell';
  qty:     number;
  price?:  number;
}

interface ToastProps {
  data:      ToastData;
  onDismiss: () => void;
}

export function Toast({ data, onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(false);
  // stable reference so the cleanup effect doesn't re-run on each render
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    // Trigger enter animation on next tick
    const enterFrame = requestAnimationFrame(() => setVisible(true));

    const hideTimer = setTimeout(() => {
      setVisible(false);
      // Let the CSS transition finish before removing from DOM
      setTimeout(() => dismissRef.current(), 300);
    }, 5000);

    return () => {
      cancelAnimationFrame(enterFrame);
      clearTimeout(hideTimer);
    };
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(() => dismissRef.current(), 300);
  }

  const verb  = data.action === 'buy' ? 'purchased' : 'sold';
  const price = data.price != null ? ` at $${data.price.toFixed(2)}` : '';

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed bottom-6 right-6 z-50 flex items-stretch border border-[#E2E8F0] bg-white shadow-lg transition-all duration-300 ease-out',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
      )}
    >
      {/* Gold left accent */}
      <div className="w-[3px] shrink-0 bg-[#B8960C]" />

      <div className="flex min-w-[260px] items-start justify-between gap-4 px-5 py-4">
        <div>
          <p className="text-[11px] tracking-[0.15em] uppercase text-[#4A5568] mb-1">
            Trade executed
          </p>
          <p className="text-sm text-[#0A1628]">
            <span className="font-medium">{data.ticker}</span>
            {' '}{verb}: {data.qty} {data.qty === 1 ? 'share' : 'shares'}{price}
          </p>
        </div>
        <button
          onClick={handleClose}
          className="mt-0.5 shrink-0 text-base leading-none text-[#4A5568]/40 hover:text-[#0A1628] transition-colors"
          aria-label="Dismiss notification"
        >
          ×
        </button>
      </div>
    </div>
  );
}
