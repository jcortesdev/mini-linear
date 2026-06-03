# Mini-Linear

> A focused clone of Linear's issue tracker. List + kanban board, command palette, accessible drag-and-drop, realtime collaboration, optimistic updates.

![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/-Next.js_16-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![Tailwind](https://img.shields.io/badge/-Tailwind_CSS-38B2AC?style=flat-square&logo=tailwindcss&logoColor=white)
![Convex](https://img.shields.io/badge/-Convex-EE342F?style=flat-square)
![Status](https://img.shields.io/badge/status-in_progress-yellow?style=flat-square)

**Live demo:** [demo-linear.jcortes.dev](https://demo-linear.jcortes.dev) — sign in with GitHub / Google / LinkedIn, a magic link, or skip the form with **Try the demo**.

---

## Status

Module 3 of 5 shipped. The app already runs end-to-end: sign in, browse and create issues, edit inline, soft-delete with Undo, and drive the whole thing from a ⌘K command palette. Module 4 brings the kanban board with accessible drag-and-drop; Module 5 brings realtime presence and the final README + screenshots pass.

| Module | Status | What it ships |
|---|---|---|
| M1 — Foundation + auth | ✅ shipped | Next.js scaffold, Convex schema, four sign-in methods + anonymous demo, app shell, read-only list |
| M2 — Issue CRUD + detail panel | ✅ shipped | Create / inline edit / pickers / soft-delete-with-undo, slide-over detail, markdown description, keyboard nav |
| M3 — Command palette ⌘K | ✅ shipped | cmdk + Radix Dialog, `g i` / `g b` / `?` leader keys, contextual actions on the open issue, shared optimistic-mutation hooks |
| M4 — Board view + accessible DnD | ⚪ next | dnd-kit kanban with `KeyboardSensor`, `boardOrder` float index, ARIA announcer |
| M5 — Realtime presence + polish | ⚪ pending | Multi-tab live updates, presence heartbeat, Lighthouse pass, final README + screenshots |

## What this project demonstrates

Mini-Linear is the third project in a portfolio targeting remote contractor work in the US. Its job is to show the skills the previous project ([habit-tracker](https://github.com/jcortesdev/habit-tracker)) deliberately left out: **a real server, authentication, a database, and realtime multi-user collaboration**, applied to a product polished to the level a Linear engineer wouldn't laugh at.

Four features the finished app must show:

1. **Command palette (⌘K)** — Linear/Raycast-style fuzzy navigation and contextual actions. ✅ shipped in M3.
2. **Kanban with drag-and-drop** — works with mouse *and* with keyboard alone. ⚪ M4.
3. **Realtime collaboration** — multi-tab/multi-user live updates with presence. ⚪ M5.
4. **Optimistic updates** — UI responds instantly and reconciles with the server. ✅ shipped in M2, consolidated in M3.

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) |
| UI library | React 19 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 + `@tailwindcss/typography` |
| Backend + realtime + auth | Convex 1.39 |
| Auth providers | GitHub · Google · LinkedIn · Resend magic link · anonymous demo |
| Drag-and-drop *(M4)* | `@dnd-kit/core` + `@dnd-kit/sortable` |
| Command palette | `cmdk` 1.1 + `@radix-ui/react-dialog` 1.1 |
| Forms | `react-hook-form` + `zod` |
| Animations | Framer Motion (lazy, `prefers-reduced-motion` aware) |
| Markdown | `react-markdown` + `remark-gfm` |
| Linting / formatting | Biome 1.9 |
| Testing | Vitest 4 · Playwright · `@axe-core/playwright` |
| Package manager | pnpm 11 |
| Hosting | Vercel (frontend) · Convex (backend) |

## Documentation

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — the technical shape of the app.
- [`docs/DECISIONS.md`](./docs/DECISIONS.md) — architecture decision records (ADRs).

## Local development

```bash
pnpm install
pnpm dev          # starts Next + you'll need a Convex deployment alongside
```

A Convex deployment is required for anything beyond the static shell — see [the Convex setup notes](https://docs.convex.dev/quickstart/nextjs) and copy the `.env.local.example` if added.

```bash
pnpm test         # vitest (helper unit tests)
pnpm test:e2e     # playwright + axe
pnpm biome check . && pnpm tsc --noEmit
```

## License

MIT — see [`LICENSE`](./LICENSE).
