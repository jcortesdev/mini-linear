# Architecture Decision Records (ADRs)

Lightweight records of architectural decisions. Each one is short on purpose: context, decision, consequences. ADRs cover decisions that affect shape — what's in the project, what the trade-offs cost, why a future contributor (or interview panel) would inherit the same choice.

ADRs that are obvious in hindsight (use TypeScript, use Tailwind, use pnpm) are not recorded — they would dilute the document.

---

## ADR-001: Convex instead of Supabase / Postgres

**Context:** This project needs a real backend — authentication, a database, server-side validation, and realtime collaboration. The conventional answer is Postgres (Supabase, Neon, or self-hosted) with a hand-written API layer. Convex is a younger entrant: a serverless TypeScript backend with reactive queries, mutations, scheduled functions, and built-in auth. The question is which to pick when "broadest recruiter recognition" and "best fit for this project's shape" point in different directions.

**Decision:** Use **Convex** for the backend. Tables, queries, mutations, auth, and realtime all live in the `convex/` folder. No separate API, no ORM, no migration tool.

**Why Convex earns its weight here:**

- **Realtime is automatic.** Every `useQuery` opens a subscription. Convex tracks which queries depend on which documents; any mutation that touches those documents republishes the affected queries. The React component just re-renders. Building this on Postgres means either polling (slow), Supabase Realtime (extra moving parts), or self-rolling subscriptions over a websocket (months of work).
- **Optimistic updates are a first-class hook.** `useMutation(api.x.y).withOptimisticUpdate(localStore => {...})` is the entire API. The hand-rolled equivalent on Postgres + REST is a shadow store, a reconciler, and a retry policy.
- **The SDK is TypeScript end-to-end.** Generated types from `schema.ts` flow through queries, mutations, and the client. There is no DTO layer. The `Doc<'issues'>` type is the canonical issue shape everywhere.
- **The auth story is bundled.** `@convex-dev/auth` covers OAuth (multiple providers), magic-link, anonymous, and session management. Compared to wiring NextAuth or Auth.js against Supabase, the moving parts are halved.

**Why I would pick Supabase / Postgres instead:**

- The data model has complex joins, window functions, or relational reporting requirements that don't fit Convex's document/index model.
- The team already has Postgres + RLS expertise; switching to Convex is friction without a payoff.
- I need SQL access for ad-hoc analytics, BI tools, or a backup-and-restore story tied to dump files.
- The hiring funnel for this project is "broadest possible Postgres-shaped pool"; Convex narrows it.

**Consequences:**

- ✅ Realtime queries on `useQuery(api.issues.list)` "just work" — open two tabs, change a status in one, see it update in the other (Module 5 will demo this).
- ✅ Optimistic mutations are uniform: every callsite goes through `useUpdateIssue` / `useRemoveIssue` (see [ADR-005](#adr-005-shared-optimistic-mutation-hooks-instead-of-per-component-blocks)).
- ✅ Schema validation is server-side and matches the generated TS types automatically.
- ⚠️ Less recruiter recognition than Postgres. I cover this in interview prep by leading with the realtime + optimistic story instead of name-dropping the database.
- ⚠️ No raw SQL escape hatch. If the project grew to need windowed analytics queries, I'd add a separate analytics store (Clickhouse, Postgres) rather than fight Convex.

---

## ADR-002: Next.js 16 App Router (not TanStack Start, not Pages Router)

**Context:** The portfolio already has a Vite SPA (Aurora, project #1) and a Next.js static-export PWA (Habit Tracker, project #2). This project has a different shape: it needs auth-gated routes, a server-side middleware for redirects, parallel + intercepting routes for the slide-over, and a polished story around route groups. TanStack Start is the up-and-comer; Next.js Pages Router is the conservative choice. App Router is the current Next.js answer.

**Decision:** **Next.js 16 with the App Router.** Server Components for the providers and the auth-aware shell; Client Components for everything that touches Convex hooks, cmdk, or interactivity. No Server Actions for DB mutations (those go through Convex). No Route Handlers (the only thing left for them would be third-party webhooks, which this project doesn't have).

**Why App Router:**

- **Parallel + intercepting routes** make the Linear-style slide-over possible. `/issues/[id]` is a real route with a shareable URL; the `@modal/(.)[id]` slot intercepts the click and renders the slide-over inside the list's layout without unmounting the list. Doing this on Pages Router would be hand-rolled state in the list component.
- **Route groups (parentheses)** let `/issues` and `/board` share a layout with the sidebar and topbar without `(app)` showing up in the URL. Pages Router has no equivalent.
- **Server Components keep secrets server-side** — the `ConvexAuthNextjsServerProvider` reads auth headers from the request without leaking them to the client bundle.
- **Recruiter recognition.** Next.js + Vercel is the current default for hiring conversations. TanStack Start is the future; for a portfolio shipping in 2026, Next.js is the current.

**Why I would pick something else:**

- **Static-only or PWA-only project** — drop the app router and go static export. Habit Tracker does exactly that.
- **Want full SSR with no Vercel coupling** — Remix or TanStack Start.
- **The project is a CLI or library** — Next.js is irrelevant.

**Consequences:**

- ✅ Slide-over + shareable URL + list-stays-mounted come for free from the routing model.
- ✅ Middleware-based route protection is one file.
- ✅ The `(app)` group makes the layout-sharing story clean.
- ⚠️ Intercepting routes have one known gotcha: `router.push` doesn't trigger them. The keyboard Enter handler in the list dispatches a synthetic `MouseEvent('click')` on the row's `<Link>` instead. Documented inline.
- ⚠️ Turbopack + Windows occasionally flakes intercepting routes after long HMR sessions. Fix is `rm -rf .next` + restart. Doesn't repro in prod builds.

---

## ADR-003: cmdk + Radix Dialog for the command palette (not a custom build)

**Context:** Module 3 ships a ⌘K command palette with fuzzy search, grouped commands, contextual actions, leader-key sequences, and a Keyboard Shortcuts deep-link. The de-facto pattern in the industry is `cmdk` by Paco Coursey, which Linear, Raycast, Vercel dashboard, and Notion (or their forks) use. The alternative is rolling the dialog + filtering + ARIA + focus management by hand on top of Radix Dialog or Reach UI.

**Decision:** Use **`cmdk` 1.1** for the palette. cmdk wraps Radix Dialog internally; we mount `<Dialog.Title>` and `<Dialog.Description>` as `sr-only` children to satisfy Radix's a11y warnings. This requires `@radix-ui/react-dialog` as a direct dependency (cmdk's transitive isn't reachable through pnpm's strict module boundaries).

**Why cmdk:**

- **Filtering, fuzzy match, groups, empty state, `aria-activedescendant`, combobox + listbox roles, keyboard navigation** — all out of the box. The hand-rolled version is weeks of polish recruiters won't see.
- **Radix Dialog underneath** gives focus trap, Esc handling, click-outside, and portal rendering for free.
- **De-facto pattern.** A reviewer who has used Linear or Raycast recognizes the model instantly.

**Why I would pick something else:**

- The project ships on a JS runtime that can't load Radix Dialog (very rare).
- The command palette is dramatically different from cmdk's model — e.g. a true tree of nested panes (Spotlight on macOS) — and cmdk's `pages` pattern isn't enough.
- The palette is the entire product and the team would write the libraries cmdk depends on anyway. None of these apply here.

**Consequences:**

- ✅ The palette ships with the right ARIA roles, fuzzy search, and keyboard model without me writing them.
- ✅ The Keyboard Shortcuts group as `disabled` items inside the same dialog gives us a deep-link target without a separate Help overlay.
- ⚠️ cmdk doesn't auto-mount Radix's `<Dialog.Title>` / `<Dialog.Description>`. Without them, Radix logs dev warnings. We add them as `sr-only` children — small cost.
- ⚠️ cmdk's `Command.Input` autofocuses synchronously, which breaks Radix Dialog's built-in focus restoration. See [ADR-006](#adr-006-snapshot-on-open-focus-restoration-for-the-command-palette).
- ⚠️ One direct dep we wouldn't otherwise need (`@radix-ui/react-dialog`). It was already in `node_modules` via cmdk; we just declared it.

---

## ADR-004: Slide-over detail panel via parallel + intercepting routes (not a search param)

**Context:** Clicking an issue row in `/issues` should open a detail view. Two shapes work:

- **Search param** (`/issues?selected=<id>`) — render the panel as a sibling of the list in the same route; the URL is shareable as a query string.
- **Parallel + intercepting route** (`/issues/<id>` with the `@modal/(.)[id]` slot) — render the panel inside the layout; the URL is `/issues/<id>` and refreshing it lands on the full-page detail route as a fallback.

**Decision:** **Parallel + intercepting routes.** The slide-over is a `role="dialog"` non-modal panel rendered inside the layout when the user navigates from the list; the full-page `/issues/[id]` route renders on refresh, deep-link, or direct visit.

**Why intercepting:**

- **Clean URL.** `/issues/<id>` is the canonical issue identifier and matches what Linear (and most issue trackers) ship.
- **Shareable + refresh-safe.** Pasting `/issues/<id>` into a new tab opens the full-page detail; opening it from the list opens the slide-over. Same URL, two presentations, no `?selected=` flag.
- **List stays mounted.** The panel renders over the layout, so the user can click another row to swap issues without losing scroll position or rebuilding the list.
- **Shows I understand the routing model.** Next 13+ intercepting routes are a recent feature; using them deliberately demonstrates familiarity with the current App Router conventions.

**Why I would pick search params instead:**

- Search-param state is trivially preservable across non-React libraries and frameworks. If I expected the project to outlive Next.js or migrate to a different router, the search param is the safer bet.
- Search params are simpler for tests and analytics — every state transition is in the URL, observable from the network.
- Search params don't have the `router.push` gotcha (see consequences).

**Consequences:**

- ✅ Linear-style UX with a one-line component (`<IssueDetailSlideOver>`) reading the `id` from `useParams()`.
- ✅ The list never unmounts behind the panel; arrow keys still work.
- ⚠️ `router.push` does **not** trigger intercepting routes — only real `<Link>` clicks do. The keyboard Enter handler in the list dispatches a synthetic `MouseEvent('click', ...)` on the row's `<Link>` to compensate. Documented inline.
- ⚠️ Turbopack + Windows flakes intercepting routes after long HMR sessions. Fix is `rm -rf .next` + restart.

---

## ADR-005: Shared optimistic-mutation hooks instead of per-component blocks

**Context:** By Module 3 the app had six places that mutated an issue: each of the four pickers (status, priority, assignee, labels), the row's inline title editor, and the description editor. The detail panel added a seventh (delete + restore). Each declared its own `useMutation(api.issues.update).withOptimisticUpdate(...)` block. Each block wrote to the cached `api.issues.list` query and the cached `api.issues.get` query; the assignee picker additionally read `api.members.list` to resolve the user doc so the optimistic row had the same shape as the server's reply. The palette would have been the eighth block.

**Decision:** Extract two hooks into [`src/lib/issue-mutations.ts`](../src/lib/issue-mutations.ts): `useUpdateIssue()` and `useRemoveIssue()`. Refactor all eight callsites to consume them.

**Why one hook for every field:**

- **Drift risk.** Eight near-identical blocks would inevitably diverge — someone would update the list cache and forget the detail cache, or change the assignee resolution and miss the labels resolution.
- **Single source of truth for the optimistic shape.** The hook resolves relational fields (`assigneeId` against `api.members.list`, `labelIds` against `api.labels.list`) once. Callers pass partial patches and get the right cache writes.
- **Small net cost per caller.** `update({ id, status })` skips three field transforms via `undefined` checks. The generic patch function inspects the args once.

**Why I would not extract:**

- The mutation surfaces were genuinely different shapes (e.g. one used Convex schema, another used a separate REST endpoint). They don't here.
- The team prefers per-component locality for traceability. With seven callsites, locality is louder than DRY.

**Consequences:**

- ✅ ~150 lines of duplicated `.withOptimisticUpdate` deleted across the seven callsites.
- ✅ Adding a new mutation surface (e.g. the M4 board drag-end handler) is `useUpdateIssue()` + `update({ id, status, boardOrder })`. The optimistic write already covers the new field.
- ✅ Server-shape mismatches surface as test failures in one place, not seven.
- ⚠️ A regression in the hook breaks every caller. Mitigated by the Vitest helper tests + the Playwright e2e suite catching shape regressions across the slide-over, the row, the description editor, and the palette.

---

## ADR-006: Snapshot-on-open focus restoration for the command palette

**Context:** Radix Dialog's `FocusScope` snapshots `document.activeElement` at mount time and restores it on unmount. cmdk's `Command.Input` calls `.focus()` synchronously during the same render that mounts the dialog. The order of `useLayoutEffect` runs means FocusScope's snapshot is the input itself, not the topbar trigger (or whatever opened the dialog). On close, FocusScope tries to focus the (now-removed) input and focus falls to `<body>`. The first Playwright e2e test made this visible: `expect(trigger).toBeFocused()` after Esc consistently failed.

**Decision:** Bypass Radix's FocusScope for restoration. The `<PaletteProvider>` maintains its own `triggerRef`, snapshots `document.activeElement` before every `setOpen(true)` (and inside the ⌘K toggle, and inside `openWithSearch`), and a `useEffect([open])` restores it on the close transition.

**Why the workaround:**

- **cmdk doesn't forward `onCloseAutoFocus`** (the Radix escape hatch for custom restore behavior) to the underlying Radix Dialog Content. The clean fix would be to drop down to `<Dialog.Root>` + `<Command>` and rebuild Command.Dialog by hand, which loses the value of using cmdk.
- **The snapshot ref is ~15 lines** and is robust to cmdk's autofocus timing changing in future versions. The behavior is verified in browser + e2e.
- **The trigger source is unambiguous.** Snapshotting `activeElement` before each open captures whatever was focused — topbar trigger, sidebar link, or the document body when ⌘K fired from a keyboard shortcut. On close, focus returns to wherever it came from.

**Why I would not work around it:**

- A future cmdk version exposes `onCloseAutoFocus` (or autofocuses asynchronously). Then the workaround is dead weight and I'd remove it.
- The team is uncomfortable with React state managing focus and would rather rely on Radix's built-in. In that case I'd fork cmdk's Command.Dialog and configure FocusScope explicitly.

**Consequences:**

- ✅ Esc on the palette returns focus to whatever opened it; e2e test asserts this.
- ✅ The bypass is local to `palette-provider.tsx`; no other component knows about it.
- ⚠️ Two pieces of state to keep in lockstep with Radix Dialog's lifecycle. Documented inline; revisit in Module 5 if cmdk's API evolves.
- ⚠️ A future contributor adding a third path to open the palette must remember to call `snapshotFocus()` before `setOpen(true)`. Mitigated by wrapping `setOpen` itself — every public path already does the right thing.

---

## ADR-007: Soft delete with Undo (not hard delete + recreate)

**Context:** Issue deletion should be undoable for 6 seconds. Two implementation shapes:

- **Hard delete + recreate** — `ctx.db.delete(id)` on delete; on Undo, `ctx.db.insert(...)` with the full snapshot. The new issue has a new `_id` and a new LIN-N.
- **Soft delete** — set an optional `deletedAt` timestamp on the doc; list and detail queries filter out soft-deleted issues. On Undo, clear `deletedAt`.

**Decision:** **Soft delete** via `issues.deletedAt: v.optional(v.number())`. The list and detail queries return only issues with `deletedAt === undefined`. The `restore` mutation uses `ctx.db.replace(id, {...rest})` to drop the field — `ctx.db.patch({deletedAt: undefined})` is a no-op in Convex 1.39 because `undefined` is dropped during serialization.

**Why soft delete:**

- **The doc keeps its `_id` and `number`.** The user's open URL `/issues/<id>` still resolves after Undo. The toast that holds the Undo button keeps its closure over the original id, no recreate-and-track dance.
- **Restore is trivial.** Clear `deletedAt`, queries auto-update via reactivity.
- **Data is preserved.** Assignee, labels, description, creation time — all kept across the Undo window without me having to stash a snapshot client-side.

**Why hard delete instead:**

- Storage cost is a meaningful constraint and tombstone accumulation would hurt — not the case here.
- The schema can't carry a `deletedAt` for unrelated reasons (e.g. external sync that doesn't tolerate it).
- Undo is not a feature.

**Consequences:**

- ✅ Undo round-trip works end-to-end; e2e test asserts this in M2.
- ✅ Future-friendly to "restore all" admin tooling (`api.issues.restoreAllDeleted`) used during demo cleanup.
- ⚠️ Soft-deleted rows accumulate forever. Schema has `deletedAt` but no TTL or cleanup cron. M5 candidate: scheduled function that purges anything with `deletedAt > 7 days ago`.
- ⚠️ `ctx.db.patch({field: undefined})` is a no-op in Convex 1.39 (the `undefined` is dropped during serialization). To actually unset an optional field, `ctx.db.replace` with the field destructured out, or `ctx.db.patch({field: null})` if the validator allows it. Documented inline in `restore`.

---

## ADR-008: Multi-provider auth (GitHub + Google + LinkedIn + magic link + anonymous)

**Context:** The recruiter audience is split. Engineering recruiters and tech leads can sign in with GitHub instantly. Non-tech recruiters and HR have Google or LinkedIn but not GitHub. Magic link by email is the fallback when corp policy blocks third-party OAuth. The "Try the demo" anonymous flow is for someone who doesn't want to sign in at all. Adding each provider costs about two hours of setup (OAuth app, callback URL, env vars, smoke test).

**Decision:** **Ship all five providers.** GitHub, Google, and LinkedIn OAuth via `@auth/core`; Resend for magic link; `@convex-dev/auth/providers/Anonymous` for the demo button. Facebook is rejected — the App Review burden is disproportionate to the value for this audience.

**Why all five:**

- **The audience split is real.** Optimizing for the funnel cost ~10 hours total; the payoff is the first time a non-technical reviewer reaches my portfolio.
- **Anonymous covers the "I don't want to sign in for a demo" reviewer.** It auto-joins the user to a seeded workspace so they see issues immediately, not an empty state.
- **Magic link is the corp-policy escape hatch.** Some companies block third-party OAuth; email links pass.

**Why I would pick fewer:**

- This is a hobby project nobody else will visit. One provider is enough.
- The audience is internal at a single company with a single SSO. Just wire that one.
- Each provider's setup is a recurring maintenance cost (OAuth app rotation, key management). For a project I'll abandon in three months, the cost outweighs the benefit.

**Consequences:**

- ✅ Every recruiter who reaches `/sign-in` can get in within ten seconds.
- ✅ The anonymous flow auto-joins the demo workspace via the `afterUserCreatedOrUpdated` callback, which also handles OAuth users — no duplicate logic.
- ⚠️ Five providers = five sets of OAuth app credentials = five places to rotate keys, manage callback URLs, and validate prod vs dev env vars.
- ⚠️ Resend's sender restriction (no sending from `onboarding@resend.dev` to non-account-owner addresses) cost me a DNS verification pass to set up `noreply@jcortes.dev`. Solved once, documented.

---

## ADR-009: In-house toast system (no `sonner`, no `react-hot-toast`)

**Context:** The Undo flow on delete needs a toast: title + action button + auto-dismiss. M2 didn't yet have one. The two industry-standard choices are `sonner` (smaller, opinionated) and `react-hot-toast` (older, configurable).

**Decision:** Build an in-house `ToastProvider` (~150 lines). Three variants (info / success / error), an optional `action` button, a `duration` for auto-dismiss with `0` meaning "stay until dismissed." Framer Motion for entry / exit (respecting `useReducedMotion`).

**Why in-house:**

- **The need is small.** Three variants, one action button, auto-dismiss. Roughly 150 lines including the portal and the animation. About the same as wiring sonner.
- **The Undo callback fires a Convex mutation outside React.** Most libraries support this; the wrapper code ends up about the same size.
- **Matches the project's philosophy** — don't pull in deps to solve problems smaller than the dep. If the need were stacking, swipe-to-dismiss, queue management, multiple positions, I'd reach for sonner.

**Why I would pick a library:**

- The toast story grows beyond three variants + one action button.
- The project has a designer producing rich animation specs that match sonner's defaults better than hand-tuned Framer.
- Maintenance bandwidth is a real constraint and the dep saves me the next bug fix.

**Consequences:**

- ✅ Toast respects `prefers-reduced-motion` end-to-end; e2e test asserts the slide animation is disabled under reduced motion.
- ✅ No new dep, no future migration to a major version.
- ⚠️ Stacking, queue management, and dismissal API are minimal. If a future module needs richer behavior, migrating to sonner is a swap.

---

## ADR-010: Distinct e2e prefixes per module (`[e2e]` for M2, `[e2e-m3]` for M3)

**Context:** Anonymous demo users all land in the shared demo workspace. Every Playwright test that creates an issue must clean up after itself or the workspace fills with garbage. The cleanup mechanism is `api.issues.purgeByTitlePrefix` called from `afterEach`, hard-deleting anything matching a prefix (with a 3-character minimum to prevent typo-induced wipes). Tests use a prefix in every title they create. With one prefix per repo, running the M2 and M3 test files in parallel (Playwright's default with `workers > 1` locally) means M3's `afterEach` deletes rows M2 is mid-asserting on.

**Decision:** **Each test file uses a distinct prefix.** M2 uses `[e2e]`, M3 uses `[e2e-m3]`. The purge in each file's `afterEach` is scoped to its own prefix. Tests within a single file remain `mode: 'serial'` because the workspace is still shared between them.

**Why per-file prefixes:**

- **The race is real.** It surfaced as M2's "creates an issue with optimistic insert and persists after reload" failing intermittently in the combined run while passing in isolation. The failure mode was the visible title disappearing after reload — exactly what cross-file `purgeByTitlePrefix` would do.
- **The fix is one line per file plus a comment.** Cheap.
- **Future modules trivially get their own prefix** (`[e2e-m4]`, `[e2e-m5]`). The naming pattern is mechanical.

**Why a different approach:**

- Force `workers: 1` in the Playwright config. This serializes every test, doubling the wall-clock time. Acceptable in CI; punishing locally.
- Separate Convex workspaces per test file via fixture setup. More moving parts; the demo workspace's whole point is shared state.
- Stop using a prefix and tag rows with a per-test UUID instead. More invasive change to a working pattern.

**Consequences:**

- ✅ The combined `pnpm test:e2e` run is stable with default workers (11 / 11 passing).
- ✅ Each test file's cleanup is independent and the failure mode of a forgotten prefix is obvious.
- ⚠️ Adds a small mechanical step when seeding a new test file. Documented in the relevant spec's header comment.

---

## ADR-011: `boardOrder` as a float, not an integer

**Context:** Module 4 ships a kanban board with drag-and-drop reordering. Reordering needs persistent rank. Two shapes:

- **Integer rank** — every reorder is `update issues set boardOrder = boardOrder + 1 where ...` for the rows after the drop point. Every drag triggers `O(n)` writes.
- **Float rank** — set the new row's `boardOrder` to the average of the rows immediately above and below it. Every drag is `O(1)` writes, with a periodic rebalance if floats get too close to each other.

**Decision:** Use **float ordering** with fractional indexing. `issues.boardOrder: v.number()`. New issues are created with `(max(boardOrder) + 1000)` so they land at the bottom of the column. M4 implements the average-of-neighbours drop and a future M5 polish item adds a rebalance scheduled function.

**Why float:**

- **Optimistic update stays tiny.** Drag-end writes one issue's `boardOrder`; the optimistic store rewrites one row. No fan-out.
- **Convex is reactive per-doc.** A single field change republishes the affected queries; integer-rank rewrites would invalidate `O(n)` docs and burn re-renders.
- **Industry-standard pattern.** Linear, Jira, Notion all use fractional indexing for the same reason.

**Why I would pick integer rank:**

- The scale is small enough that `O(n)` writes are imperceptible.
- The team doesn't want a periodic rebalance scheduled function and is happy taking the n-write cost.
- Order needs to be exposed to non-app consumers (analytics, external sync) that expect contiguous integers.

**Consequences:**

- ✅ Drag-end is `O(1)` write + `O(1)` optimistic.
- ✅ Insert-at-position is the same operation as drag-to-position; no special case.
- ⚠️ Floats drift toward equality over many reorders. M5 adds a scheduled rebalance that renumbers the column with `0, 1000, 2000, …` once any neighbour gap drops below a threshold.
- ⚠️ Adjacent ordering reads need a stable secondary key (createdAt) to break ties when boardOrder is exactly equal between two rows immediately after a fresh insert with the same default.

---

## ADR-012: `@radix-ui/react-dialog` as a direct dependency

**Context:** cmdk wraps Radix Dialog internally but doesn't expose `Dialog.Title` or `Dialog.Description` props. Without them, Radix logs verbose `DialogContent requires a DialogTitle` warnings in dev. Adding the `sr-only` title and description means importing `@radix-ui/react-dialog` directly from the consumer code — which pnpm's strict module boundaries block unless the package is declared as a project dependency.

**Decision:** **Declare `@radix-ui/react-dialog` as a direct dependency** in `package.json`. The package is already installed as a transitive of cmdk; this declaration just surfaces it.

**Why surface the transitive:**

- **Radix's a11y warnings are loud and right.** A `<DialogTitle>` is genuinely useful for screen reader users; the warning is doing me a favor.
- **The dep isn't really new.** It's the substrate cmdk's Dialog is built on. Declaring it documents the dependency that already exists.
- **Future cmdk versions might decouple from Radix.** If that ever happens, the direct dependency is still safe to use; if Radix moves to a different package, that's a release-notes-driven migration.

**Why a different approach:**

- Live with the dev warnings. They're dev-only; production bundles are silent. The trade-off is that screen reader users don't have a proper Title element.
- Fork cmdk and patch the wrapper to forward Title / Description props. Heavy maintenance burden, not justified.

**Consequences:**

- ✅ Radix Dialog dev warnings silenced.
- ✅ Screen reader users get a proper Dialog Title and Description.
- ⚠️ One more entry in `package.json`. Trivial cost.
