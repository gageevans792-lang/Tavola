'use client';

import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { InvestMode } from '@/types';

interface TopBarProps {
  title: string;
  onRunAnalysis?: () => void;
  analyzing?: boolean;
  mode?: InvestMode;
  onModeChange?: (mode: InvestMode) => void;
}

export function TopBar({ title, onRunAnalysis, analyzing, mode, onModeChange }: TopBarProps) {
  const hasAnalysis = !!onRunAnalysis;

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-[#E2E8F0] bg-white px-6">
      <h1 className="font-serif text-[22px] font-light text-[#0A1628]">{title}</h1>

      <div className="ml-auto flex items-center gap-3">
        {/* Mode toggle pill */}
        {hasAnalysis && mode && onModeChange && (
          <div className="flex items-center border border-[#E2E8F0]">
            {(['review', 'auto'] as InvestMode[]).map((m) => (
              <button
                key={m}
                onClick={() => onModeChange(m)}
                disabled={analyzing}
                className={cn(
                  'px-4 py-1.5 text-[11px] tracking-[0.12em] uppercase font-medium transition-colors disabled:cursor-not-allowed',
                  mode === m
                    ? m === 'auto'
                      ? 'bg-[#0A1628] text-white'
                      : 'bg-[#F8F9FA] text-[#0A1628]'
                    : 'text-[#4A5568] hover:text-[#0A1628]'
                )}
              >
                {m === 'auto' ? 'Auto' : 'Review'}
              </button>
            ))}
          </div>
        )}

        {hasAnalysis && (
          <Button
            size="sm"
            onClick={onRunAnalysis}
            loading={analyzing}
            disabled={analyzing}
          >
            {analyzing ? 'Analyzing' : 'Run Analysis'}
          </Button>
        )}
      </div>
    </header>
  );
}
