# StockSense — Frontend

React 19 + Vite 8 + Tailwind + Redux Toolkit UI for the StockSense Inventory Management System.

## Setup

```bash
npm install
cp .env.example .env   # set VITE_API_URL to the backend base URL
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite dev server (`:5173`) with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | Oxlint |

## Key directories

- `src/pages/auth/` — Signup, VerifyEmail, Login, ForgotPassword, ResetPassword.
- `src/store/slices/authSlice.js` — auth state (token, user, OTP flow).
- `src/api/` — axios client (`client.js`) and API modules.
- `src/hooks/useAuth.js`, `src/context/AuthContext.jsx` — session helpers.
- `src/pages/dashboard/` — KPIs, stock charts, low-stock, activity.

See the repository-root `README.md` for full architecture, backend API, and OTP/agent details.