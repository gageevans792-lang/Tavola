'use client';

import { useState } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AIFeed } from '@/components/dashboard/AIFeed';
import { AIInsight } from '@/types';
import { Sparkles } from 'lucide-react';

export default function InsightsPage() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<AIInsight[]>([]);

  const analyze = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      setInsights((prev) => [data, ...prev]);
      setPrompt('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="AI Insights" />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-6 dark:bg-gray-950">
        <div className="mx-auto max-w-3xl space-y-6">
          <Card>
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-indigo-50 p-2 dark:bg-indigo-900/30">
                <Sparkles className="h-5 w-5 text-indigo-600" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-gray-900 dark:text-white">Ask the AI</h2>
                <p className="text-sm text-gray-500">Ask about stocks, your portfolio, or market trends.</p>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <textarea
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                rows={3}
                placeholder="e.g. Should I increase my AAPL position given current macro conditions?"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>
            <Button className="mt-3" onClick={analyze} loading={loading} disabled={!prompt.trim()}>
              Analyze
            </Button>
          </Card>

          <AIFeed insights={insights} />
        </div>
      </main>
    </div>
  );
}
