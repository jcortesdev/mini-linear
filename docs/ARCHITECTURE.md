# Architecture

This document explains the technical structure and key design decisions of the project. It is intentionally short and focused — for individual trade-offs see [`DECISIONS.md`](./DECISIONS.md).

This file evolves with the project. As of Module 3 the app has authentication, an issues CRUD with a slide-over detail panel, optimistic updates across every mutation surface, and a ⌘K command palette. Modules 4 and 5 add a kanban board with accessible drag-and-drop and live realtime presence; this document gets a section for each when they ship.

## High-level overview

```
┌────────────────────────────────────────────────────────────────────┐
│                     Browser (React 19, App Router)                  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  RSC shell:   (auth, route guards, layout chrome)            │  │
│  │  Client:      issue list, detail panel, pickers, palette     │  │
│  │  cmdk dialog: ⌘K, g i / g b / ?, contextual actions          │  │
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
│  │  DB:      users · workspaces · members · labels · issues     │  │
│  │  Queries: list / get — reactive, dependency-tracked          │  │
│  │  Mutations: create · update · remove (soft) · restore        │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                Vercel (Next.js frontend, custom domain)
```

## Rendering strategy

This is a **client-rendered app with a thin RSC shell**, hosted on Vercel, with Convex as the only backend.

- The `app/` root layout is a Server Component that wraps `ConvexAuthNextjsServerProvider` (auth headers) and a Client Component (`ConvexClientProvider`) that owns the `ConvexReactClient`. Everything below the providers is a Client Component because it needs `useQuery` / `useMutation` / event handlers.
- Routes that need data (`/issues`, `/issues/[id]`, `/board`) live under the `(app)` route group and share a layout with the sidebar + topbar + palette provider.
- The `/sign-in` route stands outside the `(app)` group and renders the auth form without the app chrome.
- There are no API routes for data. Convex mutations replace what Server Actions would otherwise do; webhooks would be the only future excuse for a Route Handler.

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
```

Indexes:

- `members.by_user` — "what workspace am I in" lookup on every page load.
- `members.by_workspace_and_user` — idempotency for the demo-join callback.
- `issues.by_workspace_and_number` — list ordering by LIN-N.
- `issues.by_workspace_and_status` — kanban column queries (Module 4).
- `issues.by_assignee` — future "my issues" filter.

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

Route protection lives in [`src/middleware.ts`](../src/middleware.ts) via `convexAuthNextjsMiddleware`: `/sign-in` redirects authenticated users to `/issues`, `/issues` and `/board` redirect unauthenticated users to `/sign-in`. Everything else is open.

## State model

Three layers, ordered from outermost to component-local:

1. **Convex queries** — source of truth. `useQuery(api.issues.list)`, `useQuery(api.issues.get, { id })`, `useQuery(api.members.list)`, `useQuery(api.labels.list)`. Every query is reactive: the server tracks per-document dependencies and any mutation that touches a depended document republishes the affected query, which re-renders the consumer. No invalidation API; no manual refetch.
2. **Optimistic store** — `localStore.setQuery(api.x.y, args, next)` inside `.withOptimisticUpdate`. Reconciles silently when the server replies with the same shape; rolls back on error. See "Optimistic mutations" below.
3. **Component state** — `useState` for UI concerns (open/closed, focused index, draft text). No global state library. The palette context is the only React Context, and it owns a small bag of strictly UI-facing state.

Zustand, Redux, Jotai are intentionally absent. The Convex client provides the only global cache the app needs.

## Optimistic mutations

[`src/lib/issue-mutations.ts`](../src/lib/issue-mutations.ts) exposes two hooks consumed by every mutation surface in the app:

- `useUpdateIssue()` — for `title`, `status`, `priority`, `description`, `assigneeId`, `labelIds`. Resolves relational fields (`assigneeId` against `api.members.list`, `labelIds` against `api.labels.list`) so the optimistic row matches the server's shape exactly, and writes the patched doc to both the `api.issues.list` and `api.issues.get` caches in one pass.
- `useRemoveIssue()` — filters the deleted issue out of the cached list. Restore (the Undo path) talks to the server directly; recreating the optimistic shape across React refs across the panel unmount wasn't worth the complexity.

Consumers (Module 2/3): the four pickers (status, priority, assignee, labels), the row's inline title editor, the description editor, the detail panel (title + delete), and the palette's contextual actions. ~150 LOC of duplicated `.withOptimisticUpdate` logic removed across the 7 callers.

## Command palette

[`src/components/palette/`](../src/components/palette/) contains the palette implementation.

- `<PaletteProvider>` lives at the root of `(app)/layout.tsx` and owns context: `{ open, setOpen, pendingNewIssue, requestNewIssue, consumePendingNewIssue, openWithSearch, pendingSearch, consumePendingSearch }`.
- `<CommandPalette>` is mounted once by the provider. It wraps cmdk's `<Command.Dialog>` (which wraps Radix Dialog) with a controlled input value, contextual issue resolution from `usePathname()`, and groups: Create, Navigation, Issue LIN-N (when an issue is open), Change status, Change priority, Assign to, Toggle label, Keyboard shortcuts.
- Leader-key sequences (`g i`, `g b`, `?`) are wired via a pure helper [`src/lib/key-sequence.ts`](../src/lib/key-sequence.ts) — a deterministic matcher with a 900ms buffer, modifier and editable-target guards, and nine Vitest tests. The matcher mounts in a provider `useEffect` that skips events when the palette is open.
- ⌘K / Ctrl+K toggle works from anywhere — including form inputs — via a document-level keydown listener with `preventDefault` to override Chrome's omnibox-search shortcut.
- Focus restoration on close uses a snapshot ref. Radix's built-in FocusScope can't be trusted here: cmdk's `Command.Input` autofocuses synchronously during the same render that mounts the dialog, so FocusScope captures the input as "previous focus" and on close restores to a removed element. See [ADR-006](./DECISIONS.md#adr-006-snapshot-on-open-focus-restoration-for-the-command-palette) for detail.
- The contextual block reads the open issue from the URL pathname (`/issues/<id>`) with a `parseIssueId` helper that returns `null` for ids containing dashes — those are optimistic `crypto.randomUUID()` ids that would throw `ArgumentValidationError` on `api.issues.get`. The `useQuery` gets `'skip'` until a real id is in the URL.

## Routing

App Router with one route group and one parallel + intercepting route:

- `(app)/issues/page.tsx` — the list.
- `(app)/issues/[id]/page.tsx` — the full-page detail view (shareable URL, refresh-safe).
- `(app)/issues/@modal/(.)[id]/page.tsx` — the **intercepting** route. When the user clicks a row's `<Link>` from `/issues`, Next renders this slot inside the parent layout, the list stays mounted behind a `role="dialog"` slide-over.
- `(app)/issues/@modal/default.tsx` — the modal slot's default render (empty, prevents Next from forcing the user back to the list).

`router.push` doesn't trigger the intercepting route — only real `<Link>` clicks do. The keyboard navigation handler dispatches a synthetic `MouseEvent('click', ...)` on the row's link to make Enter open the slide-over instead of full-page navigating.

## Testing

- **Vitest** (`vitest.config.ts`) — unit tests on pure helpers. Co-located with the code under `src/`. Currently:
  - `src/lib/list-keyboard.test.ts` — 13 tests covering arrow navigation, edge clamping, defensive index handling.
  - `src/lib/key-sequence.test.ts` — 9 tests covering leader sequences, timeouts, modifiers, `shouldSkip`, single-key sequences.
- **Playwright** (`playwright.config.ts`) — end-to-end against the dev server, with axe a11y validation on every route the module ships. Lives under `tests/e2e/`:
  - `sign-in.spec.ts` — every auth option visible by accessible name, axe = 0.
  - `m2-crud.spec.ts` — create + optimistic + reload, inline edit + reload, delete + undo + axe on the slide-over.
  - `m3-palette.spec.ts` — open/close + focus restore, ⌘K from body, navigation + `g i` round-trip, contextual status change, Esc over slide-over, `?` deep-link, axe = 0 with palette open.
- **Test isolation:** every issue created during e2e carries a prefix (`[e2e]` for M2, `[e2e-m3]` for M3) and `afterEach` calls `api.issues.purgeByTitlePrefix` via the in-page Convex client exposed on `window.__convex` in non-production builds. Distinct prefixes per file are required because the M2 and M3 suites run in parallel by default.

## Accessibility

This is a hard requirement, not a polish step.

- Every interactive element has a visible focus ring, a semantic role, and an accessible name.
- The command palette uses cmdk's combobox + listbox + option roles with `aria-activedescendant` syncing. Title and Description are mounted as `sr-only` children of the Radix Dialog (cmdk doesn't auto-mount them).
- Focus restoration is verified in the e2e suite for both the slide-over (Radix's built-in, works) and the palette (snapshot ref workaround).
- Color contrast is checked in the axe sweeps. Two real findings to date: M2 bumped `text-zinc-400` (2.62 ratio) to `text-zinc-500` (4.6) inside the slide-over; M3 bumped the topbar's `⌘K` kbd from `text-zinc-500` on `bg-zinc-100` (4.39) to `text-zinc-600` (~6.5).
- `prefers-reduced-motion` is respected by the palette fade, the slide-over slide, and the toast entry/exit via Framer's `useReducedMotion`.

## Deployment

Vercel for the frontend, Convex for the backend. `vercel.json` runs `npx convex deploy --cmd 'pnpm build'` in production so Convex functions and the Next.js build are atomic per Vercel deployment. Preview builds skip the Convex deploy step via a `$VERCEL_ENV` guard — preview branches build against the production Convex deployment without mutating its schema. The custom domain `demo-linear.jcortes.dev` resolves to the production Vercel deployment.

## What's coming

- **Module 4 — Board view + accessible DnD.** A `/board` route with kanban columns by status, drag-and-drop via dnd-kit, `KeyboardSensor` for keyboard-only users, `aria-roledescription="sortable"` on draggables, the ARIA announcer configured via `accessibility.announcements`, ordering driven by `issues.boardOrder` (float). Playwright will run a drag-by-keyboard test and axe on the board.
- **Module 5 — Realtime presence + polish + ship.** Multi-tab live updates (mostly free from Convex's reactive queries), a `presence` table with a per-issue heartbeat from each viewer, a final Lighthouse pass (≥ 90 performance, ≥ 95 a11y), the polish carry-overs from M1–M3, and the final screenshots + README pass.
