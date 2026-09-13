# AI Local Business Opportunity Finder

AI-powered discovery, compliance auditing, website health, and commercial opportunity intelligence for local businesses.

---

## Deploying on Vercel

This repository is pre-configured for **1-click seamless deployment on Vercel** using modern Vite static hosting + Vercel Serverless Functions (`/api`).

### Step 1: Push to GitHub
1. Create a new repository on [GitHub](https://github.com/new).
2. Initialize and push this repository:
```bash
git init
git add .
git commit -m "feat: initial release with Vercel deployment support"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```

### Step 2: Import into Vercel
1. Go to [vercel.com/new](https://vercel.com/new).
2. Select your imported GitHub repository.
3. Vercel automatically detects the configuration from `vercel.json`:
   - **Framework Preset**: Vite
   - **Build Command**: `vite build`
   - **Output Directory**: `dist`
4. Click **Deploy**.

---

## Environment Variables (API Keys)

You can configure these optional environment variables in your Vercel Project Settings (**Settings &rarr; Environment Variables**) or locally in a `.env` file:

| Variable | Required? | Default / Fallback | Description |
| :--- | :--- | :--- | :--- |
| `GEMINI_API_KEY` | **Recommended** | Built-in deterministic intelligence engine | Google Gemini API key for AI website analysis and executive proposals. |
| `GEMINI_MODEL` | Optional | `gemini-2.5-flash` | Gemini model name (e.g. `gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-2.5-pro`). |
| `GOOGLE_MAPS_API_KEY` | Optional | Licensed registry & open data simulation | Google Places API (New) key for querying real places globally. |
| `PAGESPEED_API_KEY` | Optional | Fast crawler timing metrics | Google PageSpeed Insights API key for official Core Web Vitals. |
| `TURNSTILE_SITE_KEY` | Optional | Automatic mock bypass | Cloudflare Turnstile CAPTCHA public site key. |
| `TURNSTILE_SECRET_KEY`| Optional | Automatic mock bypass | Cloudflare Turnstile secret verification key. |

> **Note**: The application is built with complete offline / graceful degradation fallbacks. It will run and produce realistic audits and opportunities even if no API keys are configured!

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start fullstack dev server (Express + Vite HMR)
npm run dev

# 3. Build production bundles (frontend static to dist/, server to build/)
npm run build

# 4. Start production standalone server
npm start
```

---

## Architecture Overview

- **Frontend**: React 19, Tailwind CSS v4, Motion (Framer Motion), Recharts, Lucide Icons.
- **Backend**: Express 4, Serverless API handlers (`api/index.ts`), Vite SSR/middleware mode for local dev.
- **Security**: SSRF URL protection, safe CSV formula escaping, cross-tenant RLS workspace isolation, rate limiting, and Turnstile CAPTCHA support.
- **Intelligence**: Google GenAI SDK (`@google/genai`) with prompt injection isolation and Zod schema validation.
