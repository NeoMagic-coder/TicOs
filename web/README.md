# Ticosclaw Web (Next.js 14)

AI-powered marketing management SaaS platform.

## Stack

- Next.js 14 App Router + TypeScript + Tailwind CSS
- shadcn/ui + Radix UI
- Clerk (auth), Supabase (Postgres), tRPC, TanStack Query, Zustand
- OpenAI GPT-4o (streaming) + DALL-E 3

## Getting Started

```bash
cd web
npm install
npm run setup          # creates .env.local from .env.example
# Fill in Clerk, Supabase, and OpenAI keys in .env.local
npm run setup:check    # verify required keys
npm run dev
```

Turkish setup guide: [KURULUM.md](./KURULUM.md)

Open [http://localhost:3000/tr/dashboard](http://localhost:3000/tr/dashboard).

## Routes

| Route | Description |
|-------|-------------|
| `/[locale]/dashboard` | Main dashboard with TicOS chat |
| `/[locale]/brand-voice` | Brand identity analysis |
| `/[locale]/team` | AI team & inbox |
| `/[locale]/automations` | Automation cards & integrations |
| `/[locale]/visual-studio/createImage` | Image generation |
| `/[locale]/calendar` | Content calendar |
| `/[locale]/goals` | Marketing goals |
| `/[locale]/onboarding` | Onboarding flow |

## Database

Run the migration in `supabase/migrations/001_initial_schema.sql` against your Supabase project.

## Deployment

Deploy to Vercel with environment variables from `.env.example`.
