'use client';

import { Bell, Moon, Sparkles, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
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
  const { theme, setTheme } = useTheme();
  const hasAnalysis = !!onRunAnalysis;

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-6 dark:border-gray-800 dark:bg-gray-950">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h1>

      {/* Push controls to the right */}
      <div className="ml-auto flex items-center gap-3">
        {/* Mode toggle — only when analysis is wired up */}
        {hasAnalysis && mode && onModeChange && (
          <div className="flex items-center rounded-lg border border-gray-200 p-0.5 dark:border-gray-700">
            {(['review', 'auto'] as InvestMode[]).map((m) => (
              <button
                key={m}
                onClick={() => onModeChange(m)}
                disabled={analyzing}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed',
                  mode === m
                    ? m === 'auto'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-900 shadow-sm dark:bg-gray-800 dark:text-gray-100'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
                )}
              >
                {m === 'auto' ? '⚡ Auto' : '👁 Review'}
              </button>
            ))}
          </div>
        )}

        {/* Run Analysis */}
        {hasAnalysis && (
          <Button
            size="sm"
            onClick={onRunAnalysis}
            loading={analyzing}
            disabled={analyzing}
            className="gap-1.5"
          >
            {!analyzing && <Sparkles className="h-3.5 w-3.5" />}
            {analyzing ? 'Analyzing…' : 'Run Analysis'}
          </Button>
        )}

        {/* Divider */}
        {hasAnalysis && (
          <div className="h-5 w-px bg-gray-200 dark:bg-gray-700" />
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="sm" aria-label="Notifications">
          <Bell className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
