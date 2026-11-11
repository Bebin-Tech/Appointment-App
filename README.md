# BebinBook

A scheduling SaaS prototype with a **React.js frontend and Python FastAPI backend**. All frontend screens and interactions are implemented as React components in `frontend/src`; there is no standalone HTML version.

## Start the project

Requires Node.js 20.19+ or 22.12+, and Python 3.11+.

From the project root, in PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

In a second terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Open **http://127.0.0.1:5173/**. Interactive API documentation: **http://127.0.0.1:8000/docs**.

If dependencies are already installed in `.venv` and `frontend/node_modules`, you can skip installation. If Python is not on PATH, use a Python installation's absolute path for the first command. `.venv\Scripts\python.exe` works without activating the environment.

For the already-built version, run `./start.ps1` from the project root, then open http://127.0.0.1:8000/. The script runs both the built React application and the API in one foreground process. Use `./start.ps1 -DemoOnly` to start the browser demo with Vite instead.

## Two ways to explore

- **Browser demo:** The default screen opens Form Studio with sample data and a second workspace. All changes are saved in versioned localStorage with error handling. The profile menu lets you try Owner, Admin, Staff, and Client. No backend is needed for this mode. To create a browser-only workspace, select “Use browser-only demo” on signup.
- **Connected mode:** Sign up without the browser-demo checkbox. Complete the three onboarding steps. Authentication, workspace storage, membership permissions, shared public booking pages and scheduling are handled by FastAPI. There are no seeded server credentials. Create your own local test account.

Browser and connected data are separate. Signing out returns to the browser demo. Demo reset is available at Settings → Danger zone and does not affect server accounts.

## Included flows

- Marketing landing page, interactive booking preview, pricing, FAQ, login, signup, simulated reset, and onboarding.
- Collapsible sidebar, mobile bottom navigation, workspace switcher, search command palette, profile, notifications, light/dark themes.
- Dashboard, calendar day/week/month views, drag-to-reschedule, accessible reschedule form, conflict and buffer checks, timezone conversion, recurring bookings saved atomically.
- Booking filters, bulk confirmation/cancellation/deletion, ten-second undo, CSV export with spreadsheet-formula escaping.
- Client notes/tags/history, services with prices/durations/buffers, staff availability, and team invitations.
- Branded booking pages, embed snippets, waitlists, revenue/attendance analytics, busiest-hours heatmap.
- Plan limits, billing usage, premium feature prompts, simulated integrations, Business audit logs and mock API keys.
- Browser demo incoming-booking simulation every two minutes while the dashboard is active; a manual simulation button is also available. Connected workspaces refresh every twenty seconds.

Keyboard: **Ctrl/Cmd+K** opens search, **N** starts a booking, **G then C/D/B** opens calendar/overview/bookings. Dialogs trap focus, support Escape, and return focus to the trigger. Keyboard and touch users can reschedule through appointment details.

## Team invitations and roles

In connected mode, an Owner/Admin can prepare an invitation. No message is sent. An account with the matching email joins on signup or its next login. Only the Owner may invite Admins or change the plan. Invitations reserve seats until accepted or revoked.

- **Owner:** Full workspace access, billing, deletion and invitations.
- **Admin:** Scheduling, services, clients, integrations, team availability, Staff/Client invitations; no billing or workspace deletion.
- **Staff:** Own calendar/bookings, shared team CRM, service/team read access, own availability; no analytics, integrations, API keys, or audit logs.
- **Client:** Own bookings/profile and public booking page; no client CRM, team controls, financial analytics or private CRM notes.

Connected roles are enforced on the server and cannot be selected through the demo role switcher. Public booking responses contain availability and service information, with no client contact details or private notes.

## Verification

```powershell
cd frontend
npm test
npm run build
cd ..
.\.venv\Scripts\python.exe -m pytest backend/tests -q
```

The frontend tests cover buffers, conflicts, independent staff schedules, cancelled slots, past dates, hours, timezones, DST gaps, quotas and atomic recurring series. API tests cover authentication, tenant isolation, role permissions, private-data redaction, quotas, revision conflicts, waitlists, untrusted origins, and concurrent attempts to reserve the same time.

## Build and serve with one process

```powershell
cd frontend
npm run build
cd ..
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

FastAPI serves `frontend/dist` if it exists when the server starts. Open http://127.0.0.1:8000/. Hash routes work without server-side route fallbacks.

## Configuration

### Vercel connected app

Set the Vercel project Root Directory to the **repository root** (empty), with
framework/build overrides cleared. The root `vercel.json` uses Vercel Services
(currently beta) to deploy React and FastAPI together on one domain. The frontend
runs `npm run build:connected`; signup, login and public booking call `/api`.

Connect a dedicated Neon PostgreSQL database through Vercel Storage. Set these
server environment variables for the connected deployment:

- `DATABASE_URL`: the pooled PostgreSQL URL with TLS required. `POSTGRES_URL` is
  also accepted. Never use a `VITE_` prefix for database credentials.
- `BOOKFLOW_ORIGINS`: `https://bebinbook.vercel.app` (plus any custom production
  origins). Vercel's deployment and production hostnames are also trusted.
- `BOOKFLOW_SECURE_COOKIE`: `true` (automatic on Vercel).

The schema is created idempotently when FastAPI starts or handles its first
database request. No local SQLite fallback is permitted on Vercel. Accounts,
hashed sessions, memberships, clients and appointments persist in PostgreSQL.
Existing browser-demo workspaces are not automatically uploaded; sign up and
complete onboarding to create a shared workspace.

`GET /api/health` verifies the database and reports `storage: postgresql`.
To run the API suite against PostgreSQL as well as SQLite, set
`TEST_DATABASE_URL` before running pytest. Each test uses a separate temporary
schema; the test removes only that schema afterward. Use a dedicated test
database or preview branch.

### Vercel browser demo

Import this GitHub repository into Vercel with **Root Directory `frontend`**.
The included `frontend/vercel.json` runs `npm run build:demo` and publishes `dist`.
This build uses browser-only onboarding and localStorage; it does not deploy
FastAPI or create server accounts. Data and booking links are local to each
visitor's browser. Password reset, payments and integrations are simulated.
Run `npm run build` for the normal build that can connect to FastAPI.
Use the root Services configuration above for the connected deployment instead.

Environment variables (set before starting FastAPI):

| Variable | Default | Purpose |
| --- | --- | --- |
| `BOOKFLOW_DB` | `backend/bookflow.sqlite3` | SQLite database location |
| `DATABASE_URL` / `POSTGRES_URL` | unset | PostgreSQL connection string; takes precedence over local SQLite |
| `BOOKFLOW_ORIGINS` | localhost/127.0.0.1 on ports 5173 and 8000 | Comma-separated trusted origins, including scheme and port |
| `BOOKFLOW_SECURE_COOKIE` | `true` on Vercel, otherwise `false` | Secure session cookies over HTTPS |
| `VITE_API_URL` | `/api` | Optional frontend API base URL; Vite proxies `/api` to localhost:8000 in development |

Authentication uses opaque, seven-day HttpOnly SameSite cookies. Session tokens are hashed in the database. Passwords use salted PBKDF2-SHA256. Mutations require JSON and validate browser origins. Rate limits cover authentication and public requests. PostgreSQL transaction advisory locks (or SQLite `BEGIN IMMEDIATE` locally) serialize writes so validation and slot reservation are atomic across instances. Workspace revision checks reject stale writes. The current global write lock favors correctness over high write throughput; larger deployments should use finer-grained workspace locks and normalized booking constraints.

## Assumptions and production path

This is a local product prototype. Currency is USD, workdays do not cross midnight, service durations use 15-minute increments, and recurring bookings repeat at the selected local time. Ambiguous daylight-saving times use one consistent offset; nonexistent local times are rejected. Availability supports per-person weekly hours rather than holiday calendars or per-service staff assignments.

Billing, Stripe charges, external OAuth connections, meeting links, password-reset delivery, reminder emails and API keys remain **simulated**. A waitlist records intent but does not automatically promote clients. Public booking does not grant account access. No email verification or recovery token flow is implemented.

For a production version, keep **React + FastAPI**, replace the development workspace JSON documents with normalized **PostgreSQL** tables and migrations, and enforce interval conflicts with database exclusion constraints. Add **Stripe Billing**, **SendGrid** (or another transactional email provider), **Redis + a worker queue** for reminders/rate limits, verified invitation/reset tokens, OAuth providers, and WebSocket/SSE updates. Use HTTPS with secure cookies, a secret-management service, backups, monitoring and an identity/recovery review before onboarding real customer data.

## Source layout

```text
frontend/src/
  App.jsx           # State, API synchronization, routing and shared actions
  Shell.jsx         # Desktop/mobile navigation
  screens.jsx       # Dashboard, calendar, CRM, analytics, billing, settings
  Dialogs.jsx       # Booking, editing, invitations and command palette
  Marketing.jsx     # Landing, authentication and onboarding
  BookingPage.jsx   # Public booking and branded embed preview
  ui.jsx            # Reusable accessible controls and dialogs
  domain.js         # Demo seed, plans, date/time helpers
  scheduling.js     # Pure conflict, quota and recurrence logic
  api.js            # Typed-by-contract JSON transport
  styles.css        # Shared tokens, themes and responsive layouts
backend/
  main.py           # FastAPI routes, sessions, tenant access and transactions
  schemas.py        # Pydantic request/data validation
  scheduling.py     # Authoritative scheduling and quotas
  database.py       # PostgreSQL / local SQLite schema and transaction helpers
  tests/            # API integration and concurrency tests
```

`frontend/index.html` is Vite's minimal browser entry: it contains only metadata, the React root element, and the JavaScript entry script. Application markup and behavior are rendered by React. This bootstrap file is excluded from GitHub's language statistics.

Official references: [React documentation](https://react.dev/learn), [FastAPI testing documentation](https://fastapi.tiangolo.com/tutorial/testing/).
