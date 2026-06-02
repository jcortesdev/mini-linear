# Mini-Linear

> A focused clone of Linear's issue tracker. List + kanban board, command palette, accessible drag-and-drop, realtime collaboration, optimistic updates.

![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/-Next.js_16-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![Tailwind](https://img.shields.io/badge/-Tailwind_CSS-38B2AC?style=flat-square&logo=tailwindcss&logoColor=white)
![Convex](https://img.shields.io/badge/-Convex-EE342F?style=flat-square)
![Status](https://img.shields.io/badge/status-in_progress-yellow?style=flat-square)

**Live demo:** coming soon at [demo-linear.jcortes.dev](https://demo-linear.jcortes.dev)

---

## Status

Work in progress. Currently building Module 1 (foundation + auth + visible workspace). The full README, architecture notes, and decision records land at Module 5.

## What this project demonstrates

Mini-Linear is the third project in a portfolio targeting remote contractor work in the US. Its job is to show the skills the previous project ([habit-tracker](https://github.com/jcortesdev/habit-tracker)) deliberately left out: **a real server, authentication, a database, and realtime multi-user collaboration**, applied to a product polished to the level a Linear engineer wouldn't laugh at.

Four features the finished app must show:

1. **Command palette (⌘K)** — Linear/Raycast-style fuzzy navigation and contextual actions.
2. **Kanban with drag-and-drop** — works with mouse *and* with keyboard alone.
3. **Realtime collaboration** — multi-tab/multi-user live updates with presence.
4. **Optimistic updates** — UI responds instantly and reconciles with the server.

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) |
| UI library | React 19 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Backend + realtime + auth | Convex |
| Auth providers | GitHub · Google · LinkedIn · Resend magic link |
| Drag-and-drop | `@dnd-kit/core` + `@dnd-kit/sortable` |
| Command palette | `cmdk` |
| Forms | `react-hook-form` + `zod` |
| Animations | Framer Motion |
| Linting / formatting | Biome |
| Testing | Vitest · Playwright · @axe-core/playwright |
| Package manager | pnpm |
| Hosting | Vercel (frontend) · Convex (backend) |

## Local development

```bash
pnpm install
pnpm dev
```

Convex setup is required for anything beyond the static shell — see [the Convex setup notes](https://docs.convex.dev/quickstart/nextjs).

## License

MIT — see [`LICENSE`](./LICENSE).
