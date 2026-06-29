# Ticosclaw

AI-powered marketing management SaaS platform.

## Project Structure

| Directory | Status | Description |
|-----------|--------|-------------|
| `web/` | **Primary** | Next.js 14 App Router — Clerk auth, Supabase, tRPC, OpenAI |

The old Vite `frontend/`, legacy FastAPI `backend/`, and duplicate `ticosclaw/` Next.js scaffold have been consolidated into `web/`.

## Quick Start

```bash
cd web
npm install
npm run setup
# Fill in Clerk, Supabase, and OpenAI keys in .env.local
npm run setup:check
npm run dev
```

Open [http://localhost:3000/tr/dashboard](http://localhost:3000/tr/dashboard).

See [web/KURULUM.md](web/KURULUM.md) (Turkish) or [web/README.md](web/README.md) for full setup, routes, and deployment.

## Stack (web/)

- Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
- Clerk (authentication), Supabase (Postgres), tRPC, TanStack Query
- OpenAI GPT-4o (streaming) + DALL-E 3
- i18n: `/tr/`, `/en/`

## Auth

Clerk middleware is combined with next-intl routing in `web/src/middleware.ts`. Public routes: sign-in, sign-up. All other routes require authentication when Clerk keys are configured. Without Clerk keys, the app runs in demo mode with a dev user.
