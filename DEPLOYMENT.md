# Erniza TMS — Docker demo deployment

This folder contains everything needed to run the **Erniza Africa Safaris Tourism Management System** as a public demo on [Render](https://render.com) using Docker.

The demo runs the existing compiled build (the TypeScript source is not present in this workspace) and ships with a pre-seeded PGlite database and uploaded safari images baked into the image.

## Live demo

| Item | Value |
| --- | --- |
| Demo URL | <https://erniza-tms-demo.onrender.com> |
| Repository | <https://github.com/Goodie-g/erniza-tms-demo> |
| Render Blueprint | `erniza-tms-demo` (`render.yaml`) |
| Deploy trigger | Push to `main` |

The repository is public so Render can build it without a GitHub App installation. It contains only the compiled demo, seeded sample data (`example.com` addresses and `555` phone numbers), and the public marketing site. No `.env` file or API keys are committed.

## What visitors get

- The full admin SPA and API on a single public URL.
- Seeded products, destinations, activities, customers, enquiries, quotations, bookings, payments, tours, CMS pages and media.
- A shared owner account that can create and edit demo records.

## Demo login

| Field | Value |
| --- | --- |
| URL | The Render service URL (for example `https://erniza-tms-demo.onrender.com`) |
| Email | `owner@ernizaafricasafaris.com` |
| Password | `Erniza#Dev2026` |

These credentials are also shown on the sign-in page, with a button that fills the form.

A second seeded account exists with the same password:

- `manager@ernizaafricasafaris.com`

> This is a public shared demo login. Do not put real customer, payment or staff data into it.

## Deploy on Render

### 1. Put the project in a Git repository

Render deploys from GitHub/GitLab/Bitbucket. From the project root:

```bash
git init
git add .
git commit -m "Erniza TMS Docker demo"
git branch -M main
git remote add origin <your-repository-url>
git push -u origin main
```

### 2. Create the Blueprint

The Blueprint for this repository is already created and deploys on every push to `main`. To recreate it from scratch:

1. Sign in to the [Render Dashboard](https://dashboard.render.com).
2. Choose **New → Blueprint**.
3. Connect the repository you just pushed, or paste its public URL.
4. Render detects the root-level `render.yaml`.
5. Apply the Blueprint and wait for the first build and deploy.

The Blueprint creates one free Docker web service:

- Name: `erniza-tms-demo`
- Region: `frankfurt`
- Dockerfile: `tms/Dockerfile`
- Build context: `tms`
- Health check: `/api/health`

The first build downloads the runtime dependencies and can take several minutes.

### 3. Open the demo

When the deploy is live, open the service URL shown in the Render dashboard. The seeded data is already loaded; sign in with the demo credentials above.

## How the demo resets

The seeded database (`tms/apps/api/.data/pgdata`) and uploaded images (`tms/apps/api/uploads`) are **baked into the Docker image**.

Render's filesystem is ephemeral on the free plan, so:

- Changes made by visitors persist while the current container is running.
- A restart, redeploy or free-tier spin-down/start returns the demo to the exact seeded state.
- To force a reset, use **Manual Deploy → Deploy latest commit** or **Restart service** in Render.

## Run it locally with Docker

Docker Desktop (or another Docker engine) is required.

```bash
cd tms
docker compose up --build
```

Then open <http://localhost:4000> and use the same demo credentials.

The local compose file sets `NODE_ENV=development` because it serves plain HTTP. Production uses `NODE_ENV=production`, which requires HTTPS for secure session cookies; Render terminates TLS for you.

## Configuration

The image sets sensible defaults and the entrypoint derives the public URL from Render's `RENDER_EXTERNAL_URL` at runtime.

| Variable | Purpose | Default |
| --- | --- | --- |
| `NODE_ENV` | Runtime mode | `production` |
| `PORT` | Listen port | `10000` (Render may provide its own) |
| `APP_URL` | Admin app URL | `RENDER_EXTERNAL_URL` |
| `API_PUBLIC_URL` | Public base URL used in media URLs | `RENDER_EXTERNAL_URL` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `RENDER_EXTERNAL_URL` |
| `PGLITE_PATH` | Embedded database directory | `/app/apps/api/.data/pgdata` |
| `UPLOAD_DIR` | Uploaded media directory | `/app/apps/api/uploads` |
| `LOG_LEVEL` | Pino log level | `info` |
| `PREFLIGHT` | Set to `1` to log PGlite diagnostics at startup | `0` |
| `PGLITE_DEBUG` | Set to `1` to log PostgreSQL startup messages | `0` |

No database or storage service is required for the demo.

## Updating the seeded demo data

The seed data was generated with:

```bash
cd tms/apps/api
node dist/db/seed-cli.js --reset
```

This rebuilds the PGlite database and re-imports the image files from `tms/apps/api/assets/`. After changing seed data, rebuild and redeploy the image.

> The reset deletes existing demo records first, including invoices. The compiled reset routine was patched to clear `invoice_items` and `invoices` before `bookings` so the foreign keys are satisfied.

## Limitations

- **Compiled build only.** The TypeScript source is missing from this workspace. The image cannot be rebuilt from source until it is restored.
- **Shared demo state.** Every visitor uses the same owner account and sees the same editable data.
- **Ephemeral storage.** Uploaded files and edits disappear on restart or redeploy.
- **Free-tier cold starts.** Render's free plan spins down after inactivity. The first request afterwards can take around 30 seconds.
- **No email delivery.** Password-reset and notification emails need a Resend API key; they are not configured for the demo.
- **Local media URLs** use `API_PUBLIC_URL`. On Render the entrypoint sets this to the public service URL automatically.

## Troubleshooting

**The page loads but images are broken.**
Check that `API_PUBLIC_URL` matches the public URL. On Render this is automatic from `RENDER_EXTERNAL_URL`; if you set `API_PUBLIC_URL` manually, make sure it uses the public HTTPS origin.

**The service starts but the health check fails.**
Inspect the Render logs. The usual cause is a stale PGlite lock or an unwritable data directory. The entrypoint removes stale lock files and the image grants the `node` user ownership of `.data` and `uploads`.

**`FATAL: could not open directory "pg_notify"` or `pg_filenode.map` errors.**
Git does not preserve empty directories and wildcard ignore rules can drop required database files. The image relies on two safeguards, both already in this repository:

- `.gitkeep` files in the empty PostgreSQL directories (`pg_notify`, `pg_stat_tmp`, `pg_wal/archive_status`, and so on), plus an entrypoint `mkdir -p` fallback.
- `tms/.dockerignore` must **not** exclude `*.map`; it excludes only `*.js.map`, `*.css.map`, and `*.mjs.map`. PostgreSQL needs `global/pg_filenode.map`, and excluding it makes PGlite abort with `relation mapping file ... contains incorrect checksum`.

If either safeguard is removed, the container will fail to start with `RuntimeError: Aborted()` and the real cause will appear in the logs only when `PGLITE_DEBUG=1` or `PREFLIGHT=1`.

**Login fails.**
Use `owner@ernizaafricasafaris.com` / `Erniza#Dev2026`. Both seeded accounts share this password. If the password was changed through the demo, restart the service to restore the baked data.

**The demo is slow after a period of inactivity.**
This is Render's free-tier spin-down. The next request wakes the service.
