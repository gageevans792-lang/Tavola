'use client';

import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import type { Notification } from '@/app/api/notifications/route';

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const TYPE_BORDER: Record<string, string> = {
  risk:   'border-l-[#991b1b]',
  profit: 'border-l-[#166534]',
  market: 'border-l-[#B8960C]',
  news:   'border-l-[#4A5568]',
  info:   'border-l-[#4A5568]',
};

const PRIORITY_OPACITY: Record<string, string> = {
  high:   'opacity-100',
  normal: 'opacity-100',
  low:    'opacity-60',
};

const TYPE_DOT: Record<string, string> = {
  risk:   'bg-[#991b1b]',
  profit: 'bg-[#166534]',
  market: 'bg-[#B8960C]',
  news:   'bg-[#4A5568]',
  info:   'bg-[#4A5568]',
};

// ── Component ─────────────────────────────────────────────────────────────────

export function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  // Listen for open event
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('tavola:open-notifications', handler);
    return () => window.removeEventListener('tavola:open-notifications', handler);
  }, []);

  // Lock scroll when open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // ESC key closes the panel
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Fetch notifications when opened
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json() as { notifications: Notification[] };
        setNotifications(data.notifications ?? []);
      }
    } catch { /* non-fatal */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  async function markAllRead() {
    await fetch('/api/notifications', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ all: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    // Dispatch count update
    window.dispatchEvent(new CustomEvent('tavola:notifications-read'));
  }

  async function markOneRead(id: string) {
    await fetch('/api/notifications', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id }),
    });
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    window.dispatchEvent(new CustomEvent('tavola:notifications-read'));
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" aria-modal="true" role="dialog">
      {/* Scrim */}
      <div
        className="absolute inset-0 bg-[#0A1628]/60 backdrop-blur-[2px]"
        onClick={() => setOpen(false)}
      />

      {/* Drawer — slides in from right */}
      <aside
        className="absolute top-0 right-0 bottom-0 flex flex-col bg-[#0A1628] shadow-2xl animate-[slideInRight_0.25s_ease-out]"
        style={{ width: 'min(90vw, 360px)' }}
      >
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-6 border-b border-white/10 shrink-0">
          <div>
            <span className="font-serif text-[12px] tracking-[0.4em] uppercase text-white">
              Alerts
            </span>
            {unreadCount > 0 && (
              <span className="ml-2 bg-[#B8960C] text-[#0A1628] text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <button
            onClick={() => setOpen(false)}
            className="flex items-center justify-center h-7 w-7 text-white/40 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mark all read */}
        {unreadCount > 0 && (
          <div className="px-6 py-2 border-b border-white/10 shrink-0">
            <button
              onClick={markAllRead}
              className="text-[10px] tracking-[0.15em] uppercase text-[#B8960C] hover:text-white transition-colors"
            >
              Mark all read
            </button>
          </div>
        )}

        {/* Notifications list */}
        <div className="flex-1 overflow-y-auto py-2">
          {loading ? (
            <div className="px-6 py-8 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse bg-white/5 rounded" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-[11px] tracking-[0.15em] uppercase text-white/30 mb-2">All Clear</p>
              <p className="text-[13px] text-white/50 leading-relaxed">
                No alerts. Tavola AI is watching your portfolio 24/7.
              </p>
            </div>
          ) : (
            <div>
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`border-l-2 ${TYPE_BORDER[notif.type] ?? 'border-l-[#4A5568]'} px-6 py-4 cursor-pointer hover:bg-white/5 transition-colors ${notif.read ? 'opacity-50' : (PRIORITY_OPACITY[notif.priority] ?? 'opacity-100')}`}
                  onClick={() => !notif.read && markOneRead(notif.id)}
                >
                  <div className="flex items-start gap-2 mb-1">
                    <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${TYPE_DOT[notif.type] ?? 'bg-[#4A5568]'} ${notif.read ? 'opacity-0' : ''}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-white leading-snug">
                        {notif.priority === 'high' && !notif.read && (
                          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#991b1b] align-middle" />
                        )}
                        {notif.title}
                      </p>
                    </div>
                  </div>
                  <p className="text-[12px] text-white/60 leading-relaxed pl-3.5">{notif.message}</p>
                  <div className="flex items-center justify-between pl-3.5 mt-1">
                    <p className="text-[10px] text-white/30">{timeAgo(notif.created_at)}</p>
                    {notif.action_url && (
                      <a
                        href={notif.action_url}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[10px] tracking-[0.1em] uppercase text-[#B8960C] hover:text-white transition-colors"
                      >
                        View →
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
