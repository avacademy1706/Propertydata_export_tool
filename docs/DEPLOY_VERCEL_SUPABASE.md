# Deploying Property Desk — Vercel + Supabase

This deploys the **Next.js app** (`frontend/`) to **Vercel**, with **Supabase** for the Postgres
database and for media (photo/video) storage. The app is self-contained — its own API routes handle
extraction, matching, export and auth — so no separate backend is needed for this deployment.

> The Python/FastAPI backend (`backend/`) is for the **later AWS** phase (RDS + S3 + SQS + ECS);
> it is not used here. See [BACKEND_API_SPEC.md](./BACKEND_API_SPEC.md) §2 for that.

---

## What you'll end up with

```
          Vercel (Next.js app: dashboard + /api/* routes + login)
              │                               │
              ▼                               ▼
   Supabase Postgres (data)        Supabase Storage (photos/videos, S3-compatible)
```

## Before you start

- A GitHub repo with this code pushed (the `frontend/` folder is the deployable).
- A [Supabase](https://supabase.com) account and a [Vercel](https://vercel.com) account.
- Your Anthropic API key (for AI extraction), or leave it out to use the offline rules extractor.

---

## Step 1 — Create the Supabase database

1. Create a new Supabase project. Pick a region close to your users (e.g. **Mumbai / ap-south-1**).
   Save the database password.
2. In the dashboard click **Connect** (top bar). You need **two** connection strings:
   - **Transaction pooler** (port **6543**) → this becomes `DATABASE_URL` (runtime, serverless-safe).
   - **Direct connection** (port **5432**, "Session"/"Direct") → this becomes `DIRECT_URL` (migrations).
3. Append `?sslmode=require` to **both** URLs. They look like:
   ```
   DATABASE_URL = postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require
   DIRECT_URL   = postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres?sslmode=require
   ```

## Step 2 — Create the Supabase Storage bucket (media)

1. Storage → **New bucket** → name it e.g. `property-desk-media`. Keep it **private**.
2. Project Settings → **Storage** → **S3 Connection**: copy the **endpoint** and **region**, and
   **generate S3 access keys** (access key id + secret). You'll use these as the `S3_*` env vars:
   ```
   MEDIA_STORAGE_DRIVER = s3
   S3_BUCKET            = property-desk-media
   S3_REGION            = <project region, e.g. ap-south-1>
   S3_ENDPOINT          = https://<ref>.supabase.co/storage/v1/s3
   S3_ACCESS_KEY_ID     = <generated>
   S3_SECRET_ACCESS_KEY = <generated>
   S3_FORCE_PATH_STYLE  = true
   ```

## Step 3 — Generate the auth secret and pick a login

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # -> AUTH_SECRET
```
Choose an admin email + password for the dashboard login:
```
AUTH_SECRET          = <the 64-char hex above>
APP_ACCESS_PASSWORD  = <a strong password>      # when set, the whole app requires login
APP_ADMIN_EMAIL      = you@yourcompany.com
```

## Step 4 — Create the Vercel project

1. Vercel → **Add New → Project** → import your GitHub repo.
2. **Root Directory**: set it to **`frontend`** (important — the app lives in that subfolder).
   Vercel auto-detects Next.js.
3. **Build Command**: leave as default — the repo defines a `vercel-build` script that runs
   `prisma generate && prisma migrate deploy && next build`, so the Supabase schema is created on
   the first deploy. (Install command and output dir: defaults are fine.)
4. **Environment Variables**: add everything from the table below (Production, and Preview if you
   want preview deploys to work).

## Step 5 — Deploy

Click **Deploy**. On the first build, `prisma migrate deploy` creates all tables in Supabase.
When it finishes, open the URL → you'll be sent to `/login` → sign in with `APP_ADMIN_EMAIL` /
`APP_ACCESS_PASSWORD`.

> **Alternative to build-time migrations:** if you'd rather not migrate on every deploy, set the
> Vercel Build Command to `next build`, and run migrations yourself once from your machine:
> ```bash
> cd frontend
> DIRECT_URL="<your direct url>" npx prisma migrate deploy
> ```

---

## Environment variables (set these in Vercel)

| Variable | Required | Value |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase **pooled** URL (6543) + `?sslmode=require` |
| `DIRECT_URL` | ✅ | Supabase **direct** URL (5432) + `?sslmode=require` (migrations) |
| `AUTH_SECRET` | ✅ | 64-char hex from Step 3 |
| `APP_ACCESS_PASSWORD` | ✅ | dashboard login password (omit to run with **no login** — not recommended in prod) |
| `APP_ADMIN_EMAIL` | ✅ | dashboard login email |
| `AI_PROVIDER` | ○ | `anthropic` (or `gemini`/`groq`/`openrouter`; omit for offline rules) |
| `AI_API_KEY` | ○ | your provider key (required if `AI_PROVIDER` needs one) |
| `AI_MODEL` | ○ | e.g. `claude-sonnet-5-5` (provider default if blank) |
| `MEDIA_STORAGE_DRIVER` | ✅ | `s3` (Vercel's filesystem is ephemeral — don't use `local`) |
| `S3_BUCKET` `S3_REGION` `S3_ENDPOINT` `S3_ACCESS_KEY_ID` `S3_SECRET_ACCESS_KEY` | ✅ | from Step 2 |
| `S3_FORCE_PATH_STYLE` | ✅ | `true` (required for Supabase Storage) |
| `MEDIA_MAX_FILE_MB` | ○ | default `50`; consider `10` on Vercel (see limitations) |
| `APP_URL` | ○ | your Vercel URL, e.g. `https://property-desk.vercel.app` |
| `WHATSAPP_*` | ○ | leave blank until you wire WhatsApp; manual paste works without it |
| `NODE_ENV` | — | Vercel sets this to `production` automatically |

`DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AI_API_KEY`, `S3_SECRET_ACCESS_KEY` are **secrets** —
only put them in Vercel's env settings, never in the repo. (`.env` is gitignored.)

---

## Known limitations on Vercel (fine for launch, revisit later)

- **Media served through the function.** `GET /api/media/[id]` streams bytes from Supabase Storage
  through the serverless function. Images are fine; very large videos can be slow or hit limits.
  Keeping `MEDIA_MAX_FILE_MB` modest (≈10) is safest. Serving media via Supabase **signed URLs**
  (a redirect) is a good follow-up and avoids the function entirely.
- **No background worker.** WhatsApp inbound + heavy async processing is designed for the AWS phase
  (SQS worker). On Vercel, manual paste runs inline and is covered by `maxDuration = 60` on the
  AI/export/upload routes. The WhatsApp webhook works but processes inline.
- **Cold starts.** First request after idle is slower (Prisma + pg connect). The pooled Supabase URL
  keeps DB connections healthy under serverless.
- **Co-locate regions.** Put the Vercel function region in the **same region as Supabase** (Vercel
  Project → Settings → Functions → Region; e.g. `bom1` for a Mumbai/ap-south-1 Supabase). A mismatch
  adds round-trip latency to every DB query.

## Moving to AWS later

The Python backend (`backend/`) is the production target: RDS Postgres, S3, SQS worker, ECS Fargate.
When you get there, point the Next.js frontend at it with `BACKEND_URL=https://<api-domain>` (every
`/api/*` except `/api/auth/*` is then proxied to it). Full runbook: `backend/README.md` and
[BACKEND_API_SPEC.md](./BACKEND_API_SPEC.md) §2.
