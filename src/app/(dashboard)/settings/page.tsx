'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { TopBar } from '@/components/layout/TopBar';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

type Section = 'profile' | 'security' | 'notifications' | 'danger';

type Msg = { type: 'success' | 'error'; text: string };

interface NotificationPrefs {
  emailTrades: boolean;
  weeklyPortfolio: boolean;
  marketAlerts: boolean;
}

const NOTIF_KEY = 'tavola:notifications';

function loadNotifPrefs(): NotificationPrefs {
  if (typeof window === 'undefined') return { emailTrades: true, weeklyPortfolio: true, marketAlerts: false };
  try {
    const stored = localStorage.getItem(NOTIF_KEY);
    if (stored) return JSON.parse(stored) as NotificationPrefs;
  } catch {}
  return { emailTrades: true, weeklyPortfolio: true, marketAlerts: false };
}

function saveNotifPrefs(prefs: NotificationPrefs) {
  try {
    localStorage.setItem(NOTIF_KEY, JSON.stringify(prefs));
  } catch {}
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name }: { name: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <div className="w-12 h-12 bg-[#0A1628] flex items-center justify-center shrink-0">
      <span className="font-mono text-[15px] text-[#B8960C] tabular-nums tracking-wide">
        {initials || '?'}
      </span>
    </div>
  );
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 items-center transition-colors shrink-0 border border-[#E2E8F0]',
        checked ? 'bg-[#0A1628]' : 'bg-[#E2E8F0]',
      )}
    >
      <span
        className={cn(
          'inline-block h-3 w-3 bg-white transition-transform',
          checked ? 'translate-x-5' : 'translate-x-1',
        )}
      />
    </button>
  );
}

// ─── Section Nav ─────────────────────────────────────────────────────────────

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'profile',       label: 'Profile'       },
  { id: 'security',      label: 'Security'      },
  { id: 'notifications', label: 'Notifications' },
  { id: 'danger',        label: 'Danger Zone'   },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<Section>('profile');

  // Profile
  const [fullName, setFullName]           = useState('');
  const [email, setEmail]                 = useState('');
  const [userId, setUserId]               = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg]       = useState<Msg | null>(null);

  // Investment profile
  const [strategyLabel, setStrategyLabel] = useState<string | null>(null);
  const [riskLabel, setRiskLabel]         = useState<string | null>(null);

  // AutoPilot status
  const [autopilotEnabled, setAutopilotEnabled] = useState<boolean | null>(null);

  // Security
  const [resetSent, setResetSent]     = useState(false);
  const [securityMsg, setSecurityMsg] = useState<Msg | null>(null);

  // Notifications
  const [notifs, setNotifs] = useState<NotificationPrefs>({
    emailTrades: true,
    weeklyPortfolio: true,
    marketAlerts: false,
  });

  // Danger zone
  const [deleteInput, setDeleteInput]         = useState('');
  const [deleteStep, setDeleteStep]           = useState<'idle' | 'confirm' | 'done'>('idle');
  const [deletingAccount, setDeletingAccount] = useState(false);

  // ── Load user ──────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setUserId(user.id);
        setEmail(user.email ?? '');
        setFullName((user.user_metadata?.full_name as string) ?? '');
      } catch (err) {
        console.error('[settings] failed to load user', err);
      }
    }
    load();
    setNotifs(loadNotifPrefs());
  }, []);

  // ── Load strategy ──────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/ai/strategy')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { strategy?: { name?: string; risk_level?: string }; name?: string; strategy_name?: string; risk_level?: string } | null) => {
        if (!d) return;
        const stratName = d.strategy?.name ?? d.name ?? d.strategy_name ?? null;
        const riskLvl   = d.strategy?.risk_level ?? d.risk_level ?? null;
        setStrategyLabel(stratName as string | null);
        setRiskLabel(riskLvl as string | null);
      })
      .catch(() => {});
  }, []);

  // ── Load autopilot ─────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/ai/autopilot/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { settings?: { enabled?: boolean }; enabled?: boolean } | null) => {
        const enabled = d?.settings?.enabled ?? (typeof d?.enabled === 'boolean' ? d.enabled : null);
        if (typeof enabled === 'boolean') setAutopilotEnabled(enabled);
      })
      .catch(() => {});
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ data: { full_name: fullName } });
      if (error) throw error;
      setProfileMsg({ type: 'success', text: 'Profile updated.' });
    } catch {
      setProfileMsg({ type: 'error', text: 'Unable to save. Please try again.' });
    } finally {
      setSavingProfile(false);
      setTimeout(() => setProfileMsg(null), 4000);
    }
  }

  async function handleChangePassword() {
    if (!email) return;
    setSecurityMsg(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (error) throw error;
      setResetSent(true);
      setSecurityMsg({ type: 'success', text: 'Password reset email sent. Check your inbox.' });
    } catch {
      setSecurityMsg({ type: 'error', text: 'Unable to send reset email. Please try again.' });
    } finally {
      setTimeout(() => setSecurityMsg(null), 6000);
    }
  }

  function handleNotifChange(key: keyof NotificationPrefs, val: boolean) {
    const updated = { ...notifs, [key]: val };
    setNotifs(updated);
    saveNotifPrefs(updated);
  }

  async function handleDeleteAccount() {
    if (deleteInput !== 'DELETE') return;
    setDeletingAccount(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // proceed regardless
    } finally {
      setDeletingAccount(false);
      setDeleteStep('done');
    }
  }

  // ── Risk colour map ────────────────────────────────────────────────────────

  const riskColors: Record<string, string> = {
    conservative: '#166534',
    balanced:     '#0A1628',
    growth:       '#B8960C',
    aggressive:   '#991b1b',
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="Settings" />
      <main className="flex-1 overflow-y-auto bg-[#F8F9FA]">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8">

          {/* Quick Links — features accessible from Settings */}
          <div className="mb-8 border border-[#E2E8F0] bg-white">
            <div className="px-6 py-4 border-b border-[#E2E8F0]">
              <p className="text-[10px] tracking-[0.2em] uppercase text-[#B8960C]">Quick Links</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-y divide-[#E2E8F0]">
              {[
                { href: '/bank',       label: 'Banking',       desc: 'Link accounts, manage transfers' },
                { href: '/deposit',    label: 'Deposit',       desc: 'Add funds to your portfolio' },
                { href: '/trades',     label: 'Trade History', desc: 'Full history of all orders' },
                { href: '/strategy',   label: 'Strategy',      desc: 'Manage your investment strategy' },
                { href: '/insights',   label: 'AI Insights',   desc: 'Historical AI recommendations' },
                { href: '/autopilot',  label: 'AutoPilot',     desc: 'Automated portfolio management' },
              ].map(({ href, label, desc }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex flex-col px-5 py-4 hover:bg-[#F8F9FA] transition-colors group"
                >
                  <span className="text-[13px] text-[#0A1628] font-medium group-hover:text-[#B8960C] transition-colors">{label}</span>
                  <span className="text-[11px] text-[#4A5568] mt-0.5 leading-snug">{desc}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Page header */}
          <div className="border-b border-[#E2E8F0] pb-6 mb-8">
            <h2 className="font-serif text-2xl font-light text-[#0A1628]">Account Settings</h2>
            <p className="mt-1 text-sm text-[#4A5568]">Manage your account and preferences</p>
          </div>

          <div className="flex gap-8 flex-col sm:flex-row">

            {/* ── Left sidebar nav ── */}
            <nav className="sm:w-44 shrink-0">
              <ul className="space-y-1">
                {SECTIONS.map(({ id, label }) => (
                  <li key={id}>
                    <button
                      onClick={() => setActiveSection(id)}
                      className={cn(
                        'w-full text-left px-3 py-2 text-[13px] transition-colors border-l-2',
                        activeSection === id
                          ? 'border-[#B8960C] text-[#0A1628] bg-white'
                          : 'border-transparent text-[#4A5568] hover:text-[#0A1628] hover:bg-white/60',
                        id === 'danger' ? 'text-[#991b1b] hover:text-[#991b1b]' : '',
                      )}
                    >
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            {/* ── Main content area ── */}
            <div className="flex-1 min-w-0 space-y-6">

              {/* ── Profile ── */}
              {activeSection === 'profile' && (
                <>
                  <section className="bg-white border border-[#E2E8F0] p-4 sm:p-8">
                    <h3 className="font-serif text-xl font-light text-[#0A1628] mb-6">Profile</h3>

                    {/* Avatar + name row */}
                    <div className="flex items-center gap-4 mb-8">
                      <Avatar name={fullName} />
                      <div>
                        <p className="text-sm font-medium text-[#0A1628]">{fullName || 'No name set'}</p>
                        <p className="text-[12px] text-[#4A5568]">{email}</p>
                      </div>
                    </div>

                    <form onSubmit={handleSaveProfile} className="space-y-6">
                      <div>
                        <label className="block text-[11px] tracking-[0.12em] uppercase text-[#0A1628]/40 mb-2">
                          Full name
                        </label>
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="w-full border-b border-[#E2E8F0] py-3 text-sm text-[#0A1628] outline-none focus:border-[#0A1628] bg-transparent transition-colors"
                          placeholder="Your full name"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] tracking-[0.12em] uppercase text-[#0A1628]/40 mb-2">
                          Email
                        </label>
                        <input
                          type="email"
                          value={email}
                          disabled
                          className="w-full border-b border-[#E2E8F0] py-3 text-sm text-[#0A1628]/40 outline-none bg-transparent cursor-not-allowed opacity-60"
                        />
                      </div>
                      <div className="flex items-center gap-4 pt-2">
                        <button
                          type="submit"
                          disabled={savingProfile}
                          className="bg-[#0A1628] text-white text-[11px] tracking-[0.2em] uppercase h-10 px-6 hover:bg-[#1a2f4a] transition-colors disabled:opacity-50"
                        >
                          {savingProfile ? 'Saving' : 'Save changes'}
                        </button>
                        {profileMsg && (
                          <p className={cn('text-xs', profileMsg.type === 'success' ? 'text-[#166534]' : 'text-[#C41E3A]')}>
                            {profileMsg.text}
                          </p>
                        )}
                      </div>
                    </form>
                  </section>

                  {/* Investment Profile */}
                  <section className="bg-white border border-[#E2E8F0] p-4 sm:p-8">
                    <h3 className="font-serif text-xl font-light text-[#0A1628] mb-2">Investment Profile</h3>
                    <p className="text-[13px] text-[#4A5568] mb-6">Your current investment strategy and risk settings.</p>

                    {strategyLabel || riskLabel ? (
                      <div className="flex items-center gap-3 mb-6">
                        {strategyLabel && (
                          <span className="text-[12px] text-[#0A1628] bg-[#F8F9FA] border border-[#E2E8F0] px-3 py-1">
                            {strategyLabel}
                          </span>
                        )}
                        {riskLabel && (
                          <span
                            className="text-[11px] tracking-[0.12em] uppercase px-3 py-1 border"
                            style={{
                              color: riskColors[riskLabel.toLowerCase()] ?? '#0A1628',
                              borderColor: riskColors[riskLabel.toLowerCase()] ?? '#E2E8F0',
                            }}
                          >
                            Risk: {riskLabel}
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-[13px] text-[#4A5568]/60 mb-6">No strategy configured.</p>
                    )}

                    <Link
                      href="/onboarding"
                      className="text-[12px] text-[#B8960C] tracking-[0.1em] uppercase hover:underline underline-offset-2"
                    >
                      Retake Financial Assessment →
                    </Link>
                  </section>

                  {/* AutoPilot Status */}
                  <section className="bg-white border border-[#E2E8F0] p-4 sm:p-8">
                    <h3 className="font-serif text-xl font-light text-[#0A1628] mb-2">AutoPilot</h3>
                    <p className="text-[13px] text-[#4A5568] mb-4">Autonomous AI investing status.</p>

                    <div className="flex items-center gap-3 mb-6">
                      <span
                        className={cn(
                          'text-[11px] tracking-[0.12em] uppercase px-3 py-1 border',
                          autopilotEnabled === true
                            ? 'text-[#166534] border-[#166534]'
                            : autopilotEnabled === false
                              ? 'text-[#4A5568] border-[#E2E8F0]'
                              : 'text-[#4A5568]/40 border-[#E2E8F0]',
                        )}
                      >
                        {autopilotEnabled === true ? 'Active' : autopilotEnabled === false ? 'Disabled' : 'Unknown'}
                      </span>
                    </div>

                    <Link
                      href="/autopilot"
                      className="text-[12px] text-[#B8960C] tracking-[0.1em] uppercase hover:underline underline-offset-2"
                    >
                      Configure AutoPilot →
                    </Link>
                  </section>
                </>
              )}

              {/* ── Security ── */}
              {activeSection === 'security' && (
                <section className="bg-white border border-[#E2E8F0] p-4 sm:p-8">
                  <h3 className="font-serif text-xl font-light text-[#0A1628] mb-6">Security</h3>

                  <div className="space-y-8">
                    {/* Change password */}
                    <div className="border-b border-[#E2E8F0] pb-8">
                      <p className="text-[13px] font-medium text-[#0A1628] mb-1">Password</p>
                      <p className="text-[12px] text-[#4A5568] mb-4">
                        Send a password reset email to {email || 'your email address'}.
                      </p>
                      <button
                        onClick={handleChangePassword}
                        disabled={resetSent}
                        className="bg-[#0A1628] text-white text-[11px] tracking-[0.2em] uppercase h-10 px-6 hover:bg-[#1a2f4a] transition-colors disabled:opacity-50"
                      >
                        {resetSent ? 'Email sent' : 'Change Password'}
                      </button>
                      {securityMsg && (
                        <p className={cn('mt-3 text-[12px]', securityMsg.type === 'success' ? 'text-[#166534]' : 'text-[#C41E3A]')}>
                          {securityMsg.text}
                        </p>
                      )}
                    </div>

                    {/* 2FA */}
                    <div>
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-[13px] font-medium text-[#0A1628] mb-1">Two-Factor Authentication</p>
                          <p className="text-[12px] text-[#4A5568]">Add an extra layer of security to your account.</p>
                        </div>
                        <span className="shrink-0 text-[10px] tracking-[0.15em] uppercase text-[#4A5568]/50 border border-[#E2E8F0] px-2 py-1">
                          Coming soon
                        </span>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* ── Notifications ── */}
              {activeSection === 'notifications' && (
                <section className="bg-white border border-[#E2E8F0] p-4 sm:p-8">
                  <h3 className="font-serif text-xl font-light text-[#0A1628] mb-6">Notifications</h3>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between gap-4 border-b border-[#E2E8F0] pb-6">
                      <div>
                        <p className="text-[13px] font-medium text-[#0A1628] mb-0.5">Email alerts on AI trades</p>
                        <p className="text-[12px] text-[#4A5568]">Get notified when AutoPilot executes a trade.</p>
                      </div>
                      <Toggle
                        checked={notifs.emailTrades}
                        onChange={(v) => handleNotifChange('emailTrades', v)}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-4 border-b border-[#E2E8F0] pb-6">
                      <div>
                        <p className="text-[13px] font-medium text-[#0A1628] mb-0.5">Weekly portfolio summary</p>
                        <p className="text-[12px] text-[#4A5568]">Receive a weekly digest of your portfolio performance.</p>
                      </div>
                      <Toggle
                        checked={notifs.weeklyPortfolio}
                        onChange={(v) => handleNotifChange('weeklyPortfolio', v)}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[13px] font-medium text-[#0A1628] mb-0.5">Market alerts</p>
                        <p className="text-[12px] text-[#4A5568]">Significant market movements and signals.</p>
                      </div>
                      <Toggle
                        checked={notifs.marketAlerts}
                        onChange={(v) => handleNotifChange('marketAlerts', v)}
                      />
                    </div>
                  </div>
                </section>
              )}

              {/* ── Danger Zone ── */}
              {activeSection === 'danger' && (
                <section className="bg-white border border-[#C41E3A]/20 p-4 sm:p-8">
                  <h3 className="font-serif text-xl font-light text-[#0A1628] mb-2">Delete Account</h3>
                  <p className="text-[13px] text-[#4A5568] mb-8">
                    Permanently delete your account and all associated data. This action cannot be undone.
                  </p>

                  {deleteStep === 'done' ? (
                    <div className="border border-[#E2E8F0] p-6">
                      <p className="text-[13px] text-[#0A1628] mb-1">Request submitted.</p>
                      <p className="text-[12px] text-[#4A5568]">
                        Contact{' '}
                        <a href="mailto:support@tavola.ai" className="text-[#B8960C] hover:underline">
                          support@tavola.ai
                        </a>{' '}
                        to complete account deletion.
                      </p>
                    </div>
                  ) : deleteStep === 'confirm' ? (
                    <div className="space-y-4">
                      <p className="text-[13px] text-[#0A1628]">
                        Type <span className="font-mono font-medium">DELETE</span> to confirm account deletion:
                      </p>
                      <input
                        type="text"
                        value={deleteInput}
                        onChange={(e) => setDeleteInput(e.target.value)}
                        placeholder="DELETE"
                        className="w-full border border-[#C41E3A]/30 px-4 py-3 text-sm text-[#0A1628] outline-none focus:border-[#C41E3A] bg-transparent transition-colors font-mono"
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={handleDeleteAccount}
                          disabled={deleteInput !== 'DELETE' || deletingAccount}
                          className="bg-[#C41E3A] text-white text-[11px] tracking-[0.2em] uppercase h-10 px-6 hover:bg-[#991b1b] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {deletingAccount ? 'Processing...' : 'Confirm Delete'}
                        </button>
                        <button
                          onClick={() => { setDeleteStep('idle'); setDeleteInput(''); }}
                          className="border border-[#E2E8F0] text-[#0A1628] text-[11px] tracking-[0.2em] uppercase h-10 px-6 hover:border-[#0A1628] transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteStep('confirm')}
                      className="border border-[#C41E3A] text-[#C41E3A] text-[11px] tracking-[0.2em] uppercase h-10 px-6 hover:bg-[#C41E3A]/5 transition-colors"
                    >
                      Delete Account
                    </button>
                  )}
                </section>
              )}

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
