'use client';

import { Bell } from 'lucide-react';
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
      <h1 className="font-serif text-lg font-light text-[#0A1628]">{title}</h1>

      {/* Market status pill */}
      <div className="hidden lg:flex items-center gap-1.5 ml-4">
        <span className="h-1.5 w-1.5 rounded-full bg-[#166534]" />
        <span className="text-[11px] text-[#4A5568] tracking-[0.06em]">NYSE Open</span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        {/* ⌘K hint — opens command palette */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('tavola:open-palette'))}
          className="hidden md:flex items-center border border-[#E2E8F0] px-2 h-6 gap-1 text-[10px] text-[#4A5568] hover:border-[#0A1628] hover:text-[#0A1628] transition-colors"
          aria-label="Open command palette"
        >
          <span className="font-mono">⌘K</span>
        </button>

        {/* Mode toggle */}
        {hasAnalysis && mode && onModeChange && (
          <div className="flex items-center border border-[#E2E8F0]">
            {(['review', 'auto'] as InvestMode[]).map((m) => (
              <button
                key={m}
                onClick={() => onModeChange(m)}
                disabled={analyzing}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed',
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
            className="text-xs tracking-[0.2em] uppercase"
          >
            {analyzing ? 'Analyzing…' : 'Run Analysis'}
          </Button>
        )}

        {hasAnalysis && <div className="h-5 w-px bg-[#E2E8F0]" />}

        <Button variant="ghost" size="sm" aria-label="Notifications">
          <Bell className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
