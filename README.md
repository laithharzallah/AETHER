# AETHER.ai

A modular GRC platform for GCC enterprises — regulatory intelligence, AI governance, policy management, and audit trail in one multi-tenant SaaS.

Built with Next.js (App Router), Supabase, and Tailwind CSS.

## Getting started

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). If port 3000 is already in use, Next.js will bind to the next available port (e.g. **3001**).

## Project layout

- `app/` — routes and layouts
- `components/ui/` — shadcn/ui primitives
- `lib/supabase/` — browser and server Supabase clients
- `lib/anthropic.ts` — Anthropic SDK client (AI features)
