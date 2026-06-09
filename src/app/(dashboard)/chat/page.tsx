'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { useRouter } from 'next/navigation';

// Render **bold** and *italic* markdown inline, and line breaks
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  return lines.map((line, li) => {
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let key = 0;
    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      if (boldMatch && boldMatch.index !== undefined) {
        if (boldMatch.index > 0) parts.push(remaining.slice(0, boldMatch.index));
        parts.push(<strong key={key++}>{boldMatch[1]}</strong>);
        remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
      } else {
        parts.push(remaining);
        break;
      }
    }
    return (
      <span key={li}>
        {parts}
        {li < lines.length - 1 && <br />}
      </span>
    );
  });
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  action?: {
    type: 'trade' | 'rebalance' | 'preference';
    details: Record<string, unknown>;
  };
}

const SUGGESTED_PROMPTS = [
  "What's my biggest risk right now?",
  "Should I buy more of my top position?",
  "How can I protect my portfolio from a crash?",
  "How am I doing vs the S&P 500?",
  "What would you buy with my available cash?",
];

function ActionCard({ action, onConfirm, onDismiss }: {
  action: Message['action'];
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  if (!action) return null;

  const details = action.details;
  let description = '';
  if (action.type === 'trade') {
    description = `${String(details.action).toUpperCase()} ${details.qty} shares of ${details.symbol}`;
  } else if (action.type === 'rebalance') {
    description = String(details.description ?? 'Rebalance portfolio');
  } else {
    description = `Update ${details.setting} to ${details.value}`;
  }

  return (
    <div className="mt-3 border border-[#B8960C] bg-[#B8960C]/5 p-4">
      <p className="text-[10px] tracking-[0.2em] uppercase text-[#B8960C] mb-2">Proposed Action</p>
      <p className="text-sm font-medium text-[#0A1628] mb-3">{description}</p>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          className="bg-[#0A1628] text-white text-[10px] tracking-[0.15em] uppercase px-4 py-2 hover:bg-[#162035] transition-colors"
        >
          Confirm
        </button>
        <button
          onClick={onDismiss}
          className="border border-[#E2E8F0] text-[#4A5568] text-[10px] tracking-[0.15em] uppercase px-4 py-2 hover:border-[#0A1628] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [pendingAction, setPendingAction] = useState<{ msgIdx: number; action: Message['action'] } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const router    = useRouter();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          conversation_history: messages.slice(-10),
        }),
      });
      const data = await res.json() as { message?: string; action?: Message['action']; error?: string };
      const aiMsg: Message = {
        role: 'assistant',
        content: data.message ?? data.error ?? 'Something went wrong.',
        action: data.action,
      };
      setMessages(prev => [...prev, aiMsg]);
      if (data.action) {
        setPendingAction({ msgIdx: messages.length + 1, action: data.action });
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Unable to reach AI. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  }, [loading, messages]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  async function handleConfirmAction() {
    if (!pendingAction?.action) return;
    const { action } = pendingAction;
    setPendingAction(null);

    if (action.type === 'trade' && action.details.symbol) {
      try {
        await fetch('/api/alpaca/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: action.details.symbol,
            qty: Number(action.details.qty),
            side: action.details.action,
          }),
        });
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Order placed: ${String(action.details.action).toUpperCase()} ${action.details.qty} ${action.details.symbol}. Check your holdings to confirm execution.`,
        }]);
      } catch {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Order failed. Please try again or place manually.' }]);
      }
    } else {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Preference noted and saved.' }]);
    }
  }

  const isEmpty = messages.length === 0;

  // router is used for potential future navigation; suppress lint warning
  void router;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="AI Chat" />

      <main className="flex-1 flex flex-col overflow-hidden bg-[#F8F9FA]">

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          {isEmpty ? (
            /* Empty state with suggested prompts */
            <div className="flex flex-col items-center justify-center h-full px-6 py-16 text-center">
              <div className="w-12 h-12 bg-[#0A1628] flex items-center justify-center mb-6">
                <div className="w-1.5 h-1.5 bg-[#B8960C] rounded-full animate-pulse" />
              </div>
              <p className="text-[10px] tracking-[0.3em] uppercase text-[#B8960C] mb-3">Tavola AI</p>
              <h2 className="font-serif text-[28px] font-light text-[#0A1628] mb-2">
                Your AI portfolio manager.
              </h2>
              <p className="text-sm text-[#4A5568] mb-10 max-w-xs leading-relaxed">
                Ask anything about your portfolio, request trades, or run scenario analysis.
              </p>
              <div className="flex flex-col gap-2 w-full max-w-sm">
                {SUGGESTED_PROMPTS.map(prompt => (
                  <button
                    key={prompt}
                    onClick={() => {
                      setInput(prompt);
                      setTimeout(() => inputRef.current?.focus(), 0);
                    }}
                    className="text-left border border-[#E2E8F0] bg-white px-4 py-3 text-[13px] text-[#0A1628] hover:border-[#0A1628] transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] sm:max-w-[75%] ${msg.role === 'user' ? 'ml-auto' : 'mr-auto'}`}>
                    {msg.role === 'user' ? (
                      <div className="bg-[#0A1628] text-white px-5 py-3 text-[14px] leading-relaxed">
                        {msg.content}
                      </div>
                    ) : (
                      <div>
                        <div className="border-l-2 border-[#B8960C] bg-white px-5 py-4 text-[14px] text-[#0A1628] leading-relaxed shadow-sm">
                          {renderMarkdown(msg.content)}
                        </div>
                        {msg.action && pendingAction?.msgIdx === i && (
                          <ActionCard
                            action={msg.action}
                            onConfirm={handleConfirmAction}
                            onDismiss={() => setPendingAction(null)}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <div className="flex justify-start">
                  <div className="border-l-2 border-[#B8960C] bg-white px-5 py-4 shadow-sm">
                    <div className="flex items-center gap-1.5">
                      {[0, 1, 2].map(i => (
                        <span
                          key={i}
                          className="h-1.5 w-1.5 bg-[#B8960C] rounded-full animate-pulse"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-[#E2E8F0] bg-white px-4 py-4">
          <div className="max-w-2xl mx-auto flex gap-3 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your portfolio, request a trade, or run a scenario..."
              rows={1}
              className="flex-1 border border-[#E2E8F0] px-4 py-3 text-[14px] text-[#0A1628] outline-none focus:border-[#0A1628] transition-colors resize-none placeholder:text-[#0A1628]/40 bg-white"
              style={{ minHeight: 44, maxHeight: 120 }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="bg-[#0A1628] text-white text-[11px] tracking-[0.2em] uppercase px-5 py-3 h-11 hover:bg-[#162035] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              Send
            </button>
          </div>
          <p className="max-w-2xl mx-auto mt-2 text-[10px] text-[#4A5568]/50">
            Press Enter to send · Shift+Enter for new line · AI may make errors — verify trades before confirming
          </p>
        </div>

      </main>
    </div>
  );
}
