# Nexday: handoff notes

Mac planner app (Electron + Vite + React + TypeScript). The owner speaks Turkish and prefers short status updates and approval after each chunk of work. Replies to them in Turkish.

## What it is
A day planner: Today, Inbox, Calendar, Tasks, Notes, Habits, Projects, Settings, Focus mode, login/onboarding. The UI was built pixel-for-pixel from a Doop design canvas (`TM7q9Gahtd`, reference PNGs in `ref/`). Mac only for now.

## Where things are
- Project: `~/nexday` (moved out of iCloud on purpose; iCloud broke `codesign`). Git repository (local, no remote yet).
- Run: `npm run dev` (Electron). Quick browser preview: `.claude/launch.json` serves `out/renderer` on port 5199 after `./node_modules/.bin/electron-vite build`.
- Check: `./node_modules/.bin/tsc --noEmit -p tsconfig.web.json --composite false` and the same with `tsconfig.node.json`.
- Package (Apple Silicon, ad-hoc signed, no Developer ID yet):
  `npm run build:eventkit && ./node_modules/.bin/electron-vite build && CSC_IDENTITY_AUTO_DISCOVERY=false ./node_modules/.bin/electron-builder --mac dmg zip --arm64 -c.mac.identity=- -c.mac.hardenedRuntime=false -c.directories.output=$HOME/nexday-release4`
  (the last built .app is `~/nexday-release3/mac-arm64/Nexday.app`; Google sign-in only works from a packaged app, because macOS routes `nexday://` links to registered apps only).
- Config: `.env` holds `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (public key, gitignored). Never put a secret/service key in the app.

## Code map (`src/renderer/src`)
- `styles/` tokens (spacing, colors), shell, components, `motion.css` (all animation tokens and rules).
- `components/` shared UI: `Sidebar`, `AppShell`, `Drawer`, popups, dialogs, `QuickCapture` + `GhostInput` (the one capture bar used everywhere), `CommandPalette`, `NewPopup`, `Pickers`.
- `pages/` today, inbox, tasks (+ empty/error/loading at `/tasks/empty|error|loading`), calendar, notes, habits, projects, settings, entry (launch/login/register/forgot/onboarding), focus.
- `store/` zustand stores (tasks, inbox, habits, notifs, projects, notes, ui, auth, calendar).
- `lib/cloud.ts` Supabase sync (load after sign-in, watch stores and save every change, seed sample data once for a new account; `SAMPLE_DATA` flag). `lib/supabase.ts` client (session kept in the Mac keychain via main process). `lib/clock.ts` is live: `appToday()` returns the real date, with `startOfWeek`/`startOfMonth`/`dayKey`/`parseDayKey`/`pageDate` helpers. `lib/capture.ts` regex quick-capture parser. `lib/persist.ts` local JSON cache (disabled when Supabase is configured).
- Main process (`src/main`): `storage.ts` (JSON file), `secure.ts` (keychain-encrypted values), `calendar.ts` + `native/eventkit/main.swift` (Mac Calendar via EventKit: read, create, delete), `nexday://` deep link handling in `index.ts`.

## Backend (Supabase project `xsullpmifpyxkkbguznp`, URL https://xsullpmifpyxkkbguznp.supabase.co)
- Edge Functions in `supabase/functions/`: `ai` (Gemini), `billing` (Stripe Checkout), `stripe-webhook`. None are deployed yet; each file header lists the secrets it needs.
- Schema in `supabase/migrations/0001_init.sql` and `0002_habit_meta.sql`, both already applied (through the dashboard SQL editor; no CLI link). 14 tables, row level security on all, signup trigger creates profile and a 14-day trial, `plans` table holds limits (free: 5 projects, 50 notes, 1 calendar, 200 AI/month; Pro $6).
- Auth: email+password and Google. Redirect URL `nexday://auth/callback` is allowed. Email confirmation is on; Supabase's default email sender is rate-limited, a real SMTP (Resend/Brevo) is still needed.
- Google Cloud project `nexday-515118` ("Nexday"), OAuth consent in Testing mode with the owner's Gmail as the only test user, Web client whose redirect is the Supabase callback. Google sign-in was tested by the owner and works.
- Cloud-synced today: tasks, inbox, habits (+ check-ins), notifications, custom projects, notes (with body/metadata in `notes.body` JSON), events created inside Nexday (all-day, rrule, Mac external id), two UI settings (autoSchedule, pauseNotifs). Sample notes are seeded once per account (flagged `settings.notesSeeded`), staggered a second apart so list order survives `order by created_at`.

## Decisions already made
Cloud accounts with Supabase free tier. AI = Gemini free tier (key must live in a Supabase Edge Function secret, never in the app; note the free tier may use content for training, so move to paid before public launch). Mac only. No Apple sign-in. Google Calendar API and Gmail inbox come later (Google verification is slow; Gmail needs a security assessment). Mac Calendar already covers Google calendars through EventKit. Payment shows $6 Pro, limits may change (so keep them in the `plans` table).

## Not done yet (suggested order)
1. Real SMTP for confirmation/reset emails (dashboard-only, needs the owner). The in-app reset flow is done: `/reset` + `recovery` state in `store/auth.ts` (the reset request leaves a 1-hour flag, the opened link leaves a pending flag that survives a restart; both are cleared on save/cancel).
   - Resend or Brevo account, verify a domain (`onboarding@resend.dev` works for testing).
   - Supabase Dashboard → Authentication → Emails → SMTP: host `smtp.resend.com`, port 465 (SSL) or 587 (STARTTLS), user `resend`, password = API key, sender `no-reply@<domain>`. No secret goes in the app or this repo.
   - Test from a **packaged** app (only registered apps receive `nexday://` links): Forgot password → email → link → app opens on “Set a new password”.
2. Apply the saved Preferences across the UI (date/time format, density, start page), and implement “Move unfinished tasks” (needs a stored date on tasks; the current groups have none). “Reserve time for habits” is wired into the planner; “Ask before changing the plan” is inherent in the Auto-schedule preview.
3. Native notifications, launch at login, editable keyboard shortcuts, drag and drop on Calendar/Board, real notes editor (notes can be created and read now, not edited), subtask editing, event rescheduling.
4. Release: Apple Developer ID + notarization, auto-update, Intel/universal build, crash reporting, privacy policy and terms, git repository, tests (none yet), account deletion flow.
5. Optional: rotate the Google OAuth client secret (it appeared in a chat once), publish the Google app out of Testing.

## Calendar done
- Real dates + week/month/day navigation; recurring and all-day events are supported end to end (DB, grid, drawer, delete).
- Recurrence shapes: daily / weekly / every weekday / monthly (`FREQ=DAILY|WEEKLY|MONTHLY`, `BYDAY`, `INTERVAL`, `UNTIL`). Anything else in `rrule` is shown once. Recurring Mac events arrive already expanded from EventKit.
- Write-back: a Nexday event is saved into Mac Calendar's default calendar when access is authorized; its EventKit id is kept in `events.external_id` (and `base` is de-duplicated against it). Delete removes it from Mac too. Editing/rescheduling an existing Nexday event does not update the Mac copy yet.
- The November-2026 `monthOnly` filler in `data/calendar.ts` is temporary sample content for the design month.

## Planning done
- `lib/planning.ts` fits no-time tasks into the next work day: work window 09:00–18:00, lunch, buffer around events/lunch/existing tasks, default length, energy curve (deep work in the morning, light after 12:00, daily deep-focus cap).
- Auto-schedule dialog (Tasks page button and command palette → “Plan my afternoon”) previews the real placements and only applies them on confirm; per-run energy/buffer overrides do not change saved settings.
- Settings › Planning is wired to `ui.planning` and saved to `profiles.settings` (also in the local JSON cache when there is no account). Time values move in 30-minute steps on click.
- Preferences (`ui.prefs`), Notifications (`ui.notifPrefs`) and Calendars sync rules (`ui.calPrefs`) are controlled and persisted the same way. They are stored, not yet applied everywhere (see Not done #2).
- “Reserve time for habits” adds every habit's time+length as a busy block in the planner.

## Limits & payments done (needs Stripe setup)
- `lib/plan.ts` loads `subscriptions` + `plans` + this month's `ai_usage`; cloud loads it after sign-in and resets on sign-out.
- Enforced: notes (Free 50) and user-created projects (Free 5) block creation and open an “Upgrade” dialog; AI is enforced server-side in the Edge Function; a Mac Calendar connection counts as the one calendar (its internal calendars are not counted). Limit checks are client-side except AI.
- Settings › Billing shows the real plan and live usage (projects, notes, AI calls) and its buttons start Stripe Checkout. `lib/billing.ts` opens the returned URL externally.
- `supabase/functions/billing/index.ts` creates a Stripe Checkout subscription session; `supabase/functions/stripe-webhook/index.ts` verifies the signature and upserts `subscriptions` (plan pro/free, status, period end). Success/cancel return through `nexday://billing/success|cancel`, which reloads the plan.
- Setup (owner): create a recurring $6 price in Stripe → add secrets `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`; deploy `billing`; add webhook endpoint `https://<ref>.supabase.co/functions/v1/stripe-webhook` with `checkout.session.completed` + `customer.subscription.created/updated/deleted`; add `STRIPE_WEBHOOK_SECRET` and deploy `stripe-webhook`. Test in Stripe test mode first.

## AI done (needs deployment)
- `supabase/functions/ai/index.ts` holds the Gemini key and does three actions: `parse` (quick-capture classification), `inbox` (one suggestion for a captured item) and `note` (action items). It checks `plans.limits.ai_per_month` and the current month's `ai_usage.calls`, then increments the counter. `GEMINI_MODEL` defaults to `gemini-2.5-flash`.
- Deploy: Supabase Dashboard → Edge Functions → Create function `ai`, paste the file, Deploy; or `supabase link --project-ref xsullpmifpyxkkbguznp && supabase functions deploy ai`. Then Edge Functions → Secrets → add `GEMINI_API_KEY` (Google AI Studio). No key in the app or repo.
- Client `lib/ai.ts`. Inbox quick capture shows the regex suggestion instantly and replaces it with the AI one when it arrives. Note editor has “Find action items” → “Add all to plan” (lands in No time yet, ready for auto-schedule).
- Until the function is deployed the UI says “AI is not set up yet” and the rest of the app works unchanged. The task quick-capture path still uses the regex parser.

## Pitfalls learned
- Short generic CSS class names collide with older global ones (`.en`, `.sp` both broke things). Prefix new classes (`st-`, `nx-`, `fc-`, `tv-`, `ts-`).
- Animations freeze in the hidden preview tab; inject `*{animation:none!important}` before measuring.
- Don't run `pkill -f electron-vite` chained with other commands.
- Command palette and New popup are keyboard-opened, so they intentionally have no open animation.
- Remaining known gaps in UI: Project page keeps its own header and `line-height: normal`; the Today page still shows design copy/plan (planning engine); Day view's “planned tasks” come from the today task group; notes have no editing yet and no "linked event" beyond the stored sample text; editing/rescheduling an event does not update its Mac copy.

## Cleanup done (before beta)
- Identity: `lib/identity.ts` (`useIdentity`, `greeting`) is the only source of the person's name/email in the UI. No hard-coded personal data remains in `src/`; the sample content seeded by `SAMPLE_DATA` still contains fictional teammates (e.g. in Inbox).
- Honest placeholders: fake "Connected" Gmail/Slack/GitHub/Google rows, invented sync history and invented share members are gone. Share is hidden by `FEATURES.sharing = false` (`lib/features.ts`). Inbox rules dialog still shows design-only example rules.
- Release guard: `electron.vite.config.ts` refuses a production build without `VITE_SUPABASE_*` (override: `ALLOW_NO_BACKEND=1`); `main.tsx` shows "Nexday can't start" if a packaged app has no backend.
- Sync durability (`lib/cloud.ts`): a failed write undoes its "saved" mark, retries with growing pauses (5s..60s, also on `online` and the Sync popover's "Sync now"), and writes an unsent-changes journal (`journal:<userId>` via `lib/persist.ts` `kv`) that is re-applied after the next load. A load failure shows a retry screen (`App.tsx`) instead of empty pages.
- Tested against the real project with a throwaway account (deleted afterwards): offline add → "Sync failed" + journal → Sync now → saved; forced load failure → retry screen → Try again → app loads.
