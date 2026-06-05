# Mini-Linear

> A focused clone of Linear's issue tracker. List + kanban board, command palette, accessible drag-and-drop, realtime collaboration, rich-text descriptions, optimistic updates, light/dark/system theme.

![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/-Next.js_16-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![Tailwind](https://img.shields.io/badge/-Tailwind_CSS-38B2AC?style=flat-square&logo=tailwindcss&logoColor=white)
![Convex](https://img.shields.io/badge/-Convex-EE342F?style=flat-square)
![Status](https://img.shields.io/badge/status-shipped-success?style=flat-square)

**Live demo:** [demo-linear.jcortes.dev](https://demo-linear.jcortes.dev) — sign in with GitHub / Google / LinkedIn, a magic link, or skip the form with **Try the demo**.

---

## What this project demonstrates

Mini-Linear is the third project in a portfolio targeting remote contractor work in the US. Its job is to show the skills the previous project ([habit-tracker](https://github.com/jcortesdev/habit-tracker)) deliberately left out: **a real server, authentication, a database, and realtime multi-user collaboration**, applied to a product polished to the level a Linear engineer wouldn't laugh at.

Five things the finished app shows:

1. **Command palette (⌘K)** — Linear/Raycast-style fuzzy navigation, leader keys (`g i` / `g b` / `?`), contextual actions on the open issue.
2. **Kanban board with drag-and-drop** — works with mouse, touch (long-press), and keyboard alone; ARIA announcer reads domain copy on every lifecycle event.
3. **Realtime collaboration** — multi-tab live updates and a presence avatar list per issue, driven by a 10-second heartbeat + 30-second staleness window.
4. **Optimistic updates everywhere** — every mutation patches the cached query before the server replies; rollback is automatic on error. One shared hook (`useUpdateIssue`) handles all eight mutation surfaces.
5. **Rich-text descriptions** — Tiptap (ProseMirror) with markdown shortcuts (`# heading`, `- list`, `**bold**`) + a bubble menu on selection. Storage is still markdown — Convex schema didn't budge.

## Status

All five modules shipped.

| Module | What it ships |
|---|---|
| **M1** — Foundation + auth | Next.js scaffold, Convex schema, five sign-in methods (GitHub / Google / LinkedIn / magic link / anonymous demo), app shell, read-only list |
| **M2** — Issue CRUD + detail panel | Create, inline edit, pickers (status / priority / assignee / labels), soft-delete + Undo, slide-over via parallel + intercepting routes |
| **M3** — Command palette ⌘K | `cmdk` + Radix Dialog, leader keys, contextual actions on the open issue, shared optimistic-mutation hooks |
| **M4** — Board view + accessible DnD | `dnd-kit` kanban with `KeyboardSensor` + `PointerSensor`, float-index `boardOrder`, ARIA announcer, dashed-border drag placeholder |
| **M5** — Realtime presence, polish, ship | Presence heartbeat, Tiptap rich-text editor, three-way theme toggle, mobile/tablet responsive layout, Lighthouse pass, full a11y sweep |

## Live demo highlights

- **Try the demo:** drops you into a seeded workspace as an anonymous user. No signup.
- **Press `?`** anywhere to deep-link into the keyboard shortcuts group of the command palette.
- **Open two tabs** on the same issue (one anonymous, one signed in) and watch presence avatars appear/disappear within 30 seconds.
- **Type `# A heading` followed by Space** in any issue description and watch the markdown shortcut promote the line to an `<h1>` in place.
- **Drag a card on the board with Space → arrow keys → Space** to reorder without ever touching the mouse. Read the live region in screen reader mode for the domain announcements.

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI library | React 19 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 + `@tailwindcss/typography`, custom-variant `dark:` driven by `[data-theme]` |
| Backend + realtime + auth | Convex 1.39 |
| Auth providers | GitHub · Google · LinkedIn · Resend magic link · anonymous demo |
| Drag-and-drop | `@dnd-kit/core` + `@dnd-kit/sortable` (Pointer + Touch + Keyboard sensors) |
| Command palette | `cmdk` 1.1 + `@radix-ui/react-dialog` 1.1 |
| Rich-text editor | `@tiptap/react` 3 + StarterKit + Link + Placeholder + `tiptap-markdown` |
| Animations | Framer Motion (lazy, `prefers-reduced-motion` aware) |
| Icons | lucide-react |
| Linting / formatting | Biome 1.9 |
| Testing | Vitest 4 · Playwright · `@axe-core/playwright` |
| Package manager | pnpm 11 |
| Hosting | Vercel (frontend) · Convex (backend) |

## Lighthouse

Desktop production build of `/sign-in`:

| Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|
| 96 | 100 | 100 | 100 |

Targets per [CLAUDE conventions](./.claude/CLAUDE.md) (private to the repo): ≥ 90 perf, ≥ 95 a11y.

## Documentation

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — technical shape, data model, security posture, deployment.
- [`docs/DECISIONS.md`](./docs/DECISIONS.md) — 24 architecture decision records (ADRs) covering every non-obvious choice.

## Local development

```bash
pnpm install

# In one terminal — Convex backend (dev deployment, hosted in the cloud).
# First-time setup links the project to a Convex account; follow the CLI prompts.
npx convex dev

# In another terminal — Next.js.
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and click **Try the demo** to land in the seeded workspace.

### Tests

```bash
pnpm vitest run            # unit tests on pure helpers (28 tests)
pnpm playwright test       # e2e + axe (sign-in + 5 module suites)
pnpm tsc --noEmit          # strict typecheck
pnpm biome check .         # lint + format
```

The e2e suite needs the dev server running on port 3000 and the Convex dev deployment reachable. Each test file uses a distinct prefix (`[e2e]`, `[e2e-m3]`, `[e2e-m4]`, `[e2e-m5]`, `[e2e-m5e]`) so its `afterEach` cleans up its own rows without racing the other suites.

### Production build

```bash
pnpm build && pnpm start
```

The build embeds the `NEXT_PUBLIC_CONVEX_URL` from `.env.local` — by default that's the dev Convex deployment, so local prod runs against shared dev data. Vercel deployments deploy Convex atomically via `npx convex deploy --cmd 'pnpm build'`.

## License

MIT — see [`LICENSE`](./LICENSE).
