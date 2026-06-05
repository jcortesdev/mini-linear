# Architecture

This document explains the technical structure and key design decisions of the project. It is intentionally short and focused — for individual trade-offs see [`DECISIONS.md`](./DECISIONS.md).

All five modules shipped. The app supports authentication via five providers, an issues CRUD with a slide-over detail panel that works as a bottom sheet on mobile, a `/board` kanban with mouse + touch + keyboard drag-and-drop, a ⌘K command palette, optimistic updates across every mutation surface, realtime presence avatars per issue, a Tiptap rich-text description editor with markdown round-trip, and a three-way light/dark/system theme toggle. Lighthouse on `/sign-in` (desktop): 96 / 100 / 100 / 100.

## High-level overview

```
┌────────────────────────────────────────────────────────────────────┐
│                     Browser (React 19, App Router)                  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  RSC shell:   auth, route guards, layout chrome              │  │
│  │  Client:      list, board, slide-over panel, pickers         │  │
│  │  cmdk:        ⌘K, g i / g b / ?, contextual actions          │  │
│  │  dnd-kit:     Pointer + Touch + Keyboard sensors, ARIA       │  │
│  │  Tiptap:      ProseMirror + markdown round-trip              │  │
│  │  Theme:       data-theme on <html>, anti-flash init script   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│               ConvexReactClient (WebSocket)                         │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│                          Convex backend                              │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Auth:    Convex Auth (GitHub · Google · LinkedIn ·          │  │
│  │           Resend magic link · Anonymous)                     │  │
│  │  DB:      users · workspaces · members · labels · issues ·   │  │
│  │           presence                                            │  │
│  │  Queries: list / get / listByIssue — reactive                │  │
│  │  Mutations: create · update · remove (soft) · restore ·      │  │
│  │             heartbeat                                         │  │
│  │  Crons:   daily purgeOldSoftDeleted (30-day TTL)             │  │
│  │  Admin:   reseedDemo · rebalanceBoardOrder (internal)        │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                Vercel (Next.js frontend, custom domain)
```

## Rendering strategy

This is a **client-rendered app with a thin RSC shell**, hosted on Vercel, with Convex as the only backend.

- The `app/` root layout is a Server Component that wraps `ConvexAuthNextjsServerProvider` (auth headers) and a Client Component (`ConvexClientProvider`) that owns the `ConvexReactClient`. Everything below the providers is a Client Component because it needs `useQuery` / `useMutation` / event handlers / DOM access.
- The root layout also injects an inline `<script>` in `<head>` that reads `localStorage` + `prefers-color-scheme` and sets `data-theme` on `<html>` synchronously before hydration — kills the dark→light flash on hard reload for users in dark mode.
- Routes that need data (`/issues`, `/issues/[id]`, `/board`) live under the `(app)` route group and share a layout with the sidebar (or mobile drawer), topbar (with palette trigger + theme toggle + sign out), and palette provider.
- The `/sign-in` route stands outside the `(app)` group and renders the auth form without the app chrome.
- There are no API routes for data. Convex mutations replace what Server Actions would otherwise do. The only Route Handler is the auth callback wired by `@convex-dev/auth`.

## Data layer

Convex is the single source of truth. Tables in [`convex/schema.ts`](../convex/schema.ts):

```ts
users        // managed by Convex Auth (spread from authTables)
workspaces   // { name, slug, isDemo }
members      // { workspaceId, userId, role: 'owner' | 'member' }
labels       // { workspaceId, name, color }
issues       // { workspaceId, number, title, description?, status,
             //   priority, assigneeId?, creatorId, labelIds[],
             //   boardOrder, createdAt, updatedAt, deletedAt? }
presence     // { workspaceId, issueId, userId, lastHeartbeat }
```

Indexes:

- `members.by_user` / `by_workspace_and_user` — workspace membership lookups on every page load and on every mutation's authorization check.
- `issues.by_workspace_and_number` — list ordering by LIN-N.
- `issues.by_workspace_and_status` — kanban column queries.
- `issues.by_assignee` — future "my issues" filter.
- `presence.by_issue_and_user` — heartbeat upsert path.
- `presence.by_issue` — viewer list for the detail panel.
- `presence.by_user_and_workspace` — sign-out / tab-close cleanup.

### Why Convex

See [ADR-001](./DECISIONS.md#adr-001-convex-instead-of-supabase--postgres) for the full context. The short version: realtime is automatic, optimistic updates are a first-class hook (`.withOptimisticUpdate`), and the SDK is TypeScript end-to-end with generated types from the schema. Trade-off accepted: less recruiter recognition than Postgres / Supabase.

## Authentication

[`convex/auth.ts`](../convex/auth.ts) wires up `@convex-dev/auth` with five providers:

- **GitHub OAuth** — primary for tech recruiters.
- **Google OAuth** — universal fallback.
- **LinkedIn OAuth** — captures non-tech recruiters.
- **Resend magic link** — passwordless fallback when corp policy blocks OAuth.
- **Anonymous** — drives the "Try the demo" button on `/sign-in`.

OAuth callback URL pattern: `https://<deployment>.convex.site/api/auth/callback/<provider>`. The `.convex.cloud` URL is the WebSocket endpoint for queries; `.convex.site` is the HTTP endpoint for callbacks and the magic-link redirect. JWT signing keys are generated once per deployment via `npx @convex-dev/auth`.

The `afterUserCreatedOrUpdated` callback auto-joins every new user (anonymous and OAuth) to the demo workspace, creating it lazily with seed labels and issues if it doesn't exist. This collapses a two-round-trip flow into one and kills a race condition where the React-side `ConvexClient` didn't yet have the new auth tokens when the client tried to follow up with a `joinDemoWorkspace` mutation.

Route protection lives in [`src/proxy.ts`](../src/proxy.ts) (Next 16 renamed `middleware.ts` → `proxy.ts`) via `convexAuthNextjsMiddleware`: `/sign-in` redirects authenticated users to `/issues`, `/issues` and `/board` redirect unauthenticated users to `/sign-in`. Everything else is open.

## State model

Three layers, ordered from outermost to component-local:

1. **Convex queries** — source of truth. `useQuery(api.issues.list)`, `useQuery(api.issues.get, { id })`, `useQuery(api.members.list)`, `useQuery(api.labels.list)`, `useQuery(api.presence.listByIssue, { issueId })`. Every query is reactive: the server tracks per-document dependencies and any mutation that touches a depended document republishes the affected query, which re-renders the consumer. No invalidation API; no manual refetch.
2. **Optimistic store** — `localStore.setQuery(api.x.y, args, next)` inside `.withOptimisticUpdate`. Reconciles silently when the server replies with the same shape; rolls back on error. See "Optimistic mutations" below.
3. **Component state** — `useState` for UI concerns (open/closed, focused index, draft text, selected mobile board column). Three React Contexts only: `PaletteProvider` (palette open + cross-route intents), `SidebarDrawerProvider` (mobile drawer open), `ThemeProvider` (light/dark/system mode + resolved value). All UI-only state.

Zustand, Redux, Jotai are intentionally absent. The Convex client provides the only global cache the app needs.

## Optimistic mutations

[`src/lib/issue-mutations.ts`](../src/lib/issue-mutations.ts) exposes two hooks consumed by every mutation surface in the app:

- `useUpdateIssue()` — for `title`, `status`, `priority`, `description`, `assigneeId`, `labelIds`, `boardOrder`. Resolves relational fields (`assigneeId` against `api.members.list`, `labelIds` against `api.labels.list`) so the optimistic row matches the server's shape exactly, and writes the patched doc to both the `api.issues.list` and `api.issues.get` caches in one pass.
- `useRemoveIssue()` — filters the deleted issue out of the cached list. Restore (the Undo path) talks to the server directly; recreating the optimistic shape across React refs across the panel unmount wasn't worth the complexity.

Consumers (8): the four pickers (status, priority, assignee, labels), the row's inline title editor, the description editor, the detail panel (title + delete), the palette's contextual actions, and the board's drag-end handler. ~150 LOC of duplicated `.withOptimisticUpdate` logic removed.

## Command palette

[`src/components/palette/`](../src/components/palette/) contains the palette implementation.

- `<PaletteProvider>` lives at the root of `(app)/layout.tsx` and owns context: `{ open, setOpen, pendingNewIssue, requestNewIssue, consumePendingNewIssue, openWithSearch, pendingSearch, consumePendingSearch }`.
- `<CommandPalette>` is mounted once by the provider. It wraps cmdk's `<Command.Dialog>` (which wraps Radix Dialog) with a controlled input value, contextual issue resolution from `usePathname()`, and groups: Create, Navigation, Issue LIN-N (when an issue is open), Change status, Change priority, Assign to, Toggle label, Keyboard shortcuts.
- Leader-key sequences (`g i`, `g b`, `?`) are wired via a pure helper [`src/lib/key-sequence.ts`](../src/lib/key-sequence.ts) — a deterministic matcher with a 900ms buffer, modifier and editable-target guards, and Vitest tests covering each case.
- ⌘K / Ctrl+K toggle works from anywhere — including form inputs — via a document-level keydown listener with `preventDefault` to override Chrome's omnibox-search shortcut.
- Focus restoration on close uses a snapshot ref. Radix's built-in FocusScope can't be trusted: cmdk's `Command.Input` autofocuses synchronously during the same render that mounts the dialog, so FocusScope captures the input as "previous focus." See [ADR-006](./DECISIONS.md#adr-006-snapshot-on-open-focus-restoration-for-the-command-palette).
- Below `sm` (640px) the palette dialog goes full-screen for finger reachability; above `sm` it's the centered popup.

## Drag-and-drop

[`src/app/(app)/board/`](../src/app/(app)/board/) contains the kanban board.

- **Three sensors:** `PointerSensor` (`distance: 8` activation, so a plain click on a card still navigates to the slide-over), `TouchSensor` (`delay: 200ms tolerance: 5px`, so a tap navigates and a long-press starts a drag), and `KeyboardSensor` (Space → arrows → Space, with `sortableKeyboardCoordinates`).
- **Float-index ordering** via `issues.boardOrder` (a `v.number()`). Drop-end computes the new value as `(prev + next) / 2`; edges use `first / 2` or `last + 1000`. Pure helper in [`src/lib/board-order.ts`](../src/lib/board-order.ts) with Vitest cases. The internal mutation `issues.rebalanceBoardOrder` can rewrite a column to `1000, 2000, 3000…` if float convergence ever fires the dev-only `console.warn`.
- **Multi-container collision detection** — `pointerWithin` + a card-over-column preference sort + `rectIntersection` as the keyboard fallback. The default `closestCorners` felt broken when columns were mostly empty (it preferred a card in a busy adjacent column over the empty space the cursor was inside). See [ADR-013](./DECISIONS.md#adr-013-pointerwithin--card-preference--rectintersection-for-kanban-collision).
- **Cross-route intercept.** Both `/issues` and `/board` open the slide-over via parallel + intercepting routes. `/issues/@modal/(.)[id]/page.tsx` intercepts when navigating from `/issues`; `/board/@modal/(..)issues/[id]/page.tsx` intercepts the same target URL when navigating from `/board`. Both forward to the same `<InterceptedIssueModal>` → `<IssueDetailSlideOver>`.
- **Dashed-border placeholder** in the source slot while a drag is in flight (was `opacity: 0.3` initially, swapped because the composited opacity tripped axe's color-contrast rule). See [ADR-014](./DECISIONS.md#adr-014-dashed-border-source-placeholder-not-opacity-ghost).
- **`DragOverlay`** portal-mounts the dragged card on `document.body` so it slides freely across columns. The portal trips axe's `region` best-practice rule during pickup (the overlay lives outside `<main>`); the pickup axe test disables that rule and notes the trade in code.
- **ARIA announcer.** `accessibility.announcements` on the `DndContext` returns domain copy: `"Picked up issue LIN-N."`, `"Issue LIN-N is over column In progress."`, `"Issue LIN-N moved to column Todo at position 2 of 4."`, `"Movement cancelled. Issue LIN-N returned to its original position."`. Callbacks read `grouped` via `useRef` because dnd-kit calls them outside React's render cycle (a captured closure would be stale at `onDragEnd`).
- **Mobile board** below `md` (768px) renders one column at a time, filtered via a dropdown trigger in a sticky top bar. The dropdown reuses M2's `OptionsPopover`. Cross-status moves on mobile go through the issue detail's status picker — dragging across six columns on a phone is anti-pattern. See [ADR-019](./DECISIONS.md#adr-019-mobile-board-single-column-with-dropdown-filter).

## Realtime presence

[`convex/presence.ts`](../convex/presence.ts) holds the heartbeat and listing logic.

- **Heartbeat.** The mounted detail panel calls `api.presence.heartbeat({ issueId })` immediately on mount and every 10 seconds while open (`src/lib/use-presence-heartbeat.ts`). The mutation upserts a row in the `presence` table — if `(issueId, userId)` already exists, patch `lastHeartbeat`, else insert. Each mutation re-checks workspace membership before writing.
- **Viewer list.** The panel renders `<PresenceViewers issueId={id} />` in its header. The component subscribes to `api.presence.listByIssue` which returns other viewers whose `lastHeartbeat` is within the last 30 seconds (3× the heartbeat interval — a single dropped heartbeat doesn't flicker the list). The current viewer is excluded server-side.
- **Staleness, not deletion.** No client-side cleanup. A tab close, sign-out, or network drop self-evicts within 30 seconds because the heartbeat stops and the query's filter excludes stale rows. The daily cron purges anything > 7 days stale (`presence` table size stays bounded under realistic load).
- **Why a 30-second window, not 11 seconds?** Mobile networks routinely drop a keep-alive across a backgrounded tab returning to foreground. A tight window would flicker avatars in/out as that happened. Three intervals balances "feels live" against "tolerates jitter." See [ADR-016](./DECISIONS.md#adr-016-presence-as-10s-heartbeat--30s-staleness-window).

## Rich-text editor

[`src/components/description-editor-tiptap.tsx`](../src/components/description-editor-tiptap.tsx) replaces the M2 textarea + markdown-preview toggle with a Tiptap editor.

- **Stack.** `@tiptap/react` with `StarterKit` (headings, paragraph, bold/italic/strike/code, lists, blockquote, code block, history) + `Link` + `Placeholder` + `tiptap-markdown` for round-trip serialization.
- **Markdown is the storage format.** Convex `issues.description` stays `v.optional(v.string())`. `tiptap-markdown` parses on load and serializes on save; the schema didn't migrate. The full-page route reads the same string. See [ADR-017](./DECISIONS.md#adr-017-tiptap-with-markdown-round-trip-no-schema-change).
- **No manual markdown.** Users get markdown input rules from StarterKit (`# A heading` + Space promotes to `<h1>`; `- ` starts a list; `**text**` makes bold; `> quote` makes a blockquote; etc.). The bubble menu on selection adds Bold / Italic / Strike / Code / Link without typing anything.
- **Dynamic import** in the detail panel via `next/dynamic({ ssr: false, loading: () => <skeleton aria-hidden /> })`. Tiptap is ~85kB gzipped — keeping it out of the `/issues` list bundle protects the Lighthouse Performance budget.
- **Security posture.** `tiptap-markdown.html: false` so any raw HTML in the source markdown is treated as literal text. The Link extension restricts protocols to `http`, `https`, `mailto` (rejects `javascript:` / `data:`) and renders with `rel="noopener noreferrer nofollow" target="_blank"`. The bubble menu's "Add link" prompt is belt-and-braces regex-validated before calling `setLink`.

## Theme system

[`src/components/theme-provider.tsx`](../src/components/theme-provider.tsx) ships a three-way light/dark/system toggle.

- **Tailwind v4 custom variant.** `globals.css` declares `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *))` so the `dark:` utility activates by attribute, not by `prefers-color-scheme`. CSS vars `--background` / `--foreground` are defined per `[data-theme="light"]` / `[data-theme="dark"]`.
- **Anti-flash init script.** Root layout `<head>` injects a small `<script>` (string constant `THEME_INIT_SCRIPT`) that reads `localStorage` + `prefers-color-scheme` and sets `data-theme` on `<html>` **before** the first paint. Without this, a dark-mode user sees a white flash on every hard reload while the page hydrates.
- **Three modes.** `'light'` and `'dark'` are explicit overrides; `'system'` follows `matchMedia('(prefers-color-scheme: dark)')` and re-resolves live via the `change` event. Persisted under `localStorage['mini-linear.theme']`.
- **Topbar toggle.** A segmented control (Sun / Monitor / Moon) with `role="group" aria-label="Theme"` and `aria-pressed` on each segment. Keyboard-natural (Tab + Enter/Space).

## Responsive layout

Three breakpoints, mobile-first:

- **Below `md` (< 768px).** Sidebar is hidden; a hamburger in the topbar opens a Radix Dialog drawer with the same nav. Slide-over detail panel renders as a bottom-up sheet covering the viewport (`100vh × 100vw`). Board view shows one column at a time, picked via a dropdown trigger. Palette dialog goes full-screen. Topbar collapses the display name to an avatar and the ⌘K trigger to an icon-only button.
- **`md`–`lg` (768–1023px).** Sidebar is still hidden behind the hamburger; the rest of the layout is the desktop variant (right-side slide-over, horizontal board with scroll-snap, centered palette).
- **`≥ lg` (≥ 1024px).** Static sidebar visible; all columns horizontally laid out; right-side slide-over at `max-w-2xl`.

The intent of the mobile board's single-column-with-dropdown UX is explicitly **not** to mirror desktop — dragging across six columns on a phone is the wrong interaction. Cross-status moves happen via the detail panel's status picker. See [ADR-019](./DECISIONS.md#adr-019-mobile-board-single-column-with-dropdown-filter).

## Routing

App Router with one route group and parallel + intercepting routes for the slide-over:

- `(app)/issues/page.tsx` — the list.
- `(app)/issues/[id]/page.tsx` — the full-page detail view (shareable URL, refresh-safe).
- `(app)/issues/@modal/(.)[id]/page.tsx` — the **same-level intercept**. A click from `/issues` opens the slide-over over the list.
- `(app)/board/page.tsx` — the kanban.
- `(app)/board/@modal/(..)issues/[id]/page.tsx` — the **up-one-level intercept**. A click from `/board` keeps the board mounted in the background and opens the slide-over; `router.back()` from the close handler returns to `/board`, not `/issues`. See [ADR-024](./DECISIONS.md#adr-024-up-one-level-intercept-for-board--issuesid).
- `(app)/issues/@modal/default.tsx` / `(app)/board/@modal/default.tsx` — null fallbacks.

`router.push` doesn't trigger intercepting routes — only real `<Link>` clicks do. The keyboard navigation handler in the list dispatches a synthetic `MouseEvent('click', ...)` on the row's link to make Enter open the slide-over instead of full-page navigating.

## Security posture

This is a portfolio project, not a financial service, but the same hygiene applies. Findings from the M5 manual review:

- **XSS via the Tiptap editor:** rejected. `tiptap-markdown` runs with `html: false`, so any raw HTML in stored markdown is treated as literal text. No custom `NodeView` renders user content. The Link extension allow-lists `http` / `https` / `mailto` and rejects `javascript:` / `data:`.
- **XSS via React rendering:** rejected. Every user-typed value (title, name, email, description preview) renders through React's auto-escaping (`{value}`) — no `dangerouslySetInnerHTML` outside the trusted build-time `THEME_INIT_SCRIPT`.
- **XSS via inline styles (label colors):** rejected. Label colors are seeded server-side from a hardcoded palette in `convex/demo.ts`; no client-side mutation can write a label. React's inline-style object can't break out of a single CSS property value into another declaration.
- **CSRF:** covered by Convex Auth's HTTP-only session cookies. No standalone Next.js Route Handlers mutate state; every write goes through a Convex mutation that validates session via `getAuthUserId(ctx)` server-side.
- **Injection (mutation args):** covered. Every Convex mutation declares its `args` shape via `v.string()` / `v.id('...')` / `v.union(...)` validators; Convex rejects shape mismatches before the handler runs.
- **Cross-workspace authorization bypass:** covered. Every mutation re-checks `members.by_workspace_and_user` before writing. Queries return `null` / `[]` on missing membership (no existence leak).
- **Admin surfaces:** `reseedDemo`, `rebalanceBoardOrder`, `purgeOldSoftDeleted` are all `internalMutation` — not callable from the client. Only invocable from the Convex dashboard (authenticated against the deployment owner) or from the cron scheduler.
- **`THEME_INIT_SCRIPT` via `dangerouslySetInnerHTML`:** content is build-time-known, no interpolation of user input. Comment in code documents why the bypass is safe.
- **Content Security Policy headers:** not configured. Next.js default. A real production deployment would add a strict CSP via `next.config.ts` headers — out of scope for this portfolio.

## Testing

- **Vitest** (`vitest.config.ts`) — unit tests on pure helpers. Co-located with the code under `src/`. 28 tests across `list-keyboard`, `key-sequence`, `board-order`.
- **Playwright** (`playwright.config.ts`) — end-to-end against the dev or prod server, with axe a11y validation on every route the module ships. Lives under `tests/e2e/`:
  - `sign-in.spec.ts` — every auth option visible by accessible name, axe = 0.
  - `m2-crud.spec.ts` — create + optimistic + reload, inline edit + reload, delete + undo + axe on the slide-over.
  - `m3-palette.spec.ts` — open/close + focus restore, ⌘K from body, `g i` round-trip, contextual status change, Esc over slide-over, `?` deep-link, axe = 0.
  - `m4-board.spec.ts` — keyboard pickup + live region, mouse drag + persistence across reload, axe = 0 static, axe = 0 with a card picked up.
  - `m5-editor.spec.ts` — markdown input rule promotes `# Hello` to `<h1>`, bubble menu Bold lands a `<strong>`, save + reload round-trips, axe = 0 with editor focused.
  - `m5-presence.spec.ts` — two browser contexts open the same issue; the second viewer's avatar appears in the first context within the heartbeat window; axe = 0.
  - `m5-theme.spec.ts` — Dark sets `data-theme="dark"` + persists across reload, Light flips, System falls back to OS pref; axe = 0 with toggle visible.
- **Test isolation.** Every issue created during e2e carries a prefix (`[e2e]`, `[e2e-m3]`, `[e2e-m4]`, `[e2e-m5]`, `[e2e-m5e]`) and `afterEach` calls `api.issues.purgeByTitlePrefix` via the in-page Convex client exposed on `window.__convex` in non-production builds. Distinct prefixes per file let the suites run in parallel without cross-purge collisions.

## Accessibility

This is a hard requirement, not a polish step.

- **Skip link** at the top of the app layout (`<a href="#main" class="sr-only focus:not-sr-only">`) — a Tab user lands here first and jumps past the sidebar + topbar.
- **Every interactive element** has a visible focus ring, a semantic role, and an accessible name.
- **Command palette** uses cmdk's combobox + listbox + option roles with `aria-activedescendant`. Title and Description are mounted as `sr-only` children of the Radix Dialog (cmdk doesn't auto-mount them).
- **Drag-and-drop:** `KeyboardSensor` is always wired alongside Pointer and Touch. Every card carries `aria-roledescription="sortable"` and a permanent `aria-label="LIN-N: title"` (so the link has a name even when the drag placeholder hides the content visually). The ARIA announcer reads domain copy on each lifecycle event.
- **Slide-over:** non-modal `role="dialog"` with a hard-coded `aria-label="Issue details"` so the wrapper's accessible name is present from the instant it mounts — the inner heading hydrates after Convex resolves the issue. The list behind stays interactive so the user can click another row to swap issues.
- **Theme toggle:** segmented control with `role="group"` + per-button `aria-pressed` and `aria-label`.
- **`prefers-reduced-motion`** is respected by the palette fade, the slide-over slide, the toast entry/exit, the sidebar drawer, and dnd-kit's `dropAnimation` via Framer's `useReducedMotion`.
- **axe runs on every Playwright route and asserts 0 violations.**

## Deployment

Vercel for the frontend, Convex for the backend. `vercel.json` runs `npx convex deploy --cmd 'pnpm build'` in production so Convex functions and the Next.js build are atomic per Vercel deployment. Preview builds skip the Convex deploy step via a `$VERCEL_ENV` guard — preview branches build against the production Convex deployment without mutating its schema. The custom domain `demo-linear.jcortes.dev` resolves to the production Vercel deployment.

The daily Convex cron (`convex/crons.ts`) runs `internal.issues.purgeOldSoftDeleted` at 03:00 UTC, hard-deleting issues whose `deletedAt` is older than 30 days. The Undo window is ~6 seconds in-session, so any row reaching the purge is a truly abandoned tombstone.
