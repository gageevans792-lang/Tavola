'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CommandItem {
  label: string;
  description: string;
  shortcut?: string;
  href?: string;
  action?: string;
}

interface CommandGroup {
  name: string;
  items: CommandItem[];
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onRunAnalysis?: () => void;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const GROUPS: CommandGroup[] = [
  {
    name: 'Navigate',
    items: [
      { label: 'Dashboard',     shortcut: 'G D', href: '/dashboard',    description: 'Portfolio overview and AI feed' },
      { label: 'Performance',   shortcut: 'G F', href: '/performance',  description: 'Returns, Sharpe ratio, AI attribution' },
      { label: 'AutoPilot',     shortcut: 'G P', href: '/autopilot',    description: 'Autonomous AI investing engine' },
      { label: 'AI Agent',      shortcut: 'G A', href: '/autonomous',   description: 'Run autonomous investment agent' },
      { label: 'Strategy',      shortcut: 'G S', href: '/strategy',     description: 'Investment philosophy & execution mode' },
      { label: 'Intelligence',  shortcut: 'G I', href: '/intelligence', description: 'Market signals, sector analytics, news' },
      { label: 'Holdings',      shortcut: 'G H', href: '/holdings',     description: 'Current positions and watchlist' },
      { label: 'Trade History', shortcut: 'G T', href: '/trades',       description: 'Full audit log of all trades' },
      { label: 'Banking',       shortcut: 'G B', href: '/bank',         description: 'Bank connection and recurring deposits' },
      { label: 'Deposit',       href: '/deposit',  description: 'Add funds to your account' },
      { label: 'Settings',      href: '/settings', description: 'Account and notification preferences' },
      { label: 'AI Insights',   href: '/insights', description: 'Historical AI recommendations' },
    ],
  },
  {
    name: 'Actions',
    items: [
      { label: 'Run AI Analysis',          description: 'Analyze portfolio and generate recommendations', action: 'run-analysis' },
      { label: 'Toggle AutoPilot',         description: 'Enable or disable autonomous investing',         href: '/autopilot' },
      { label: 'Launch Autonomous Agent',  description: 'Auto-invest based on your strategy',            href: '/autonomous' },
      { label: 'Change Strategy',          description: 'Switch investment philosophy',                   href: '/strategy' },
      { label: 'View Market Intelligence', description: 'Signals, movers, and news',                     href: '/intelligence' },
    ],
  },
];

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    }
    function paletteEventHandler() {
      setOpen(true);
    }
    window.addEventListener('keydown', handler);
    window.addEventListener('tavola:open-palette', paletteEventHandler);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('tavola:open-palette', paletteEventHandler);
    };
  }, []);

  return { open, setOpen };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function filterItems(query: string): { grouped: CommandGroup[]; flat: CommandItem[] } {
  const q = query.trim().toLowerCase();
  if (!q) {
    return { grouped: GROUPS, flat: [] };
  }
  const flat: CommandItem[] = [];
  for (const group of GROUPS) {
    for (const item of group.items) {
      if (
        item.label.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      ) {
        flat.push(item);
      }
    }
  }
  return { grouped: [], flat };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CommandPalette({ open, onClose, onRunAnalysis }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { grouped, flat } = filterItems(query);
  const isFiltering = query.trim().length > 0;

  // Flatten for keyboard navigation
  const flatItems: CommandItem[] = isFiltering
    ? flat
    : GROUPS.flatMap((g) => g.items);

  // Reset state when palette opens
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Keep active item in view
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector('[data-active="true"]');
    if (active) {
      active.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const handleSelect = useCallback(
    (item: CommandItem) => {
      if (item.action === 'run-analysis') {
        onRunAnalysis?.();
        onClose();
        return;
      }
      if (item.href) {
        router.push(item.href);
        onClose();
      }
    },
    [router, onClose, onRunAnalysis]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (flatItems[activeIndex]) {
            handleSelect(flatItems[activeIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [flatItems, activeIndex, handleSelect, onClose]
  );

  // Reset active index when query changes
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Compute cumulative offset for grouped keyboard navigation
  function getGroupedIndex(groupIdx: number, itemIdx: number): number {
    let count = 0;
    for (let i = 0; i < groupIdx; i++) {
      count += GROUPS[i].items.length;
    }
    return count + itemIdx;
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/40"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            key="panel"
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="fixed left-1/2 top-[15%] z-50 w-full max-w-xl -translate-x-1/2 border border-[#E2E8F0] bg-white shadow-2xl"
            onKeyDown={handleKeyDown}
          >
            {/* Search row */}
            <div className="flex h-12 items-center border-b border-[#E2E8F0] px-4">
              {/* Search icon */}
              <svg
                className="mr-3 h-4 w-4 shrink-0 text-[#4A5568]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" strokeLinecap="round" />
              </svg>

              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search commands..."
                className="flex-1 bg-transparent text-[14px] text-[#0A1628] outline-none placeholder:text-[#4A5568]/50"
                aria-autocomplete="list"
                autoComplete="off"
                spellCheck={false}
              />

              {/* Esc hint */}
              <span className="border border-[#E2E8F0] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[#4A5568]/50">
                Esc
              </span>
            </div>

            {/* Results */}
            <div
              ref={listRef}
              className="max-h-[360px] overflow-y-auto"
              role="listbox"
            >
              {isFiltering ? (
                flat.length === 0 ? (
                  <div className="px-4 py-8 text-center text-[13px] text-[#4A5568]">
                    No results for &ldquo;{query}&rdquo;
                  </div>
                ) : (
                  flat.map((item, idx) => (
                    <ItemRow
                      key={`${item.label}-${idx}`}
                      item={item}
                      active={idx === activeIndex}
                      onSelect={() => handleSelect(item)}
                      onMouseEnter={() => setActiveIndex(idx)}
                    />
                  ))
                )
              ) : (
                grouped.map((group, groupIdx) => (
                  <div key={group.name}>
                    <div className="px-4 pb-1.5 pt-4 text-[10px] uppercase tracking-[0.15em] text-[#B8960C]">
                      {group.name}
                    </div>
                    {group.items.map((item, itemIdx) => {
                      const idx = getGroupedIndex(groupIdx, itemIdx);
                      return (
                        <ItemRow
                          key={`${item.label}-${idx}`}
                          item={item}
                          active={idx === activeIndex}
                          onSelect={() => handleSelect(item)}
                          onMouseEnter={() => setActiveIndex(idx)}
                        />
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-4 border-t border-[#E2E8F0] px-4 py-2 text-[10px] text-[#4A5568]/60">
              <span>↑↓ navigate</span>
              <span>↵ open</span>
              <span>esc close</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Item Row ─────────────────────────────────────────────────────────────────

interface ItemRowProps {
  item: CommandItem;
  active: boolean;
  onSelect: () => void;
  onMouseEnter: () => void;
}

function ItemRow({ item, active, onSelect, onMouseEnter }: ItemRowProps) {
  const shortcuts = item.shortcut ? item.shortcut.split(' ') : [];

  return (
    <div
      role="option"
      aria-selected={active}
      data-active={active}
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      className={
        'flex cursor-pointer items-center border-l-2 px-4 py-2.5 transition-colors ' +
        (active
          ? 'border-l-[#B8960C] bg-[#F8F9FA]'
          : 'border-l-transparent hover:bg-[#F8F9FA]/60')
      }
    >
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-[#0A1628]">{item.label}</div>
        <div className="mt-0.5 text-[11px] text-[#4A5568]">{item.description}</div>
      </div>

      {shortcuts.length > 0 && (
        <div className="ml-3 flex shrink-0 gap-1">
          {shortcuts.map((key) => (
            <span
              key={key}
              className="border border-[#E2E8F0] px-1.5 py-0.5 font-mono text-[10px] text-[#4A5568]"
            >
              {key}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
