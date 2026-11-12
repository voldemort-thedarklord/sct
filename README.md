# Smart Community Health — Water Quality & Disease Risk Surveillance

An easy-to-use, AI/ML-powered community water safety and disease early-warning platform. Any user can add monitoring locations (cities, towns, or villages), log water quality tests, report community illness symptoms, view live geospatial risk maps, manage health alerts, and run 7-day outbreak simulations.

---

## Live Architecture & Deployment

| Component | Stack / Hosting | Details |
| :--- | :--- | :--- |
| **Frontend Web App** | **Vercel** (`https://smartcommunityht.vercel.app`) | Next.js `16.4.6` (App Router, Turbopack), React `19.3.0`, TypeScript `^5`, Tailwind CSS `4.3.3` |
| **Backend API** | **Google Cloud Run** (`asia-south1`, Docker `python:3.12-slim`) | FastAPI `>=0.115.0`, Uvicorn `>=0.30.0`, Pydantic `>=2.8.0` (`https://smart-ch-backend-549725275383.asia-south1.run.app`) |
| **Authentication** | **Clerk** (`@clerk/nextjs` `^7.9.25`) | Sign-in/sign-up flows (`frontend/app/sign-in`, `frontend/app/sign-up`) and JWT session verification (`POST /api/auth/clerk-sync`) |
| **Database & Sync** | **Supabase** + **SQLAlchemy** `>=2.0.0` | Cloud Supabase persistence (`backend/supabase_sync.py`) backed by SQLAlchemy ORM (PostgreSQL / MySQL / zero-config SQLite fallback) |
| **AI / ML Engine** | **Scikit-Learn** `>=1.5.0`, **XGBoost** `>=2.1.0`, **Pandas** `>=2.2.0`, **NumPy** `>=2.0.0` | Three serialized `.joblib` models (`backend/ml_engine.py`, `backend/models_artifacts/`) |
| **Maps & Geocoding** | **Leaflet** `^1.9.4` + **OpenStreetMap / CARTO** + **Open-Meteo** | Interactive risk map (`RiskMap.tsx`), keyless Open-Meteo geocoding lookup & live precipitation telemetry |

---

## Core Features

The interface uses a streamlined **4-tab workspace** open to all signed-in users without role restrictions:

1. **Home (`HomeDashboardView.tsx` & `RiskMap.tsx`)**
   - Plain-language water safety summary banner with direct **+ Add Location / Water Test** and **+ Report Illness** actions.
   - 3 focused KPI cards (*Areas Needing Attention*, *Active Health Alerts*, *Reported Illness Cases*).
   - Priority location watchlist paired with an interactive Leaflet map supporting risk filtering, tile style switching (`voyager`, `dark`, `osm`), and 1-click forecast links.

2. **Log & Report (`FieldReportingView.tsx`, `WaterMonitoringView.tsx`, `HealthReportingView.tsx`)**
   - **Add Any Location**: Search any town/village via the keyless Open-Meteo Geocoding API (**Find Pin**) or enter coordinates manually.
   - **Log Water Test**: Enter `pH`, turbidity (`NTU`), water temperature (`°C`), TDS (`mg/L`), dissolved oxygen (`mg/L`), and rainfall (`mm`), or click qualitative presets (*Clear & Odorless*, *Slightly Cloudy / Hard*, *Muddy / Foul Odor*). Displays an immediate ML safety verdict after saving.
   - **Batch Import CSV**: Collapsible drawer with blank/sample CSV downloads (`POST /api/water/upload-csv`).
   - **Report Illness**: Submit symptom checklists, affected counts, severity, and water source details, automatically recalculating location risk.

3. **Health Alerts (`AlertManagementView.tsx`)**
   - Filter between **Active**, **Resolved**, and **All** alerts.
   - Displays practical water-safety guidance on active warnings and a 3-step tracker (**1. Verified → 2. Dispatched → 3. Resolved**) where anyone can confirm, log actions, or mark an area safe (`PATCH /api/alerts/{id}/verify`).

4. **Forecast & Trends (`InsightsSimulatorView.tsx`, `AiPredictionView.tsx`, `ReportsAnalyticsView.tsx`)**
   - **What-If Simulator**: Interactive sliders (`pH`, turbidity, temperature, TDS, dissolved oxygen, active cases, rainfall) to preview disease-risk probabilities, anomaly checks, and 7-day forecast cards.
   - **Trends & CSV Export**: Cross-location risk table, daily symptom/turbidity trend summary, CSV export, and collapsible ML model performance metrics.

5. **Account & Alert Preferences (`AuthView.tsx`)**
   - Slide-over profile drawer for setting **My Town / Area** and optional **Phone Number** for alerts.

---

## Real-World Datasets & AI/ML Pipeline

### Datasets (`backend/data/` & `backend/seed.py`)
- **`indian_cpcb_water_quality.csv`** (`1,991` data rows) — Indian Central Pollution Control Board (CPCB / NWMP) monitoring records.
- **`kaggle_water_potability.csv`** (`3,276` data rows) & **`water_disease_dataset1.csv`** (`1,991` data rows) — Water potability & quality benchmarks.
- **`water_quality_disease_dataset.csv`** (`3,781` data rows) — Unified cleaned training dataset built by `backend/build_real_dataset.py` (combining 1,790 Indian CPCB/NWMP rows and 1,991 Kaggle Water Potability rows).
- **Seeded Indian Locations (`backend/seed.py`)** — 16 real Indian cities, towns, and rural villages across CPCB/CGWB water-issue zones, enriched with live Open-Meteo rainfall data.

### Three-Model ML Pipeline (`backend/ml_engine.py`)
Models train on an 80/20 stratified split of the 7-feature vector (`ph`, `turbidity`, `temperature`, `tds`, `dissolved_oxygen`, `symptom_cases_7d`, `rainfall_mm`) and save `.joblib` artifacts to `backend/models_artifacts/`:
1. **Risk Classification**: `RandomForestClassifier` (`n_estimators=140`, `max_depth=10`) -> predicts `Low`, `Moderate`, `High`, or `Critical` risk.
2. **Sensor Anomaly Detection**: `IsolationForest` (`n_estimators=120`, `contamination=0.12`) -> flags unusual/contaminated water sensor patterns across the 5 water-chemistry readings.
3. **7-Day Outbreak Forecasting**: `XGBRegressor` (`n_estimators=100`, `max_depth=5`, `learning_rate=0.08`) -> projects short-term risk score trajectories.

---

## Project Structure

```text
smart_ch/
├── start.sh                        # Starts FastAPI (:8000) + Next.js (:3000) locally
├── backend/
│   ├── Dockerfile                  # Cloud Run container (python:3.12-slim + libgomp1, pre-trains ML artifacts)
│   ├── requirements.txt            # FastAPI, Uvicorn, SQLAlchemy, Pydantic, Scikit-Learn, Pandas, NumPy, XGBoost
│   ├── main.py                     # FastAPI app, CORS, Clerk auth sync, REST API endpoints
│   ├── database.py                 # SQLAlchemy engine/session setup
│   ├── models.py                   # ORM models (User, CommunityZone, WaterReading, HealthReport, PredictionRecord, AlertRecord)
│   ├── supabase_sync.py            # Startup & write synchronization with Supabase
│   ├── ml_engine.py                # RandomForest, IsolationForest & XGBRegressor training + inference
│   ├── build_real_dataset.py       # Real-dataset cleaning & risk-scoring pipeline
│   ├── seed.py                     # 16 real Indian locations + keyless Open-Meteo precipitation fetch
│   ├── data/                       # Real CPCB, Kaggle & unified CSV datasets
│   └── models_artifacts/           # Serialized .joblib models
└── frontend/
    ├── package.json                # Next.js 16.4.6, React 19, Clerk, Leaflet, Lucide icons, Tailwind v4
    ├── next.config.ts              # Turbopack CSS rule & /api/* proxy rewrite to Cloud Run / NEXT_PUBLIC_BACKEND_URL
    ├── proxy.ts                    # Next.js Clerk middleware
    └── app/
        ├── layout.tsx              # Root dark theme + ClerkProvider
        ├── page.tsx                # Main 4-tab app shell, Clerk views & Profile drawer
        ├── types.ts                # Shared TypeScript interfaces & risk styling maps
        └── components/             # HomeDashboardView, FieldReportingView, WaterMonitoringView,
                                    # HealthReportingView, AlertManagementView, InsightsSimulatorView,
                                    # AiPredictionView, ReportsAnalyticsView, RiskMap, AuthView
```

---

## API Overview (`backend/main.py`)

- `GET /api/health` — Service and ML status check
- `POST /api/auth/clerk-sync`, `PATCH /api/auth/profile`, `GET /api/auth/me` — Clerk profile & alert preferences sync
- `GET /api/zones`, `POST /api/zones` — List or register community monitoring locations
- `GET /api/dashboard/summary` — Aggregated KPIs and zone status summary
- `GET /api/water`, `POST /api/water`, `POST /api/water/upload-csv` — Water reading logs, instant ML inference, and CSV batch import
- `GET /api/health-reports`, `POST /api/health-reports` — Community illness reporting and automatic risk recalculation
- `POST /api/predict`, `GET /api/predictions` — What-If simulation & 7-day forecast records
- `GET /api/alerts`, `PATCH /api/alerts/{alert_id}/verify` — Community alert feed and status updates
- `GET /api/analytics` — Cross-location trends, ML evaluation metrics, and reporting data

---

## Local Development

### Prerequisites
- Python `3.12+` (with `.venv` in `backend/`)
- Node.js `20+` and `npm`

### Environment Variables
Create `backend/.env` (see `backend/.env.example`) and `frontend/.env.local` with your configuration keys:
- **Backend (`backend/.env`)**: `SUPABASE_PROJECT_ID`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `ALLOWED_ORIGINS` (plus optional `DATABASE_URL`, `TWILIO_*`, `SMTP_*`, `OPENWEATHER_API_KEY`).
- **Frontend (`frontend/.env.local`)**: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_BACKEND_URL` (optional `NEXT_PUBLIC_CARTO_API_KEY`).

### Run Both Services Together
```bash
./start.sh
```

Or run them separately:

```bash
# 1. Start FastAPI Backend (http://localhost:8000)
cd backend
.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000

# 2. Start Next.js Frontend (http://localhost:3000)
cd frontend
npm run dev -- --port 3000
```

### Frontend Verification
```bash
cd frontend
npm run build
npm run lint
```
