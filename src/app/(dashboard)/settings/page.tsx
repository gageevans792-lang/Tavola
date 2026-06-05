import { TopBar } from '@/components/layout/TopBar';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="Settings" />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-6 dark:bg-gray-950">
        <div className="mx-auto max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <div className="space-y-4">
              {['Full name', 'Email'].map((label) => (
                <div key={label}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
                  <input
                    type={label === 'Email' ? 'email' : 'text'}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>
              ))}
              <Button>Save changes</Button>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Investment Preferences</CardTitle>
            </CardHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Risk tolerance</label>
                <select className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white">
                  <option value="conservative">Conservative</option>
                  <option value="moderate">Moderate</option>
                  <option value="aggressive">Aggressive</option>
                </select>
              </div>
              <Button>Update preferences</Button>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Danger Zone</CardTitle>
            </CardHeader>
            <Button variant="danger">Delete account</Button>
          </Card>
        </div>
      </main>
    </div>
  );
}
