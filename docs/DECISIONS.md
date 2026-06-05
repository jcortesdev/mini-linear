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

---

## ADR-013: `pointerWithin` + card-preference + `rectIntersection` for kanban collision

**Context:** dnd-kit's default collision strategy `closestCorners` measures distance from the active item's corners to droppable corners. For a kanban where most columns are empty (the demo workspace starts with issues only in two columns), it consistently preferred a card in a busy adjacent column over the empty column the cursor was visibly inside. The drop felt broken: drag into an empty Todo column with the cursor squarely inside its rectangle, drop, watch the card land back in In Progress because a card there was a few pixels closer to a corner.

**Decision:** Custom `collisionDetection` callback. Run `pointerWithin(args)` first — that returns droppables whose rect contains the pointer. If anything matches, sort cards before columns (so dropping on a slot inserts there instead of appending). If nothing matches (keyboard drag, no pointer), fall back to `rectIntersection(args)`.

**Why this strategy:**

- **Pointer position is the user's intent.** When the cursor is over an empty column rectangle, the user wants to drop there. `pointerWithin` codifies that.
- **Card-over-column preference** keeps the "drop on a specific slot" behavior. Without the sort, dropping on a card would frequently resolve to the column droppable behind it and append instead of insert at the slot.
- **`rectIntersection` for keyboard** because there's no cursor. dnd-kit's `KeyboardSensor` translates arrows into bounding-box overlap.
- **Standard pattern.** Linear / Trello / Jira-style multi-container DnD examples in the dnd-kit docs use this exact combination.

**Why a different strategy:**

- The board has only one container and reordering is intra-list. `closestCenter` would be the canonical answer.
- The empty-column problem doesn't exist (every column always has ≥ 1 card). Then `closestCorners` is fine.

**Consequences:**

- ✅ Drops into empty columns work intuitively.
- ✅ Dropping precisely between two cards inserts at that slot.
- ⚠️ The card-preference sort runs on every pointermove during a drag. Cheap (O(n) over visible droppables) but worth knowing.

---

## ADR-014: Dashed-border source placeholder (not opacity ghost)

**Context:** During a drag, the source card needs some visual treatment to (a) show the user where the card came from and (b) preserve the layout so cards below don't shift. The canonical dnd-kit demo uses `opacity: 0.3` on the source while the `DragOverlay` portal renders the dragged clone at full opacity. The composited 30% opacity tripped axe's `color-contrast` rule (axe computes effective foreground = `rgba(text, 0.3)` over white = ~1.5:1 contrast). The pickup axe test had to exclude the ghost via `[aria-pressed="true"]` to pass.

**Decision:** Replace the opacity ghost with a **dashed-border placeholder**. While `isDragging` is true, render the card content inside a wrapper with `visibility: hidden` (preserves dimensions, removes from a11y tree) and overlay a dashed-border outline. Drop the `[aria-pressed="true"]` axe exclusion.

**Why dashed-border:**

- **No text inside the placeholder** → nothing for axe's color-contrast rule to evaluate → the exclusion goes away cleanly.
- **Layout is preserved** by keeping the hidden content sized via `visibility: hidden` (not `display: none`).
- **The pattern is widely understood** (Trello / Jira / Linear all use a dashed slot for the source during drag).

**Why opacity instead:**

- The card needs to remain readable during drag (some users prefer to see context). For this app the DragOverlay clone covers that need — it's at full contrast and tracks the cursor.

**Consequences:**

- ✅ Pickup axe test passes without excluding the ghost; only the `region` rule on the portal-mounted overlay stays disabled (inherent to drag overlays).
- ✅ The drag link still needs an accessible name even when its content is hidden — `aria-label="LIN-N: title"` on the `<Link>` itself (M5 added this as part of the same fix).
- ⚠️ The `visibility: hidden` wrapper has to match the card's natural dimensions exactly. Solved by keeping `BoardCardContent` inside the placeholder wrapper.

---

## ADR-015: dnd-kit announcement callbacks read state via `useRef`, not closure

**Context:** dnd-kit's `accessibility.announcements` callbacks (`onDragStart`, `onDragOver`, `onDragEnd`, `onDragCancel`) fire outside React's render cycle. To produce domain copy like *"Issue LIN-42 moved to column In progress at position 2 of 4"*, the callbacks need the current `grouped` state (the per-status arrays of issues). A captured closure over `grouped` is stale at `onDragEnd`: the optimistic patch already wrote `boardOrder` and `status`, but the closure still holds the pre-patch grouping.

**Decision:** Hold the current `grouped` in a `useRef`. Update it on every render with `groupedRef.current = grouped`. Announcement callbacks read `groupedRef.current` — always the latest, evergreen.

**Why ref:**

- **dnd-kit's callbacks live outside React's render lifecycle.** Treating them like component callbacks (closure-fresh per render) doesn't work. Refs are the canonical escape hatch.
- **The state in question is read-only inside the callback** — no setState; just a lookup for the new position.
- **One-line update on every render** keeps the ref in sync without `useEffect` overhead.

**Why a different approach:**

- Use `useCallback` with `grouped` in the deps. Rebuilds the callback on every render, but dnd-kit reads the callback through `accessibility.announcements` which is captured once at `DndContext` mount. So this doesn't actually help.
- Push the announcement copy into Convex query results. Way over-engineered.

**Consequences:**

- ✅ `onDragEnd` reports the correct post-drop position.
- ⚠️ Two ways to read state in the file — direct `grouped` for render, `groupedRef.current` for the callbacks. Documented inline.

---

## ADR-016: Presence as a 10s heartbeat + 30s staleness window

**Context:** Module 5 ships realtime presence avatars on the issue detail panel — "who is also looking at this issue right now?" Two implementation shapes:

- **Subscription channel** — explicit `subscribe` / `unsubscribe` on the client, server tracks connections, presence is computed from connection state. Tight coupling to the realtime transport.
- **Live query over a heartbeat table** — clients write their `lastHeartbeat` on a timer; the presence query filters out anything older than a staleness window. Decoupled from the transport, falls out naturally from Convex's reactive query model.

**Decision:** **Heartbeat + staleness.** Schema: `presence { workspaceId, issueId, userId, lastHeartbeat }` with indexes on `by_issue_and_user` and `by_issue`. The mounted detail panel hits `api.presence.heartbeat({ issueId })` every 10 seconds while open. The `api.presence.listByIssue` query returns rows where `lastHeartbeat > now - 30_000` and `userId !== viewer`. A daily cron prunes rows older than 7 days (defensive — the staleness filter already hides them from queries).

**Why 10s heartbeat / 30s window:**

- **Three intervals** balances "feels live" against "tolerates network jitter." A single dropped heartbeat doesn't flicker the avatar list — the user has 30 seconds before they're considered gone.
- **Mobile networks routinely drop a keep-alive across a backgrounded tab returning to foreground.** A tighter window would cause avatars to vanish and reappear constantly. Three intervals smooths that.
- **Storage cost is bounded.** At one heartbeat per 10s per viewer per issue, the working set is tiny. The cron handles the long tail.

**Why a subscription channel:**

- Sub-second presence updates (e.g. live cursors) — the polling cadence becomes the bottleneck. Mini-Linear doesn't need that.
- The realtime transport already exposes connection state cheaply — Convex doesn't.

**Consequences:**

- ✅ Multi-tab presence works without any websocket subscription code; Convex's reactive query republishes when a heartbeat lands.
- ✅ Tab close, sign-out, and network drop all self-evict within 30 seconds — no explicit cleanup required.
- ⚠️ A user closing all tabs leaves their last heartbeat row in `presence` until the cron sweeps it. Cosmetic; not visible to anyone because the staleness filter excludes it.
- ⚠️ Two viewers can briefly miss each other if they open the issue more than 30 seconds apart and one closes before the other's first heartbeat. Acceptable at portfolio scope.

---

## ADR-017: Tiptap with markdown round-trip — no schema change

**Context:** M2 shipped the description editor as a `<textarea>` + Write/Preview toggle. It works but felt rough in a recruiter demo: users typed raw markdown and toggled to preview to see the result. M5 promised a richer editor without changing the underlying storage format. Two shapes:

- **Switch to HTML / ProseMirror JSON storage.** Tiptap stores JSON natively; converting at the storage layer means writing a migration and changing the Convex validator.
- **Keep markdown storage, parse on load + serialize on save.** Tiptap's `tiptap-markdown` extension provides both directions over `markdown-it`.

**Decision:** **Tiptap with markdown round-trip.** Add `@tiptap/react` + StarterKit + Link + Placeholder + `tiptap-markdown`. Convex `issues.description` stays `v.optional(v.string())` storing markdown. The editor loads the markdown into the ProseMirror document, the user edits via a bubble menu + StarterKit input rules, and `editor.storage.markdown.getMarkdown()` serializes on save.

**Why round-trip storage:**

- **No migration.** The schema stays `v.string()` and every existing description renders unchanged.
- **The full-page route can still read the same string.** No conditional rendering by format.
- **Markdown is portable.** A future contributor could swap the editor library and the data still makes sense.
- **`html: false` on the Markdown extension** treats raw HTML in stored markdown as literal text — kills an XSS surface that would otherwise need a sanitizer.

**Why switch storage:**

- Tiptap's full feature set (collaborative cursors via Yjs, custom mark schemas, tables-with-merged-cells) needs JSON storage. Mini-Linear doesn't use any of that.

**Consequences:**

- ✅ Users get markdown input rules without typing markdown (`# A` + space promotes to H1 in place; the literal `#` is consumed by ProseMirror's input rule).
- ✅ The bubble menu on selection covers Bold / Italic / Strike / Code / Link without keyboard shortcuts.
- ✅ Dynamic import (`next/dynamic({ ssr: false })`) keeps the ~85kB editor out of the `/issues` list bundle.
- ⚠️ Round-trip is lossy at the edges — uncommon markdown constructs (footnotes, definition lists) round-trip imperfectly. StarterKit's coverage matches `remark-gfm`-equivalent features only.
- ⚠️ Two markdown libraries are now in the bundle: `markdown-it` (via `tiptap-markdown`) and whatever StarterKit pulls. Acceptable cost.

---

## ADR-018: 30-day soft-delete TTL via a Convex cron

**Context:** [ADR-007](#adr-007-soft-delete-with-undo-not-hard-delete--recreate) accepted the trade-off that soft-deleted rows accumulate forever. M5 promised to revisit. Two ways to bound the accumulation:

- **TTL field on the doc + scheduled function.** Add a cron that scans for `deletedAt < cutoff` and hard-deletes.
- **Move to hard-delete with a client-side "trash bin" UI.** Restore lists the trash, user clicks Restore on a row. More UI, less hidden state.

**Decision:** **Daily Convex cron at 03:00 UTC** runs `internal.issues.purgeOldSoftDeleted`, which hard-deletes issues with `deletedAt < Date.now() - 30 * 24 * 60 * 60_000` (30 days). The mutation is `internalMutation` — not exposed to the client. The cron is declared in `convex/crons.ts` using `cronJobs().daily(...)`.

**Why a TTL cron:**

- **The Undo window is in-session (~6 seconds).** Any row reaching the cron is truly abandoned. No false positives.
- **Off-peak hour** (03:00 UTC) keeps incident fallout away from US/Europe working hours.
- **Internal mutation** removes any client-side attack surface — the function is only invokable from the Convex dashboard or the scheduler.
- **Implementation cost is one file (`crons.ts`) + one mutation.** Cheap.

**Why a trash UI instead:**

- Users want to recover deletions days later (e.g. they realized they shouldn't have deleted Issue X last Tuesday). Mini-Linear's Undo-then-purge model says no.

**Consequences:**

- ✅ Soft-deleted rows are bounded.
- ✅ The cron is testable in isolation (no auth context) and the mutation is small.
- ⚠️ A purged row is gone — no recovery. The 30-day window is generous; acceptable.
- ⚠️ Full table scan inside the mutation. Acceptable at portfolio scale; revisit if the workspace ever holds tens of thousands of issues by adding an index on `deletedAt`.

---

## ADR-019: Mobile board = single-column-with-dropdown filter (not horizontal scroll)

**Context:** The desktop board renders six status columns horizontally with `overflow-x-auto` for the columns past the viewport. Phones are 360-430px wide — a single column already barely fits the cards. Three options for mobile:

- **Horizontal scroll, unchanged.** Six 280px columns in 1700px of horizontal scroll. Users have to swipe between columns and rare cross-status drags happen across the scroll boundary.
- **Stack vertically, all columns.** Show every column stacked. Cards in Backlog plus Todo plus In progress plus … = a very long page with collapsed/expanded columns.
- **Single column at a time, with a filter.** Pick a status from a dropdown; render only that column; cross-status moves happen via the issue detail's status picker.

**Decision:** **Single column with a dropdown filter** below `md` (768px). The filter is a sticky bar at the top of the board surface with a button trigger (current status icon + label + count + chevron) that opens the M2 `<OptionsPopover>` with the six statuses listed. Selecting a status swaps the visible column.

**Why this UX:**

- **Drag across six columns on a phone is the wrong interaction.** No matter how good the touch sensor is, a card can't visually leave the viewport during a drag — there's nowhere for it to go.
- **The status picker in the detail panel already exists** and is the canonical way to change status on touch — one tap to open the issue, one tap to switch status.
- **The dropdown reuses M2's `OptionsPopover`** — already accessible, already keyboard-navigable, already viewport-clamped. No new component.
- **Vertical real estate is reclaimed** vs a chip bar (52px → 36px), which matters on portrait phones.

**Why horizontal scroll instead:**

- The recruiter is supposed to recognize the desktop board on mobile too. Trade-off: recognizable but unusable for actual drag interactions.

**Consequences:**

- ✅ The mobile board feels native, not a desktop layout squished.
- ✅ Cross-status moves go through a path that already worked on touch (the status picker).
- ⚠️ Recruiters using mobile may miss the kanban story — they see one column at a time. The README mentions the desktop demo URL explicitly.
- ⚠️ Drag-within-a-column still works on touch via the TouchSensor — see [ADR-020](#adr-020-dnd-kit-touchsensor-with-200ms-long-press).

---

## ADR-020: dnd-kit `TouchSensor` with 200ms long-press

**Context:** Adding a `TouchSensor` alongside `PointerSensor` introduces an ambiguity: a touch on a card could mean "tap to navigate" (the card is a `<Link>`) or "start dragging." dnd-kit's `TouchSensor` accepts an `activationConstraint` to disambiguate.

**Decision:** **`useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })`**. A touch holds for 200ms within a 5px radius to start a drag. A quick tap or a tap-and-drag triggers the link's navigation instead.

**Why 200ms / 5px:**

- **200ms matches the iOS / Android long-press convention.** Users instinctively long-press to enter "rearrange mode" in native apps.
- **5px tolerance** allows a small finger wiggle during the press without the press being interpreted as a swipe / drag-too-soon.
- **Tap-to-navigate stays instant.** Below 200ms, the link fires.

**Why other values:**

- 150ms long-press is the Material Design spec but feels jumpy on iOS — many iOS users would activate drag accidentally while pausing to read a card.
- 500ms is too slow — users feel the app is laggy.
- No tolerance (`tolerance: 0`) makes the press fail on slightly unsteady fingers.

**Consequences:**

- ✅ Long-press to drag works; quick tap navigates. Both feel native.
- ✅ Mouse and keyboard behavior unchanged (separate sensors).
- ⚠️ Screen reader users on touch devices need `KeyboardSensor` (still wired); the announcer reads the same domain copy.

---

## ADR-021: Sidebar mobile drawer via Radix Dialog (no new dep)

**Context:** Below `lg` (1024px), the static sidebar collides with the main content. The mobile drawer pattern is universal — hamburger button in the topbar, drawer slides in from the left, scrim behind, Esc closes, focus-trapped. Two libraries handle this well: `@radix-ui/react-dialog` (already in deps via cmdk) and `vaul` (a dedicated drawer library).

**Decision:** **Reuse `@radix-ui/react-dialog`.** Create a `<SidebarDrawerProvider>` that wraps a `<Dialog.Root>` with `<Dialog.Overlay>` + `<Dialog.Content>` rendering the same `<Sidebar>` component. The trigger is a hamburger button in the topbar (`<SidebarDrawerTrigger>`). Both are `lg:hidden` so the desktop layout is unchanged.

**Why Radix Dialog:**

- **Already in deps** (cmdk + the slide-over dialogs).
- **Focus trap, Esc, scrim, portal, ARIA all free.** No bespoke drawer logic.
- **`useReducedMotion` gates the slide animation** — falls back to instant in/out.
- **Closes on route change** via a `useEffect([pathname])` so navigating from a drawer link does the right thing.

**Why vaul:**

- vaul handles iOS swipe-to-dismiss and the natural drawer drag gesture. Mini-Linear's drawer is small enough that a tap on the scrim or X is fine — the swipe gesture isn't worth a new dep.

**Consequences:**

- ✅ Sidebar drawer ships in ~80 LOC with no new dependency.
- ✅ A11y matches the rest of the app's modal patterns (cmdk dialog, slide-over).
- ⚠️ No swipe-to-dismiss. Tap on scrim or X works fine; the gap to native is small.

---

## ADR-022: Three-way theme toggle with anti-flash init script

**Context:** Tailwind v4 ships `dark:` driven by `prefers-color-scheme` out of the box. A user can override their OS preference by toggling a theme switch in-app. Three concerns:

- **Persisting the choice** so a reload preserves it.
- **Avoiding the dark→light flash** on hard reload for users in dark mode (server renders without knowing the user's preference, hydrates afterward).
- **Supporting "follow system"** as a third explicit mode (not just light vs dark).

**Decision:** **Three modes (`'light'` / `'dark'` / `'system'`)** stored in `localStorage['mini-linear.theme']`. Tailwind's `dark:` variant is switched to a `data-theme` attribute strategy via `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *))`. The root layout `<head>` injects a small inline `<script>` (the `THEME_INIT_SCRIPT` string constant) that reads localStorage + `prefers-color-scheme` and sets `data-theme` on `<html>` **synchronously before the first paint**.

**Why this shape:**

- **`data-theme` attribute lets the toggle override the OS without re-running media queries** — a flip is one DOM attribute change.
- **The init script eliminates the dark-mode flash.** Without it, every hard reload for a dark-mode user shows ~80ms of light theme while React hydrates.
- **`'system'` is a real mode, not "no choice."** Users can explicitly opt into following the OS, and the live `change` listener on the media query keeps the theme in sync.
- **`role="group" aria-label="Theme"`** on the segmented control with `aria-pressed` on each segment matches the bubble menu's a11y pattern.

**Why a different shape:**

- Two modes (light / dark only) — simpler but forces a choice and loses the "respect my OS" affordance.
- CSS-only via `@media (prefers-color-scheme: dark)` — no user override possible.

**Consequences:**

- ✅ Three-mode toggle ships with zero new deps and no flash.
- ✅ Reload survives via localStorage. Switching the OS theme while in `'system'` mode flips the app live.
- ⚠️ `dangerouslySetInnerHTML` is used for the init script. Content is build-time-known, no user input. Comment in code documents the bypass.
- ⚠️ `suppressHydrationWarning` on `<html>` because the init script sets `data-theme` after SSR but before React hydration. Acceptable; the attribute is the only thing changing.

---

## ADR-023: Static `aria-label` on the slide-over wrapper (not `aria-labelledby`)

**Context:** The slide-over panel was originally wired with `<motion.div role="dialog" aria-labelledby="issue-detail-title">` pointing into the `<h1 id="issue-detail-title">` inside the panel. The wrapper renders the moment the motion enters, before Convex's `useQuery(api.issues.get, { id })` resolves. During that ~100ms window the panel renders its `Loading…` fallback with no h1 — so `aria-labelledby` dangles. axe runs in the M2 Playwright suite and flags `aria-dialog-name` ("references elements that do not exist or are empty"), inconsistently in dev but reliably against the prod build.

**Decision:** **Hard-code `aria-label="Issue details"`** on the slide-over wrapper. Keep the `<h1 id="issue-detail-title">` inside the panel for sighted users + heading navigation, but drop the `aria-labelledby` reference. The wrapper's name is now present from the instant the wrapper renders, regardless of inner content.

**Why static:**

- **Removes the race entirely.** The accessible name is a string constant, available immediately.
- **The h1 inside is still useful** — screen reader users navigating by headings will land on it, and the visible title is unchanged.
- **Generic name is fine.** A screen-reader user opening the panel hears "Issue details, dialog" and then the content reads itself. The issue's specific title comes through the h1 a moment later.

**Why aria-labelledby into the panel:**

- The dialog's name reads as the issue title, which is more specific. Trade-off: dangling reference during load.
- Could be fixed by also waiting for the h1 in the e2e before running axe — but that papers over a real UX issue (a screen reader user opening the panel during load would hear nothing).

**Consequences:**

- ✅ axe `aria-dialog-name` passes from the moment the wrapper mounts.
- ✅ No e2e gymnastics — the test asserts the dialog is visible and axe is happy.
- ⚠️ Less specific accessible name. Acceptable trade.

---

## ADR-024: Up-one-level `(..)` intercept for `/board` → `/issues/[id]`

**Context:** Both the `/issues` list and the `/board` kanban link cards to `/issues/[id]` for the detail view. The list uses a same-level intercept: `app/(app)/issues/@modal/(.)[id]/page.tsx`. The board originally also defined `app/(app)/board/@modal/(.)[id]/page.tsx`, which the M5 audit revealed is dead code: the `(.)` marker matches the segment one level above the slot — `/board/[id]` — which is a route that doesn't exist. So clicks on a board card were caught by the **issues** intercept instead, mounting the slide-over over the `/issues` list visually, then `router.back()` would land on `/board` after a brief flash of the issues list during the close animation.

**Decision:** **Rename the board intercept path** from `(.)[id]` to `(..)issues/[id]`. The `(..)` marker climbs one segment from the slot's container (`/board/@modal/` → `/board/` → `/`), so it resolves `/issues/[id]` while the `/board` layout is mounted. Now a click from `/board` keeps the board mounted, the slide-over renders inside `/board`'s `@modal` slot, and `router.back()` returns cleanly to `/board` with no flash.

**Why `(..)`:**

- **It's the canonical Next.js way** to intercept a route from a sibling segment. The dead `(.)[id]` was a mistake from the original M4 setup that nobody caught because the issues intercept always fired.
- **The fix is a path rename only.** File contents are unchanged.
- **No change to the card href** — the board cards still link to `/issues/[id]`, which is the right canonical URL.

**Why a different fix:**

- Change the board card href to `/board/issues/[id]` and add a full-page route at that URL. More files, ugly URL.
- Drop the board intercept and let `/board` cards always full-navigate. Loses the Linear-feeling slide-over from the board.

**Consequences:**

- ✅ Mobile sheet close from /board lands on /board with no flash of /issues underneath.
- ✅ The reload-at-slide-over URL still falls back cleanly to the full-page `/issues/[id]` route (same as before).
- ⚠️ Two intercepts now exist for the same target URL (`/issues/[id]`): the `/issues` `(.)` one and the `/board` `(..)issues/` one. Next resolves based on the current segment — the right one fires automatically.
