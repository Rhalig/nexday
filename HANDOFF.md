# Nexday: handoff notes

Mac planner app (Electron + Vite + React + TypeScript). The owner speaks Turkish and prefers short status updates and approval after each chunk of work. Replies to them in Turkish.

## What it is
A day planner: Today, Inbox, Calendar, Tasks, Notes, Habits, Projects, Settings, Focus mode, login/onboarding. The UI was built pixel-for-pixel from a Doop design canvas (`TM7q9Gahtd`, reference PNGs in `ref/`). Mac only for now.

## Where things are
- Project: `~/nexday` (moved out of iCloud on purpose; iCloud broke `codesign`). Git repository, pushed to the private GitHub repo `Rhalig/nexday` (remote `origin`, branch `main`).
- Run: `npm run dev` (Electron). Quick browser preview: `.claude/launch.json` serves `out/renderer` on port 5199 after `./node_modules/.bin/electron-vite build`.
- Check: `./node_modules/.bin/tsc --noEmit -p tsconfig.web.json --composite false` and the same with `tsconfig.node.json`.
- Package (Apple Silicon, ad-hoc signed, no Developer ID yet):
  `npm run build:eventkit && ./node_modules/.bin/electron-vite build && CSC_IDENTITY_AUTO_DISCOVERY=false ./node_modules/.bin/electron-builder --mac dmg zip --arm64 -c.mac.identity=- -c.mac.hardenedRuntime=false -c.directories.output=$HOME/nexday-release4`
  (the last built .app is `~/nexday-release3/mac-arm64/Nexday.app`; email confirmation and reset links only work from a packaged app, because macOS routes `nexday://` links to registered apps only).
- Config: `.env` holds `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (public key, gitignored). Never put a secret/service key in the app.

## Code map (`src/renderer/src`)
- `styles/` tokens (spacing, colors), shell, components, `motion.css` (all animation tokens and rules).
- `components/` shared UI: `Sidebar`, `AppShell`, `Drawer`, popups, dialogs, `QuickCapture` + `GhostInput` (the one capture bar used everywhere), `CommandPalette`, `NewPopup`, `Pickers`.
- `pages/` today, inbox, tasks (+ empty/error/loading at `/tasks/empty|error|loading`), calendar, notes, habits, projects, settings, entry (launch/login/register/forgot/onboarding), focus.
- `store/` zustand stores (tasks, inbox, habits, notifs, projects, notes, ui, auth, calendar).
- `lib/cloud.ts` Supabase sync (load after sign-in, watch stores and save every change, seed sample data once for a new account; `SAMPLE_DATA` flag). `lib/supabase.ts` client (session kept in the Mac keychain via main process). `lib/clock.ts` is live: `appToday()` returns the real date, with `startOfWeek`/`startOfMonth`/`dayKey`/`parseDayKey`/`pageDate` helpers. `lib/capture.ts` regex quick-capture parser. `lib/persist.ts` local JSON cache (disabled when Supabase is configured).
- Main process (`src/main`): `storage.ts` (JSON file), `secure.ts` (keychain-encrypted values), `calendar.ts` + `native/eventkit/main.swift` (Mac Calendar via EventKit: read, create, delete), `nexday://` deep link handling in `index.ts`.

## Backend (Supabase project `xsullpmifpyxkkbguznp`, URL https://xsullpmifpyxkkbguznp.supabase.co)
- Edge Functions in `supabase/functions/`: only `delete-account` (`ai` is deployed, Verify JWT on; `billing` and `stripe-webhook` were removed, see "Beta is free"). It is deployed; each file header lists the secrets it needs.
- Schema in `supabase/migrations/0001_init.sql` and `0002_habit_meta.sql`, both already applied (through the dashboard SQL editor; no CLI link). 14 tables, row level security on all, signup trigger creates profile and a 14-day trial, `plans` table holds limits (free: 5 projects, 50 notes, 1 calendar, 200 AI/month; Pro $6).
- Auth: email+password and Google. Redirect URL `nexday://auth/callback` is allowed. Email confirmation is on; Supabase's default email sender is rate-limited, a real SMTP (Resend/Brevo) is still needed.
- Google Cloud project `nexday-515118` ("Nexday"), OAuth consent in Testing mode with the owner's Gmail as the only test user, Web client whose redirect is the Supabase callback. Google sign-in was removed from the app for the beta.
- Cloud-synced today: tasks, inbox, habits (+ check-ins), notifications, custom projects, notes (with body/metadata in `notes.body` JSON), events created inside Nexday (all-day, rrule, Mac external id), two UI settings (autoSchedule, pauseNotifs). Sample notes are seeded once per account (flagged `settings.notesSeeded`), staggered a second apart so list order survives `order by created_at`.

## Decisions already made
Cloud accounts with Supabase free tier. AI = Gemini free tier (key must live in a Supabase Edge Function secret, never in the app; note the free tier may use content for training, so move to paid before public launch). Mac only. No Apple sign-in. Google Calendar API and Gmail inbox come later (Google verification is slow; Gmail needs a security assessment). Mac Calendar already covers Google calendars through EventKit. Payment shows $6 Pro, limits may change (so keep them in the `plans` table).

## Settings are applied now
- Preferences (`lib/prefs.ts`, subscribes to the UI store at import time): time format (`T(text)` rewrites every "HH:MM" in a string; used in task rows, Today, Calendar grid/events, task drawer; strings built elsewhere, e.g. Inbox suggestion chips, still show 24-hour), date format (`pageDate`/`shortDate` in `lib/clock.ts`), density (`data-density` on `<html>`, CSS in components.css), reduce motion (`data-reduce-motion`, motion.css), start page (`StartPage` route in App.tsx), show completed tasks (Today plan), sounds (silent flag on notifications). Language only offers English; time zone shows the Mac's.
- Notifications (`lib/notifier.ts`, started in AppShell): native desktop notifications from a 30 s check: daily plan (work days 08:30–09:30), up next (events and timed tasks, lead time from settings), tasks still open (16:00), habit reminders (at the slot), weekly review (Fri 17:00). Respects pause, quiet hours and the Desktop checkbox of each row; fired keys are remembered per day (`kv notifFired`). Email and in-app columns, Inbox suggestions and Shared rows are marked "soon" and do nothing.
- Move unfinished tasks (Settings › Planning): at load, open tasks planned for a past day drop their old slot and sit in "No time yet" for the planner (`groupsFromRows(rows, moveUnfinished)` in `lib/cloud.ts`); the old date stays in the database until the task is next edited, and the setting off puts them back in Today.
- Calendars: sync direction (Two-way writes new events to Mac Calendar, "Calendar to Nexday" does not), new events' default kind, show declined events.
- Tested: notifier and `T()` with a script and fake stores, preferences toggles in the browser preview. Not tested: a real macOS notification from the packaged app (needs the notification permission prompt).

## Not done yet (suggested order)
1. Real SMTP for confirmation/reset emails (dashboard-only, needs the owner): Resend or Brevo, then Supabase Dashboard → Authentication → Emails → SMTP (host `smtp.resend.com`, port 465/587, user `resend`, password = API key). Test from a packaged app (only registered apps receive `nexday://` links).
2. Launch at login, editable keyboard shortcuts, subtask editing, recurring/all-day and Mac-only event rescheduling.
3. Release: Apple Developer ID + notarization, auto-update, Intel/universal build, crash reporting, privacy policy and terms, tests (none yet).

## Notes editor
- `pages/notes/NoteEditor.tsx`: title input + one plain-text writing area (`Note.text`, saved in `notes.body.text`; the preview line `summary` follows it). Conventions per line (`lib/noteText.ts`): `# heading`, `- bullet`, `[ ] action item` (`[x]` done, `[>]` sent to the plan). `/` opens a command menu (action item, bullet, heading), Enter continues a list, Enter on an empty marker ends it, the bottom bar applies the same prefixes. Auto-saves 600 ms after typing stops and on leaving; the side card lists the action items (tick to mark done), "Add N to plan" creates tasks in "No time yet" and marks the lines `[>]`, "Find with AI" appends `[ ]` lines from the `ai` function. Delete note is in the top bar.
- Old sample notes with a structured `body` are turned into text the first time they are opened and edited. No bold/italic (plain text), no event/project linking from the editor yet.
- Tested in the browser preview (typing, slash menu, continuation, plan, preview); not against a real account.

## Drag and drop (`components/dnd.tsx`, plain HTML5 dragging)
- `dragProps` makes an element draggable; `TimelineDrop` (time grids: converts the pointer to a quarter-hour time, shows a dashed ghost) and `CardDrop` (columns/groups) accept drops.
- Calendar week and day views: drag an event made in Nexday to another time or day (`useCalendar.move`). Not draggable: Mac-only events, recurring and all-day events (move those from the event editor, which does not exist for reschedule yet). A Nexday event that was written to Mac Calendar is updated there too (new `update` command in `native/eventkit/main.swift` + IPC `cal:update`; only when sync direction is Two-way; rebuild the helper with `npm run build:eventkit`).
- Today › Calendar view: drag a planned task to another time, or drag an unscheduled task onto the timeline (`useTasks.move`). Today › Board: drag a card to Morning/Afternoon/Evening (sets 09:00/14:00/18:00, keeps its length) or onto Done to complete it.
- Tasks page (grouped by day): drag a task onto Today / Tomorrow / Next week / No time yet; it keeps its clock time and length, "No time yet" clears them. Empty days appear while dragging.
- Tested with simulated drag events in the browser preview (all of the above except the Mac Calendar update, which only compiled); real mouse dragging and the EventKit update were not run.

## Calendar done
- Real dates + week/month/day navigation; recurring and all-day events are supported end to end (DB, grid, drawer, delete).
- Recurrence shapes: daily / weekly / every weekday / monthly (`FREQ=DAILY|WEEKLY|MONTHLY`, `BYDAY`, `INTERVAL`, `UNTIL`). Anything else in `rrule` is shown once. Recurring Mac events arrive already expanded from EventKit.
- Write-back: a Nexday event is saved into Mac Calendar's default calendar when access is authorized; its EventKit id is kept in `events.external_id` (and `base` is de-duplicated against it). Delete removes it from Mac too. Editing/rescheduling an existing Nexday event does not update the Mac copy yet.
- The November-2026 `monthOnly` filler in `data/calendar.ts` is temporary sample content for the design month.

## Planning done
- `lib/planning.ts` fits no-time tasks into the coming work days (horizon `PLAN_HORIZON` = 8 days): starts at the next quarter hour today (never in the past), work window 09:00–18:00, lunch, buffer around events/lunch/existing tasks/habits, each task's own estimate (`Task.estimate`, stored as `tasks.estimate_min`; default length when unknown), energy curve (deep work in the morning, light after 12:00, daily deep-focus cap). A full day hands the rest to the next work day; `skipped` counts tasks that fit nowhere. Quick capture reads a length ("45m", "for 1h"). "Next week" labels like `Fri 09:30` resolve to the next such weekday from the day after tomorrow on (so a plan up to 8 days ahead stays unambiguous). The dialog loads events for the whole horizon with `useCalendar.loadSpan`.
- Auto-schedule dialog (Tasks page button and command palette → “Plan my afternoon”) previews the real placements and only applies them on confirm; per-run energy/buffer overrides do not change saved settings.
- Settings › Planning is wired to `ui.planning` and saved to `profiles.settings` (also in the local JSON cache when there is no account). Time values move in 30-minute steps on click.
- Preferences (`ui.prefs`), Notifications (`ui.notifPrefs`) and Calendars sync rules (`ui.calPrefs`) are controlled and persisted the same way. They are stored, not yet applied everywhere (see Not done #2).
- “Reserve time for habits” adds every habit's time+length as a busy block in the planner.

## Beta distribution
- The beta is a direct download from the owner's website, not the App Store. An ad-hoc signed app shows "unidentified developer" on first launch and the owner accepts that; Apple Developer ID and notarization are NOT needed for the beta. Testers open it with right-click › Open (or System Settings › Privacy & Security › Open Anyway). Auto-update without a Developer ID is not practical, so the beta ships by re-downloading.

## Beta is free (billing, limits, Google sign-in removed; AI stays)
- Decision: the beta is free, so there are no plan limits, no Upgrade dialog, no Settings › Plan & billing, no Stripe, and no "Continue with Google" button. Sign-in is email + password only. Register says "Free while Nexday is in beta."
- Removed from the app: `lib/plan.ts`, `lib/billing.ts`, `UpgradeDialog`, project/note limit checks, Settings › Plan & billing, `signInWithGoogle`. Removed from the repo: Edge Functions `billing` and `stripe-webhook` (git history has them if paid plans come back).
- Kept on purpose: the `plans`/`subscriptions`/`ai_usage` tables and the signup trigger (harmless, ready for later), the `nexday://` link handler (email confirmation and password reset still use it), and `delete-account` (still deployed; its Stripe branch only runs if a Stripe subscription exists, which cannot happen now).
- Supabase dashboard: the Google provider can be switched off under Authentication › Providers; the Google Cloud project is no longer needed for the beta.
- `delete-account` is deployed (Verify JWT on) and was tested end to end with a throwaway user. Client: `lib/account.ts` + `DeleteAccountDialog` (Settings › Data & privacy, type DELETE).

## AI (function deployed; needs the GEMINI_API_KEY secret)
- `supabase/functions/ai/index.ts` is a thin bridge to Gemini (key in an Edge Function secret, sent in the `x-goog-api-key` header, inputs length-capped). Actions: `parse` (classify a quick-capture line), `inbox` (suggestion for a captured item), `note` (action items in a note). Each call is counted in `ai_usage`; the Free plan row in `plans` caps it at 200 calls per person per month (`plans.limits.ai_per_month`), which protects the Gemini free-tier quota. That cap is server-side only, there is no limit UI any more.
- Client `lib/ai.ts`: used by Inbox quick capture (regex suggestion first, AI replaces it in place) and the note editor's "Find with AI". Until the function is deployed the UI says "AI is not set up yet" and everything else works. `aiParseCapture` exists but the task quick-capture still uses the regex parser.
- Status: the `ai` function was deployed from the dashboard editor. The owner adds the secret `GEMINI_API_KEY` themselves (Dashboard > Edge Functions > Secrets); keys are never typed by the assistant. Until then the app says "AI is not set up yet". Secret to add: (optional `GEMINI_MODEL`, default `gemini-2.5-flash`). The free Gemini tier may use content for training: tell testers in the privacy policy, or use a paid key.

## Pitfalls learned
- Short generic CSS class names collide with older global ones (`.en`, `.sp` both broke things). Prefix new classes (`st-`, `nx-`, `fc-`, `tv-`, `ts-`).
- Animations freeze in the hidden preview tab; inject `*{animation:none!important}` before measuring.
- Don't run `pkill -f electron-vite` chained with other commands.
- Command palette and New popup are keyboard-opened, so they intentionally have no open animation.
- Remaining known gaps in UI: Project page keeps its own header and `line-height: normal`; the Today page still shows design copy/plan (planning engine); Day view's “planned tasks” come from the today task group; notes have no editing yet and no "linked event" beyond the stored sample text; editing/rescheduling an event does not update its Mac copy.

## Cleanup done (before beta)
- Identity: `lib/identity.ts` (`useIdentity`, `greeting`) is the only source of the person's name/email in the UI. No hard-coded personal data remains in `src/`; the `SAMPLE_DATA` in `lib/cloud.ts` is now `false`: new accounts start empty (Tasks and Habits show their empty screens). Accounts created earlier (the owner's two) keep the sample rows they already had; the seeding code is still there if a demo account is ever needed.
- Honest placeholders: fake "Connected" Gmail/Slack/GitHub/Google rows, invented sync history and invented share members are gone. Share is hidden by `FEATURES.sharing = false` (`lib/features.ts`). The Inbox dialog is now "Inbox sources": Quick capture with its real waiting count, the other sources marked Soon, no rules (there is no rule engine).
- Release guard: `electron.vite.config.ts` refuses a production build without `VITE_SUPABASE_*` (override: `ALLOW_NO_BACKEND=1`); `main.tsx` shows "Nexday can't start" if a packaged app has no backend.
- Sync durability (`lib/cloud.ts`): a failed write undoes its "saved" mark, retries with growing pauses (5s..60s, also on `online` and the Sync popover's "Sync now"), and writes an unsent-changes journal (`journal:<userId>` via `lib/persist.ts` `kv`) that is re-applied after the next load. A load failure shows a retry screen (`App.tsx`) instead of empty pages.
- Tested against the real project with a throwaway account (deleted afterwards): offline add → "Sync failed" + journal → Sync now → saved; forced load failure → retry screen → Try again → app loads.

## Today page (live data)
- `lib/today.ts` (`buildToday`) computes everything Today shows from the tasks, calendar, habits and notes stores; `pages/today/Today.tsx` and `TodayViews.tsx` only render it.
- `store/tasks.ts` keeps `doneToday` (tasks finished today); `lib/cloud.ts` loads today's done tasks and this week's habit check-ins (`useHabits.week`) at sign-in.
- Without Mac Calendar access Today shows only Nexday-created events (the design sample week is filtered out); the Calendar page still shows the sample week.
- Other pages are live too: sidebar Notes count; Tasks "Planned today", "Deep focus today" (goal = Settings › Planning) and per-project done counts (`useTasks.doneTotals`, loaded from the done tasks at sign-in); Inbox "Free today" (`lib/useToday.ts` is the shared hook); Projects pages are built from the real tasks (`data/projects.ts` is gone; custom projects cannot hold tasks yet); Habits stats, heatmap, weekday facts, per-habit streak/rate/check-ins (`lib/habitStats.ts`, from `useHabits.history` = last 12 weeks of check-ins; with no account the saved sample numbers still show).
- Removed as fake: Habits "Nexday noticed" card, Project side lists (milestones, notes), Inbox "Cleared this week".

## Export / Import (Settings › Data & privacy)
- Export (`lib/dataPorter.ts`): "Export JSON" writes every row the account owns (projects, tasks, inbox_items, habits, habit_checkins, notes, events, notifications, profile) read page by page; "Tasks CSV" writes tasks (formula-looking cells are prefixed with `'`). Saved through a native dialog (`main/files.ts`, IPC `file:save` / `file:open`, 10 MB cap); in a browser it downloads. Needs an account (nothing to export in local mode).
- Import: open tasks only, from a Nexday export, Google Tasks (Takeout JSON), or a CSV (Todoist, Notion or generic: columns title/content/name, date/due, project, status, estimate). A preview dialog shows how many will be added; titles already open in Nexday or repeated in the file are skipped. Tasks with a date AND a time within 8 days keep their slot; the rest go to "No time yet" for Auto-schedule. Notes, habits and events are not imported yet.
- Tested with throwaway files and the parser in isolation; the native file dialogs and a real account export were not run.
