# TruthLens

TruthLens is a premium fact-intelligence web app built with Next.js, Prisma, Tailwind, and server-side analysis routes.

## Deployment prerequisites

| Item | Required | Notes |
|---|---:|---|
| Node.js | Yes | Use the version supported by Vercel |
| GitHub repo | Yes | Push this repository to GitHub first |
| Vercel account | Yes | Used for deployment |
| Environment variables | Yes | Add them in Vercel project settings |
| PostgreSQL | Optional | Recommended later for durable production data |

## Environment variables

| Key | Required | Example |
|---|---:|---|
| `NEXT_PUBLIC_APP_URL` | Yes | `https://truthlens.vercel.app` |
| `NEXT_PUBLIC_APP_NAME` | Yes | `TruthLens` |
| `IP_HASH_SALT` | Yes | `some-random-string` |
| `ENABLE_AI_SYNTHESIS` | Optional | `true` |
| `OPENROUTER_API_KEY` | Optional | `sk-or-v1-...` |
| `OPENROUTER_MODEL` | Optional | `openrouter/free` |
| `GEMINI_API_KEY` | Optional | `AIza...` |
| `GEMINI_MODEL` | Optional | `gemini-2.0-flash` |
| `ANTHROPIC_API_KEY` | Optional | `sk-...` |
| `GOOGLE_SEARCH_API_KEY` | Optional | `...` |
| `GOOGLE_SEARCH_ENGINE_ID` | Optional | `...` |
| `GOOGLE_FACT_CHECK_API_KEY` | Optional | `...` |
| `BRAVE_SEARCH_API_KEY` | Optional | `...` |
| `SEARXNG_URL` | Optional | `https://your-searxng-instance` |
| `REDIS_URL` | Optional | `redis://...` |
| `ADMIN_SECRET` | Optional | `...` |
| `ENABLE_ADMIN_AUTH` | Optional | `false` |

## Deploy to Vercel

1. Push this repository to GitHub.
2. Import the repository in Vercel.
3. Keep the framework preset as **Next.js**.
4. Add the environment variables in Vercel Project Settings.
5. Deploy once with cache cleared if you changed any Prisma files.
6. Open the deployed URL and test a claim.
7. If you later switch to PostgreSQL, update `prisma/schema.prisma` and `DATABASE_URL` together.

## Notes

- The current build is optimized for a smooth Vercel deployment.
- The app includes server-side analysis, caching, graceful fallbacks, and a free-first synthesis router.
- The frontend uses the Vanta Editorial visual system, ambient 3D layers, hover tilt, and is safe for mobile and desktop.

## Troubleshooting

### 1. Build fails on Prisma or database access
Make sure the Prisma client is generated during install and that the schema matches your chosen database.

### 2. Analysis returns fallback results
This is expected when AI or retrieval keys are not configured. The app will still produce a rules-based verdict.

### 3. No Redis?
That is fine for single-instance deployment. The app falls back to an in-process cache automatically.

### 4. Want the richest production setup?
Use Redis for shared caching and PostgreSQL for durable analytics/history. The app will still deploy without them.

### 5. Deployment looks correct but data is not persistent
Add a real PostgreSQL database and set `DATABASE_URL` for durable storage.
