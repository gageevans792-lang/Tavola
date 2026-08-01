# Tavola Demo-Readiness Report

**Date:** 2026-06-13  
**Build:** Clean (0 TypeScript errors, 0 warnings)  
**Commits this session:** 5 (Sections 1–5)

---

## Section 1 — Data Integrity ✅

**Problem:** Portfolio route was wipe+inserting the founder's holdings table on every page load — creating race conditions with other routes that read that table. Performance and intelligence routes read stale holdings-table data instead of live Alpaca data.

**Fixes:**
- Created `src/lib/portfolio/state.ts` — `getFounderPositions()` as the canonical live-Alpaca source; never reads the holdings table.
- `/api/alpaca/portfolio` founder path: removed all DB writes. `SyncedHolding[]` now built in-memory from the positions already fetched from Alpaca (Step 2 → Step 3 is now pure mapping, no wipe/insert).
- `/api/performance` founder path: replaced holdings-table read with `getPositions()` call (fetched in parallel with trades query). Win-rate, best/worst now reflect live positions.
- `/api/portfolio/intelligence` founder path: replaced holdings-table read with `getPositions()` + `getAccount()` in a single parallel call. Finnhub data then fetched for those live tickers.

**Result:** Dashboard, Holdings, Performance, and Intelligence pages all derive from the same live Alpaca session. No page reads the holdings table for the founder.

**Cleanup SQL for stale founder rows (run in Supabase Dashboard):**
```sql
-- Only run after confirming the founder's user_id
DELETE FROM holdings WHERE user_id = '167fb974-021c-4e27-a30c-5a103fcfd647';
```

---

## Section 2 — Market Data Reliability ✅

**Already passing:** Per-ticker isolation (snapshot → trade → bar fallback), 8s timeout, `Promise.allSettled` in sentiment engine, correlation min-30-bars threshold, new-listing confidence caps.

**Fix applied:**
- `HoldingsTable.tsx`: guarded `current_price`, `avg_entry_price`, `market_value`, P&L, and P&L% cells against zero/unavailable values. Now shows `–` instead of silent `$0.00` when a price refresh fails — consistent with Watchlist and Markets page behavior.

---

## Section 3 — Notifications & Settings ✅

**Problems:**
1. Autopilot (`/api/ai/autopilot/run`) and Autonomous (`/api/ai/autonomous`) routes executed trades without creating any notifications.
2. Settings page had the 4 notification toggles but no display of checkpoint times.

**Fixes:**
- `autopilot/run/route.ts`: Before the trade loop, loads `user_notification_settings.execution_confirmations`. After each successful Alpaca or simulated fill, fires a non-blocking `notifications.insert` if the setting is on.
- `autonomous/route.ts`: Added `supabaseAdmin`; before the auto-execute loop, loads notification settings; after each successful `placeMarketOrder`, fires a non-blocking notification.
- `settings/page.tsx`: Added checkpoint schedule display under "Checkpoint summaries" toggle — `Schedule: 9:35 AM · 1:00 PM · 3:30 PM ET`.

**Already correct:** CRON_SECRET fail-closed validation (empty secret → 401), all 4 notification toggles persist to `user_notification_settings` via PATCH, checkpoint route creates all 3 notification types (pre-trade, execution confirmation, checkpoint summary).

---

## Section 4 — No Broken Surfaces ✅

**Audit findings:**
- All primary nav links resolve to existing pages (desktop and mobile).
- Notification `action_url` values (`/trades`, `/autopilot`) are valid pages.
- No hardcoded mock/demo data found in user-facing components.
- Performance, Intelligence, and Trades pages all have loading skeletons and error states.

**Fix applied:**
- `crypto/page.tsx`: positions table guarded `parseFloat` results with `|| 0` fallback. Cells show `–` for zero market value rather than `$NaN` or `$0.00`.

---

## Section 5 — Security ✅

**Problem:** `notifications` and `predictive_signals` tables had no Row-Level Security. Any authenticated user could read any other user's notifications and signals. The `/security` page claimed "RLS enforced on every table" — which was false.

**Fix:**
- New additive migration `supabase/migrations/015_rls_notifications_signals.sql`:
  - `ALTER TABLE notifications ENABLE ROW LEVEL SECURITY`
  - Policy: `"notifications: own rows"` — FOR ALL USING (auth.uid() = user_id)
  - `ALTER TABLE predictive_signals ENABLE ROW LEVEL SECURITY`
  - Policy: `"predictive_signals: own rows"` — FOR ALL USING (auth.uid() = user_id)
- Migration is idempotent (DO $$ / IF NOT EXISTS guards).

**Already passing:** No secrets in client bundle (all Alpaca/Supabase service-role keys are server-side only, no NEXT_PUBLIC_ prefix). AES-256-GCM field encryption implemented. All other 18 user-data tables had RLS + own-row policies.

**⚠ Action required:** Apply migration `015_rls_notifications_signals.sql` in Supabase Dashboard (SQL Editor → paste file contents → Run).

---

## Commit History

| Commit | Section | Summary |
|--------|---------|---------|
| `9cf6711` | 1 | Data integrity: single source of truth, remove portfolio DB writes |
| `cbdc5ad` | 2 | Market data: `–` for unavailable prices in HoldingsTable |
| `ca2e58c` | 3 | Notifications: trade notifications for autopilot + autonomous |
| `023f9f5` | 4 | No broken surfaces: guard NaN in crypto positions table |
| `b3f687c` | 5 | Security: RLS migration for notifications + predictive_signals |

All commits pushed to `main`. Build is clean at every commit.
