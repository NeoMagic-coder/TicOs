# Clerk Authentication Setup

The project already includes `@clerk/nextjs`, `middleware.ts`, and `ClerkProvider`.

## Option A: Clerk CLI (recommended)

From the `web/` directory:

```bash
# 1. Install CLI (if needed)
npm install -g clerk

# 2. Sign in (opens browser)
clerk auth login

# 3. Link app and write .env.local keys
clerk init

# 4. Verify
clerk doctor

# 5. Start dev server
npm run dev
```

## Option B: Manual keys

1. Create an app at https://dashboard.clerk.com/
2. Copy **Publishable Key** and **Secret Key** into `.env.local`
3. Set redirect URLs in Clerk Dashboard:
   - Sign-in: `http://localhost:3000/tr/sign-in`
   - Sign-up: `http://localhost:3000/tr/sign-up`
   - After sign-in: `http://localhost:3000/tr/dashboard`
   - After sign-up: `http://localhost:3000/tr/onboarding`

## Auth UI

- Header: `SignInButton`, `SignUpButton`, `UserButton` (signed out / signed in)
- Pages: `/[locale]/sign-in`, `/[locale]/sign-up`
