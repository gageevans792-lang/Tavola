'use client';

import { useState, useEffect } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { RiskLevel } from '@/types';

const riskOptions: { value: RiskLevel; label: string; description: string }[] = [
  { value: 'conservative', label: 'Conservative', description: 'Capital preservation, steady income' },
  { value: 'balanced',     label: 'Balanced',     description: 'Moderate growth, managed volatility' },
  { value: 'growth',       label: 'Growth',       description: 'Higher returns, higher volatility' },
  { value: 'aggressive',   label: 'Aggressive',   description: 'Maximum returns, full market exposure' },
];

type Msg = { type: 'success' | 'error'; text: string };

export default function SettingsPage() {
  const [fullName, setFullName]     = useState('');
  const [email, setEmail]           = useState('');
  const [riskLevel, setRiskLevel]   = useState<RiskLevel>('balanced');
  const [userId, setUserId]         = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingRisk, setSavingRisk]       = useState(false);
  const [profileMsg, setProfileMsg] = useState<Msg | null>(null);
  const [riskMsg, setRiskMsg]       = useState<Msg | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setUserId(user.id);
        setEmail(user.email ?? '');
        setFullName((user.user_metadata?.full_name as string) ?? '');

        const { data: profile } = await supabase
          .from('risk_profiles')
          .select('level')
          .eq('user_id', user.id)
          .single();
        if (profile) setRiskLevel(profile.level as RiskLevel);
      } catch (err) {
        console.error('[settings] failed to load user', err);
      }
    }
    load();
  }, []);

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

  async function handleSaveRisk(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setSavingRisk(true);
    setRiskMsg(null);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('risk_profiles')
        .upsert({ user_id: userId, level: riskLevel }, { onConflict: 'user_id' });
      if (error) throw error;
      setRiskMsg({ type: 'success', text: 'Risk profile updated.' });
    } catch {
      setRiskMsg({ type: 'error', text: 'Unable to update risk profile. Please try again.' });
    } finally {
      setSavingRisk(false);
      setTimeout(() => setRiskMsg(null), 4000);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="Settings" />
      <main className="flex-1 overflow-y-auto bg-[#F8F9FA] p-4 sm:p-6">
        <div className="mx-auto max-w-2xl space-y-6">

          {/* Profile */}
          <form onSubmit={handleSaveProfile} className="bg-white border border-[#E2E8F0] p-8">
            <h2 className="font-serif text-xl font-light text-[#0A1628] mb-6">Profile</h2>
            <div className="space-y-8">
              <div>
                <label className="block text-[11px] tracking-[0.12em] uppercase text-[#0A1628]/40 mb-1">
                  Full name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full border-b border-[#E2E8F0] py-3 text-sm text-[#0A1628] outline-none focus:border-[#0A1628] bg-transparent transition-colors"
                />
              </div>
              <div>
                <label className="block text-[11px] tracking-[0.12em] uppercase text-[#0A1628]/40 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full border-b border-[#E2E8F0] py-3 text-sm text-[#0A1628]/50 outline-none bg-transparent cursor-not-allowed"
                />
              </div>
              <div className="flex items-center gap-4">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="bg-[#0A1628] text-white text-xs tracking-[0.2em] uppercase h-10 px-6 hover:bg-[#1a2f4a] transition-colors disabled:opacity-50"
                >
                  {savingProfile ? 'Saving...' : 'Save changes'}
                </button>
                {profileMsg && (
                  <p className={cn('text-xs', profileMsg.type === 'success' ? 'text-green-600' : 'text-[#C41E3A]')}>
                    {profileMsg.text}
                  </p>
                )}
              </div>
            </div>
          </form>

          {/* Investment Preferences */}
          <form onSubmit={handleSaveRisk} className="bg-white border border-[#E2E8F0] p-8">
            <h2 className="font-serif text-xl font-light text-[#0A1628] mb-6">Investment Preferences</h2>
            <div className="space-y-8">
              <div>
                <label className="block text-[11px] tracking-[0.12em] uppercase text-[#0A1628]/40 mb-3">
                  Risk tolerance
                </label>
                <div className="space-y-2">
                  {riskOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRiskLevel(opt.value)}
                      className={cn(
                        'w-full border px-5 py-3.5 text-left transition-colors flex items-center justify-between',
                        riskLevel === opt.value
                          ? 'border-[#0A1628] bg-[#F8F9FA]'
                          : 'border-[#E2E8F0] hover:border-[#0A1628]/30',
                      )}
                    >
                      <div>
                        <p className="text-sm font-medium text-[#0A1628]">{opt.label}</p>
                        <p className="text-xs text-[#4A5568] mt-0.5">{opt.description}</p>
                      </div>
                      {riskLevel === opt.value && (
                        <span className="text-[10px] tracking-[0.15em] uppercase text-[#B8960C]">Selected</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button
                  type="submit"
                  disabled={savingRisk}
                  className="bg-[#0A1628] text-white text-xs tracking-[0.2em] uppercase h-10 px-6 hover:bg-[#1a2f4a] transition-colors disabled:opacity-50"
                >
                  {savingRisk ? 'Saving...' : 'Update preferences'}
                </button>
                {riskMsg && (
                  <p className={cn('text-xs', riskMsg.type === 'success' ? 'text-green-600' : 'text-[#C41E3A]')}>
                    {riskMsg.text}
                  </p>
                )}
              </div>
            </div>
          </form>

          {/* Danger Zone */}
          <div className="bg-white border border-red-200 p-8">
            <h2 className="font-serif text-xl font-light text-[#0A1628] mb-2">Danger Zone</h2>
            <p className="text-sm text-[#4A5568] mb-6">Permanently delete your account and all associated data.</p>
            <button className="border border-[#C41E3A] text-[#C41E3A] text-xs tracking-[0.2em] uppercase h-10 px-6 hover:bg-red-50 transition-colors">
              Delete account
            </button>
          </div>

        </div>
      </main>
    </div>
  );
}
