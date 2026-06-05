'use client';

import { useState } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DollarSign } from 'lucide-react';

const amounts = [500, 1000, 2500, 5000];

export default function DepositPage() {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDeposit = async () => {
    const value = parseFloat(amount);
    if (!value || value <= 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Math.round(value * 100) }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="Deposit" />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-6 dark:bg-gray-950">
        <div className="mx-auto max-w-md space-y-6">
          <Card>
            <div className="flex items-center gap-3 mb-6">
              <div className="rounded-lg bg-green-50 p-2 dark:bg-green-900/30">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">Add funds</h2>
                <p className="text-sm text-gray-500">Funds are available instantly after payment.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {amounts.map((a) => (
                <button
                  key={a}
                  onClick={() => setAmount(String(a))}
                  className={`rounded-lg border-2 py-3 text-sm font-medium transition-colors ${
                    amount === String(a)
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:text-gray-300'
                  }`}
                >
                  ${a.toLocaleString()}
                </button>
              ))}
            </div>

            <div className="relative mb-4">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Custom amount"
                className="block w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>

            <Button className="w-full" onClick={handleDeposit} loading={loading} disabled={!amount || parseFloat(amount) <= 0}>
              Deposit {amount ? `$${parseFloat(amount).toLocaleString()}` : ''}
            </Button>
          </Card>
        </div>
      </main>
    </div>
  );
}
