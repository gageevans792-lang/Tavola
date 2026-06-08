'use client';

import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { MobileMenuButton } from '@/components/layout/MobileNav';
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
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-[#E2E8F0] bg-white px-4 sm:px-6">
      <h1 className="font-serif text-base sm:text-lg font-light text-[#0A1628] truncate min-w-0">{title}</h1>

      {/* Market status pill — desktop only */}
      <div className="hidden lg:flex items-center gap-1.5 ml-4 shrink-0">
        <span className="h-1.5 w-1.5 rounded-full bg-[#166534]" />
        <span className="text-[11px] text-[#4A5568] tracking-[0.06em]">NYSE Open</span>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3 shrink-0">
        {/* ⌘K hint — desktop only */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('tavola:open-palette'))}
          className="hidden md:flex items-center border border-[#E2E8F0] px-2 h-6 gap-1 text-[10px] text-[#4A5568] hover:border-[#0A1628] hover:text-[#0A1628] transition-colors"
          aria-label="Open command palette"
        >
          <span className="font-mono">⌘K</span>
        </button>

        {/* Mode toggle — hidden on mobile */}
        {hasAnalysis && mode && onModeChange && (
          <div className="hidden sm:flex items-center border border-[#E2E8F0]">
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
            className="text-[10px] sm:text-xs tracking-[0.12em] sm:tracking-[0.2em] uppercase whitespace-nowrap"
          >
            {analyzing ? '…' : <><span className="sm:hidden">Analyze</span><span className="hidden sm:inline">Run Analysis</span></>}
          </Button>
        )}

        <Button variant="ghost" size="sm" aria-label="Notifications" className="hidden sm:flex">
          <Bell className="h-4 w-4" />
        </Button>

        <MobileMenuButton />
      </div>
    </header>
  );
}
