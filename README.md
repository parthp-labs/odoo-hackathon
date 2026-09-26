# StockSense IMS — Inventory Management System with LLM Agent

A full-stack inventory management system (Express + Mongoose backend, React + Vite frontend) with a **stream-based LLM agent** that answers natural-language questions about stock and performs guarded writes, an **OTP-based authentication flow** (signup, email verification, forgot/reset password) that emails one-time codes via **Resend**, and an AI-driven **demand forecasting & replenishment** module.

> Built for the Odoo Hackathon. Demo data is labeled honestly (`source: 'seed'`, `confidence: 'demo'`).

---

## Architecture

```
┌─────────────────┐      HTTP /api/*      ┌──────────────────────────────┐
│  React + Vite   │ ────────────────────▶ │  Express backend (:5000)      │
│  (Vite, :5173)  │ ◀──────────────────── │  ├─ /api/auth      OTP auth    │
└─────────────────┘                       │  ├─ /api/products   inventory  │
                                          │  ├─ /api/warehouses            │
                                          │  ├─ /api/locations             │
                                          │  ├─ /api/stocks    on-hand qty │
                                          │  ├─ /api/moves     stock moves │
                                          │  ├─ /api/operations receipts   │
                                          │  ├─ /api/dashboard  KPIs       │
                                          │  ├─ /api/chatbot    rule-based │
                                          │  ├─ /api/agent      LLM agent  │
                                          │  └─ /api/replenishment  forecast│
                                          └──────────────────────────────┘
                                                  │ mongoose
                                          ┌───────▼───────┐
                                          │  MongoDB Atlas │
                                          └───────────────┘
```

- **Backend:** `backend/` — Express 4, Mongoose 8, ES modules.
- **Frontend:** `frontend/` — React 19, Vite 8, Tailwind, Redux Toolkit, recharts.
- **Agent:** `backend/src/agent/` — stream-text LLM loop over inventory tools; model served by the `yolo-auto` provider (OpenAI-compatible).
- **Email:** `backend/src/utils/sendEmail.js` — OTP dispatch via **Resend** (`MAILER_MODE=resend`), falling back to SMTP and then dev-log.

---

## Quick start

Prerequisites: **Node.js 18+** and a **MongoDB** URI (local `mongodb://localhost:27017/odoo_hackathon` or an Atlas cluster).

### 1. Configure environment

Copy the examples and fill in values:

```bash
cp backend/.env.example backend/.env     # backend runtime config
cp frontend/.env.example frontend/.env   # frontend API URL
cp .env.example .env                     # (optional) shared defaults
```

`.env` files are gitignored — never commit secrets.

### 2. Install dependencies

```bash
npm --prefix backend install
npm --prefix frontend install
```

### 3. Seed demo data (optional)

```bash
cd backend
npm run seed:all      # products, vendors, and generated stock-move history
```

`npm run seed` → products; `npm run seed:vendors` → sample vendors; `npm run seed:history` → synthetic movement history.

### 4. Run

```bash
cd backend  && npm run dev     # API on :5000
cd frontend && npm run dev     # UI on :5173
```

Open http://localhost:5173. The frontend proxies API calls to the URL in `frontend/.env` (`VITE_API_URL`).

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `PORT` | no | API port (default `5000`) |
| `MONGO_URI` | yes | MongoDB connection string (also accepts `MONGODB_URI`) |
| `JWT_SECRET` | in prod | Secret for signing JWTs; **fails closed in production** if absent |
| `CORS_ORIGIN` | no | Allowed CORS origin |
| `AGENT_MODEL` | no | LLM model for the agent (default `qwen3.8-27b`) |
| `YOLO_BASE_URL` | no | OpenAI-compatible endpoint (default `https://yolo-auto.com/v1`) |
| `YOLO_API_KEY` | yes* | API key for the agent's LLM provider |
| `SESSION_SECRET` / `SESSION_TTL` / `SESSION_COOKIE_NAME` | no | Session setup for agent conversations |
| `OTP_TTL_MS` / `OTP_MAX_ATTEMPTS` | no | OTP lifetime (default 300000ms) and attempt cap (default 5) |
| `MAILER_MODE` | no | `resend` to use Resend; `log`/unset = console-only |
| `RESEND_API_KEY` | for email | Resend API key (format `re_...`) |
| `EMAIL_FROM` | for email | Sender address for OTP emails |

> **Resend note:** with the default `onboarding@resend.dev` sender, Resend only delivers to the account owner's email. Verify a domain on resend.com and set `EMAIL_FROM` to an address on it to email any recipient. With `MAILER_MODE=log` (dev), OTP codes print to the server console as `[VERIFICATION CODE] >>> 123456 <<<`.

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend base URL, e.g. `http://localhost:5000` |
| `VITE_USE_MOCKS` | `true` to use bundled mock data instead of the API (dev only) |

---

## Authentication flows (OTP via email)

All implemented (`backend/src/controllers/auth.controller.js` + `backend/src/routes/auth.route.js`):

| Method & path | Purpose |
|---|---|
| `POST /api/auth/register` | Create a user (`pending_verification`) + email an OTP. Role is never client-supplied (always `warehouse_staff`). |
| `POST /api/auth/verify-email` | Verify the signup OTP → activate + return a JWT. |
| `POST /api/auth/resend-otp` | Send a new OTP (resets prior unused ones). |
| `POST /api/auth/login` | Password login (rejects unverified accounts with `requiresVerification`). |
| `POST /api/auth/forgot-password` | Send a `password_reset` OTP. |
| `POST /api/auth/reset-password` | Verify the reset OTP + set a new password (single-use code, attempt-capped). |
| `GET /api/auth/me` / `PUT /api/auth/me` | Fetch / update the current user's profile (auth required). |
| `POST /api/auth/change-password` | Change password when logged in (auth required). |

Frontend screens: `frontend/src/pages/auth/` — `Signup`, `VerifyEmail`, `Login`, `ForgotPassword`, `ResetPassword`. State handled in `frontend/src/store/slices/authSlice.js`.

---

## LLM agent

`backend/src/agent/`:

- Reads **live** inventory (products, stock on-hand, locations, moves) via an inventory port.
- Performs **guarded writes** (stock moves / operations) — every write requires a model-provided reason and respects role ceilings.
- Answers natural-language questions through `/api/agent/chat`. The on-page chat widget calls this route (Bearer token auto-attached), falling back to the rule-based `/api/chatbot/message` bot only on 401/404/offline.
- Model provider: `yolo-auto` (OpenAI-compatible); configure via `YOLO_API_KEY`, `YOLO_BASE_URL`, `AGENT_MODEL`.

---

## Replenishment & demand forecasting

`backend/src/services/replenishment/` + `/api/replenishment/*`:

- Per-SKU demand forecast (serves a frozen model artifact).
- Reordering suggestions and vendor sourcing (sample data labeled `'demo'`).
- Frontend integration under the products/replenishment pages.

---

## Testing

Backend uses Node's built-in test runner (`node:test`) + `mongodb-memory-server`:

```bash
cd backend
npm test        # NODE_ENV=test is set by the script; 200+ assertions across 49 suites
```

The suite never makes live email/LLM/DB calls (Resend and the agent provider are bypassed under `NODE_ENV=test`).

Optional end-to-end smoke script (live API): `node e2e-smoke.mjs`.

---

## API documentation

The backend bundles Swagger UI. With the server running, open the docs route (see `backend/src/docs/swagger.js` for the exact mount path).

---

## Project layout

```
backend/
  src/
    agent/          LLM agent loop, tools, model provider
    config/         env + db connection
    controllers/    route handlers (auth, products, stocks, moves, ...)
    ml/             forecasting model artifacts / serving
    middlewares/    auth, error, async wrappers
    models/         Mongoose models (User, OtpVerification, Product, Stock, ...)
    routes/         API route definitions
    services/       replenishment, vendors, inventory ports
    utils/          sendEmail, generateToken, error helpers
    app.js          Express app assembly (all route mounts)
    index.js        server entry
  tests/            node:test suites
frontend/
  src/
    api/            axios client factory
    components/     UI components (dashboard, tables, forms, chat widget)
    context/        auth context
    hooks/          useAuth, etc.
    layouts/        AuthLayout, app shell
    pages/          dashboard, products, warehouse, auth, chatbot routes
    store/          Redux Toolkit (authSlice, api slices)
    routes/         react-router tree
    App.jsx         root component
```