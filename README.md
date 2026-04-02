# F-Guild

Family gamification platform with DnD mechanics. Track quests, earn XP, level up your family.

## Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5 (strict)
- **Runtime**: React 19
- **Package manager**: pnpm
- **Linter**: ESLint 9+ (flat config)

## Getting Started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |

## Project Structure

```
src/
  app/          # Next.js App Router pages and layouts
  components/   # Reusable React components
  lib/          # Utility functions and shared logic
  server/       # Server-side code (tRPC routers, etc.)
prisma/         # Database schema and migrations
```

## Development

This project uses the Ralph loop for iterative task-driven development.
Tasks are tracked in `tasks.json`, progress in `progress.md`.
