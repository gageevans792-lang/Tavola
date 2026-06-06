import { TopBar } from '@/components/layout/TopBar';

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="Settings" />
      <main className="flex-1 overflow-y-auto bg-[#F8F9FA] p-6">
        <div className="mx-auto max-w-2xl space-y-6">

          {/* Profile */}
          <div className="bg-white border border-[#E2E8F0] p-8">
            <h2 className="font-serif text-xl font-light text-[#0A1628] mb-6">Profile</h2>
            <div className="space-y-8">
              {(['Full name', 'Email'] as const).map((label) => (
                <div key={label}>
                  <label className="block text-[11px] tracking-[0.12em] uppercase text-[#0A1628]/40 mb-1">
                    {label}
                  </label>
                  <input
                    type={label === 'Email' ? 'email' : 'text'}
                    className="w-full border-b border-[#E2E8F0] py-3 text-sm text-[#0A1628] outline-none focus:border-[#0A1628] bg-transparent transition-colors"
                  />
                </div>
              ))}
              <button className="bg-[#0A1628] text-white text-xs tracking-[0.2em] uppercase h-10 px-6 hover:bg-[#1a2f4a] transition-colors">
                Save changes
              </button>
            </div>
          </div>

          {/* Investment Preferences */}
          <div className="bg-white border border-[#E2E8F0] p-8">
            <h2 className="font-serif text-xl font-light text-[#0A1628] mb-6">Investment Preferences</h2>
            <div className="space-y-8">
              <div>
                <label className="block text-[11px] tracking-[0.12em] uppercase text-[#0A1628]/40 mb-1">
                  Risk tolerance
                </label>
                <select className="w-full border-b border-[#E2E8F0] py-3 text-sm text-[#0A1628] outline-none focus:border-[#0A1628] bg-transparent transition-colors">
                  <option value="conservative">Conservative</option>
                  <option value="moderate">Moderate</option>
                  <option value="aggressive">Aggressive</option>
                </select>
              </div>
              <button className="bg-[#0A1628] text-white text-xs tracking-[0.2em] uppercase h-10 px-6 hover:bg-[#1a2f4a] transition-colors">
                Update preferences
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-white border border-red-200 p-8">
            <h2 className="font-serif text-xl font-light text-[#0A1628] mb-2">Danger Zone</h2>
            <p className="text-sm text-[#4A5568] mb-6">Permanently delete your account and all data.</p>
            <button className="border border-red-500 text-red-600 text-xs tracking-[0.2em] uppercase h-10 px-6 hover:bg-red-50 transition-colors">
              Delete account
            </button>
          </div>

        </div>
      </main>
    </div>
  );
}
