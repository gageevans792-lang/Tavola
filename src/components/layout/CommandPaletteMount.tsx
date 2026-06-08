'use client';

import { useCommandPalette, CommandPalette } from '@/components/ui/CommandPalette';

export function CommandPaletteMount() {
  const { open, setOpen } = useCommandPalette();
  return <CommandPalette open={open} onClose={() => setOpen(false)} />;
}
