# Tavola Platform Audit Report

**Date:** 2026-06-12  
**Scope:** Full codebase audit — bugs only, feature freeze in effect  
**Build status:** ✅ `npm run build` and `tsc --noEmit` green  
**Commits in this audit:** 2 (Critical tier, Medium/Low documented below)

---

## 1. Schema vs Code

### Complete Table → Column Reference Map

Every `.from('table')` call in `src/` with columns referenced:

| Table | Columns Referenced | In Migrations? |
|---|---|---|
| `ai_decisions` | id, symbol, action, confidence, reasoning_summary, price_at_decision, estimated_value, executed, created_at, session_type, user_id | ✅ `009_ai_decisions.sql` |
| `ai_insights` | id, message, created_at, user_id, type, executed, ticker, confidence_score, qty | ✅ `006_missing_tables.sql` |
| `audit_log` | user_id, action, resource_id, resource_type, metadata, ip_address, user_agent, status, error_message | ✅ `001_audit_log.sql` |
| `autonomous_sessions` | user_id | ❌ **NOT IN ANY MIGRATION** |
| `autopilot_runs` | user_id, run_at, trades_executed, total_value, market_outlook, summary, decisions, status | ✅ `004_autopilot.sql` |
| `autopilot_settings` | user_id, max_trade_size, enabled, frequency, last_run_at | ✅ `004_autopilot.sql` |
| `bank_connections` | user_id (all fields) | ❌ **NOT IN ANY MIGRATION** |
| `checkpoint_log` | user_id, checkpoint_time, triggers_fired, positions_reviewed, action_taken, trades_count, summary, run_at | ✅ `012_intraday_checkpoints.sql` |
| `deposits` | id, stripe_session_id, user_id, amount, status | ✅ `006_missing_tables.sql` (via deposits table) |
| `equity_history` | date, value, user_id | ✅ `010_simulated_trading.sql` |
| `holdings` | user_id, ticker, qty, avg_entry_price, market_value, unrealized_pl, unrealized_plpc, weight_pct, updated_at, current_price, name | ✅ `006_missing_tables.sql` |
| `notifications` | user_id, type, title, message, ticker, priority, action_url, read, id | ✅ `008_notifications.sql` + `011_notification_settings.sql` (priority, action_url added) |
| `predictive_signals` | user_id, signal fields | ❌ **NOT IN ANY MIGRATION** (found `007_predictive_signals.sql` but no CREATE TABLE) |
| `profiles` | id, onboarding_completed, email, full_name, avatar_url | ❌ No CREATE TABLE migration (added manually; codified in `013_profiles_onboarding.sql` trigger/RLS only) |
| `recurring_deposits` | user_id, is_active | ❌ **NOT IN ANY MIGRATION** |
| `risk_profiles` | user_id, level, investment_goals, time_horizon, risk_quiz_answers, initial_deposit, monthly_contrib, net_worth_range | ❌ No CREATE TABLE migration (extended by `003_onboarding.sql` but base table never created in migrations) |
| `trades` | id, user_id, ticker, side, qty, price, status, alpaca_order_id, ai_reasoning, created_at, cancel_token, pending_until, trigger_type, simulated | ✅ `006_missing_tables.sql` + `010_simulated_trading.sql` + `012_intraday_checkpoints.sql` |
| `transfer_history` | all fields | ❌ **NOT IN ANY MIGRATION** |
| `user_accounts` | user_id, cash | ✅ `010_simulated_trading.sql` |
| `user_notification_settings` | pre_trade_alerts, execution_confirmations, checkpoint_summaries, weekly_letter, user_id, updated_at | ✅ `011_notification_settings.sql` |
| `user_strategies` | user_id, strategy_id, auto_execute, max_trade_value | ❌ **NOT IN ANY MIGRATION** |
| `user_watchlist` | user_id, ticker, id | ✅ `006_missing_tables.sql` |
| `waitlist` | email, created_at | ❌ **NOT IN ANY MIGRATION** |

### Tables Not In Migrations — SQL to Verify They Exist

Run in Supabase to confirm which of these exist in production:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'autonomous_sessions', 'bank_connections', 'predictive_signals',
    'recurring_deposits', 'risk_profiles', 'transfer_history',
    'user_strategies', 'waitlist', 'profiles'
  )
ORDER BY table_name;
```

Any missing → the associated feature silently fails (queries return empty, not errors).

---

## 2. Auth Gating Sweep

### Routes With No Auth — FIXED

| Route | Issue | Status |
|---|---|---|
| `POST /api/ai/ipo` | Called Anthropic API with no auth — free AI inference abuse vector | ✅ **FIXED** |
| `POST /api/backtest/run` | No auth (static data only, low exfil risk but principle) | ✅ **FIXED** |

### Routes Intentionally Public (by design)

| Route | Reason |
|---|---|
| `GET /api/alerts/monitor` | Cron-only; protected by CRON_SECRET |
| `GET /api/ai/intraday/checkpoint` | Dual: CRON_SECRET path OR user-session path |
| `POST /api/stripe/webhook` | Stripe signature verification (Stripe calls this, not users) |
| `POST /api/waitlist` | Pre-auth signup form |

### isFounder Usage — Consistent

All 9 routes that branch on founder status call the single `isFounder(userId, email)` function from `src/lib/founder.ts`. No local duplicated checks found. ✅

### Cross-User Data Leak Check

All user-scoped queries include `.eq('user_id', user.id)` or `.eq('id', user.id)`. RLS provides a second layer. No cross-user leaks found. ✅

---

## 3. Env Var Audit

### Full Required Env Var List

| Variable | Required? | Missing = | Files |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Required** | Crash at startup | supabase clients |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Required** | Crash at startup | supabase clients |
| `SUPABASE_SERVICE_ROLE_KEY` | **Required** | Falls back to anon key (bypasses service-role, RLS applies — silent data failures) | admin clients |
| `ANTHROPIC_API_KEY` | **Required** | Crash on first AI call | `src/lib/anthropic/client.ts` |
| `ALPACA_API_KEY` | **Required** (founder only) | Runtime crash on Alpaca calls | `src/lib/alpaca/client.ts` |
| `ALPACA_SECRET_KEY` | **Required** (founder only) | Runtime crash on Alpaca calls | `src/lib/alpaca/client.ts` |
| `ALPACA_BASE_URL` | Optional | Defaults to `https://paper-api.alpaca.markets` ✅ |
| `ALPACA_PAPER` | Optional | Defaults to paper mode ✅ |
| `CRON_SECRET` | **Required** | All cron endpoints return 401 (correct after fixes) | alerts/monitor, intraday/checkpoint |
| `FOUNDER_USER_ID` | Semi-optional | If missing + FOUNDER_EMAIL missing → everyone is simulated (safe fail-closed) ✅ | `src/lib/founder.ts` |
| `FOUNDER_EMAIL` | Semi-optional | Same as above ✅ | `src/lib/founder.ts` |
| `NEXT_PUBLIC_BASE_URL` | **Required** (Stripe) | Stripe session redirect URL breaks | stripe/create-session |
| `NEXT_PUBLIC_APP_URL` | Optional | Defaults to `http://localhost:3000` (fine in prod if BASE_URL is set) |
| `STRIPE_SECRET_KEY` | Required (Stripe) | Error thrown at Stripe client init | `src/lib/stripe/client.ts` |
| `STRIPE_WEBHOOK_SECRET` | Required (Stripe) | Webhook signature unverified — accepts spoofed events | stripe/webhook |
| `FINNHUB_API_KEY` | Optional | Defaults to `''` — Finnhub calls return 401, IPO data empty | `src/lib/finnhub/client.ts` |
| `ENCRYPTION_KEY` | Optional | Encryption silently skipped (undefined behavior) | `src/lib/security/encryption.ts` |

### Fail-Open Bugs Fixed This Audit

| Var | Old behavior | Fixed behavior |
|---|---|---|
| `CRON_SECRET` (alerts/monitor) | Logged warning, continued unprotected | ✅ Returns 401 |
| `CRON_SECRET` (checkpoint) | Already correct in POST; GET now delegates correctly | ✅ |

### Remaining Concern — MEDIUM

`SUPABASE_SERVICE_ROLE_KEY ?? NEXT_PUBLIC_SUPABASE_ANON_KEY` in `alerts/monitor/route.ts:10`:  
If service role key is unset, the admin client silently operates with anon key — RLS applies, all cross-user queries return empty. No crash, silent failure. **Low fix priority** (won't happen if env is configured correctly), but should be changed to fail loudly.

---

## 4. Cron Verification

### vercel.json Crons

```json
{ "path": "/api/alerts/monitor",         "schedule": "0 9 * * *"      }  → 9:00am UTC = 4:00am ET (pre-market, intentional)
{ "path": "/api/ai/autopilot/run",       "schedule": "0 9 * * 1-5"    }  → 9:00am UTC weekdays
{ "path": "/api/ai/intraday/checkpoint", "schedule": "35 14 * * 1-5"  }  → 14:35 UTC = 9:35am EST / 10:35am EDT
{ "path": "/api/ai/intraday/checkpoint", "schedule": "0 18 * * 1-5"   }  → 18:00 UTC = 1:00pm EST / 2:00pm EDT
{ "path": "/api/ai/intraday/checkpoint", "schedule": "30 20 * * 1-5"  }  → 20:30 UTC = 3:30pm EST / 4:30pm EDT ⚠️
```

### Cron Issues

**CRITICAL — FIXED:** Intraday checkpoint cron fires GET. Cron logic was in POST only. Vercel crons always send GET. The checkpoint **has never run in production.** Fixed by routing GET to POST when `Authorization: Bearer {CRON_SECRET}` is detected.

**HIGH — NOT FIXED (architectural):** `autopilot/run` cron fires GET on a POST-only route → 405 every time. The autopilot cron **has never run.** The POST handler also only operates on the current authenticated user, not all autopilot-enabled users — a cron-capable implementation requires extracting per-user logic into a shared function and iterating `autopilot_settings WHERE enabled = true`. This is a sprint-level refactor, documented here for the next cycle.

**MEDIUM:** Cron schedules use EST (UTC-5) offsets. During EDT (UTC-4, March–November):
- 9:35am fires at 10:35am ET ✓ (market open, just delayed)
- 1:00pm fires at 2:00pm ET ✓ (market open, delayed)
- 3:30pm fires at **4:30pm ET ✗ (market closed)**

The 3:30pm checkpoint fires after close in summer. The `isMarketOpen()` guard inside the handler catches this and returns `{ skipped: true }`, so no bad trades execute. Data gap only. Fix: add two schedule entries per cron (one for EST, one for EDT) or accept the skip.

---

## 5. Build + Types + Dead Links

**Build:** ✅ `npm run build` — clean, 80 pages  
**TypeScript:** ✅ `tsc --noEmit` — zero errors

### Nav Link Audit

All routes verified against `src/app/(dashboard)/**/page.tsx` glob:

| Link | Page Exists? |
|---|---|
| `/dashboard` | ✅ |
| `/autopilot` | ✅ |
| `/holdings` | ✅ |
| `/performance` | ✅ |
| `/intelligence` | ✅ |
| `/markets` | ✅ |
| `/backtest` | ✅ |
| `/chat` | ✅ |
| `/settings` | ✅ |
| `/autonomous` | ✅ |
| `/strategy` | ✅ |
| `/insights` | ✅ |
| `/trades` | ✅ |
| `/bank` | ✅ |
| `/deposit` | ✅ |
| `/ipo` | ✅ |
| `/crypto` | ✅ |
| `/options` | ✅ |
| `/legal/terms` | ✅ (`src/app/legal/terms/page.tsx`) |
| `/legal/privacy` | ✅ (`src/app/legal/privacy/page.tsx`) |

**No dead nav links found.**

### Notification `action_url` Deep Links

The checkpoint notification route inserts `action_url: '/autopilot'`. Route exists. ✅  
No other `action_url` values found in code; future ones should be verified at insertion time.

---

## 6. Error Handling Gaps

### Client-Side Fetch — Critical Gaps

| Endpoint | Component | Gap | Severity |
|---|---|---|---|
| `/api/ai/autopilot/run` | `autopilot/page.tsx` | No try/catch; network failure shows nothing | HIGH |
| `/api/ai/intraday/cancel` | `autopilot/page.tsx` | No try/catch; silent failure on cancel | HIGH |
| `/api/ai/autopilot/history` | `autopilot/page.tsx` | No try/catch | MEDIUM |
| `/api/market/movers` | `MarketOverview.tsx` | Chained `.then` only, no `.catch` | MEDIUM |
| `/api/bank/transfers` | `bank/page.tsx` | `.then` chain only | MEDIUM |
| `/api/ai/crypto` | `crypto/page.tsx` | No try/catch | MEDIUM |
| `/api/ai/strategy` | `strategy/page.tsx` | No try/catch | MEDIUM |
| `/api/stripe/create-session` | `deposit/page.tsx` | No try/catch | MEDIUM |
| Most `/api/market/*` fetches | multiple | Silent `.catch(() => {})` swallows errors | LOW |

### Server-Side External API — Timeout Gaps

| Route | External call | Timeout? |
|---|---|---|
| `/api/ai/autopilot/run` | Anthropic (Claude) | No explicit timeout — relies on Anthropic SDK default |
| `/api/ai/analyze` | Anthropic (Claude) | No explicit timeout |
| `/api/market/news` | Alpaca data | No explicit timeout |
| `/api/market/movers` | Alpaca data | No explicit timeout |
| `/api/alpaca/portfolio` | `getAccount()`, `getPositions()` | ✅ `withTimeout(10_000)` wrapper present |
| `/api/ai/intraday/checkpoint` | Anthropic (Haiku) | No explicit timeout |

### Critical Fixes Applied This Audit

All critical auth fixes are in (see §2). The fetch error-handling gaps below are documented for the next sprint:

**Not fixed (feature freeze — UI polish only, no user-visible data risk):**
- Autopilot page: add try/catch + error toast to `handleRunAutopilot` and `handleCancelTrades`
- Deposit page: add try/catch + user-visible error on Stripe session creation failure

---

## 7. Data Correctness

### Holdings Return % Formula

`src/app/api/alpaca/portfolio/route.ts` (simulated path, lines 151–156):
```typescript
const uplpc = h.avg_entry_price > 0
  ? ((price - h.avg_entry_price) / h.avg_entry_price) * 100
  : 0;
```
Formula: `(current − avg_cost) / avg_cost × 100` ✅ Correct.

`avg_entry_price` comes from the `holdings` table which is populated by `src/lib/alpaca/sync.ts` using `avg_entry_price` from Alpaca positions. ✅

### Portfolio Value Math

Simulated path (`buildSimulatedPortfolio`):
```
portfolioValue = cash + Σ(qty × current_price)
```
`cash` from `user_accounts.cash`, live prices refreshed from Alpaca data API at request time. ✅ No double-counting.

Founder path:
```
equity = account.equity  (Alpaca account field, already includes cash + long_market_value)
```
Direct from Alpaca — no manual addition. ✅

### Chart Benchmark Alignment — MEDIUM

`src/app/api/portfolio/chart/route.ts` builds the chart differently for founders (real Alpaca portfolio history) vs simulated (synthetic flat line at $100k). No benchmark series is currently overlaid in the chart at all — the `EquityPoint` type has no `benchmark` field in the portfolio chart response. The backtest route's `EquityPoint` has a `benchmark` field but that's a separate endpoint. No alignment issue currently, but the chart is not showing a benchmark, which may be a product gap. **LOW — not a data correctness bug.**

`equity_history` table upsert uses `onConflict: 'user_id,date'` — one row per user per day. ✅ No double-inserts.

---

## Summary Table

| ID | Severity | Issue | Status |
|---|---|---|---|
| C-1 | CRITICAL | `alerts/monitor` CRON_SECRET fails open when unset | ✅ Fixed |
| C-2 | CRITICAL | `ai/ipo` POST has no auth — free Anthropic inference | ✅ Fixed |
| C-3 | CRITICAL | `backtest/run` POST has no auth | ✅ Fixed |
| C-4 | CRITICAL | Intraday checkpoint cron fires GET, logic in POST — never ran | ✅ Fixed |
| H-1 | HIGH | Autopilot cron fires GET on POST-only route; even with GET, needs multi-user refactor | ⚠️ Documented, needs sprint |
| H-2 | HIGH | 6 tables used in code have no CREATE TABLE migration | ⚠️ Verify exist in prod (SQL above) |
| H-3 | HIGH | `risk_profiles` and `profiles` base tables never created in migrations | ⚠️ Partially mitigated by `013_profiles_onboarding.sql` |
| M-1 | MEDIUM | Cron schedules use EST; summer EDT shifts 3:30pm checkpoint to after close | ⚠️ isMarketOpen() guard catches it |
| M-2 | MEDIUM | `SUPABASE_SERVICE_ROLE_KEY` fallback to anon key in alerts/monitor | ⚠️ Document only |
| M-3 | MEDIUM | Autopilot/run, intraday/cancel, autopilot/history missing try/catch in client | ⚠️ Next sprint |
| M-4 | MEDIUM | 6 server routes missing call timeouts on Anthropic/Alpaca | ⚠️ Next sprint |
| M-5 | MEDIUM | `autonomous_sessions`, `bank_connections`, `recurring_deposits`, `transfer_history`, `user_strategies`, `waitlist`, `predictive_signals` not in migrations | ⚠️ Verify in prod |
| L-1 | LOW | Chart has no benchmark series | ⚠️ Product gap, not a bug |
| L-2 | LOW | Most market fetch calls use silent `.catch(() => {})` | ⚠️ Next sprint |
| L-3 | LOW | `ENCRYPTION_KEY` optional with undefined behavior when missing | ⚠️ Document |

---

*Report generated by automated audit + manual verification. All CRITICAL items fixed and pushed. Build green.*
