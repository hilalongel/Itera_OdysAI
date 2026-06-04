# Here are your Instructions
# OdysAI

An AI-powered travel itinerary planner. Users sign up, set their travel preferences (destination, dates, budget, travel style, activities), and an AI agent generates a structured day by day itinerary that is saved to their account.

- **Backend:** FastAPI + SQLite, with JWT cookie authentication. Itineraries are generated through the [Groq](https://console.groq.com) API (OpenAI-compatible).
- **Frontend:** React (Create React App + CRACO), styled with Tailwind CSS.

---

## Prerequisites

Before you start, make sure you have:

- **Python 3.11** (the project was built and tested on 3.11) — https://www.python.org/downloads/
- **Node.js 18+** and **Yarn** — https://nodejs.org and `npm install -g yarn`
- **Git** — https://git-scm.com
- **A Groq API key** (free) — create one at https://console.groq.com → *API Keys*

---

## 1. Clone the repository

```bash
git clone https://github.com/damla-ucar7/OdysAI.git
cd OdysAI
```

The project has two parts that run side by side:

```
OdysAI/
├── backend/      FastAPI server, database, AI service
└── frontend/     React single-page app
```

---

## 2. Backend setup

From the project root:

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv

# Activate it:
#   Windows (CMD):        .venv\Scripts\activate
#   Windows (PowerShell): .venv\Scripts\Activate.ps1
#   macOS / Linux:        source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Configure environment variables

Create a file named `.env` inside the `backend/` folder:

```
GROQ_API_KEY=gsk_your_groq_api_key_here
JWT_SECRET=replace_with_a_long_random_string
```

- `GROQ_API_KEY` — your key from the Groq console. It must start with `gsk_`.
- `JWT_SECRET` — any long random string used to sign login tokens. Generate one with:
  ```bash
  python -c "import secrets; print(secrets.token_hex(32))"
  ```

> **Never commit your `.env` file.** It is already listed in `.gitignore`.

### Run the backend

```bash
uvicorn server:app --reload --port 8000
```

The API is now running at `http://localhost:8000`. The SQLite database (`odysai.db`) is created automatically on first launch.

---

## 3. Frontend setup

Open a **second terminal** and from the project root:

```bash
cd frontend
yarn install
```

### Configure environment variables

Create a file named `.env` inside the `frontend/` folder:

```
REACT_APP_BACKEND_URL=http://localhost:8000
```

This tells the React app where to find the backend API.

### Run the frontend (development)

```bash
yarn start
```

The app opens at `http://localhost:3000` and talks to the backend on port 8000.

---

## 4. Building for production

To create an optimized production build of the frontend:

```bash
cd frontend
yarn build
```

This generates a static bundle in `frontend/build/`. You can serve that folder with any static file server, while the FastAPI backend runs separately (e.g. behind a reverse proxy). Remember to point `REACT_APP_BACKEND_URL` at your deployed backend URL before building for production.

---

## Environment variables reference

| File           | Variable                | Required | Description                                          |
| -------------- | ----------------------- | -------- | ---------------------------------------------------- |
| `backend/.env` | `GROQ_API_KEY`          | Yes      | Groq API key (starts with `gsk_`).                   |
| `backend/.env` | `JWT_SECRET`            | Yes      | Secret used to sign auth tokens. Use a long random string. |
| `backend/.env` | `LLM_MODEL`             | No       | Override the model. Defaults to `llama-3.3-70b-versatile`. |
| `backend/.env` | `LLM_BASE_URL`          | No       | Override the API endpoint. Defaults to Groq.         |
| `frontend/.env`| `REACT_APP_BACKEND_URL` | Yes      | URL of the backend API (e.g. `http://localhost:8000`). |

---

## Troubleshooting

**`401 Invalid API Key` when generating an itinerary**
Your `GROQ_API_KEY` is missing, malformed, or revoked. Open `backend/.env`, confirm the line is exactly `GROQ_API_KEY=gsk_...` with a single `=` and no quotes or spaces, then restart the backend.

**Login works but generating/saving fails with 401**
The auth token is stored in a cookie set with `Secure` + `SameSite=None`, which some browsers refuse to store over plain `http://localhost`. If this happens during local development, either run the app over HTTPS, or temporarily relax the cookie flags in `backend/auth.py` (`secure=False`, `samesite="lax"`) for local testing only.

**`ModuleNotFoundError: No module named 'openai'`**
Make sure `openai>=1.0.0` is in `requirements.txt` and run `pip install -r requirements.txt` again inside your activated virtual environment.

**Frontend can't reach the backend**
Confirm both servers are running, and that `REACT_APP_BACKEND_URL` in `frontend/.env` matches the backend's address. After changing a `.env` value, restart `yarn start` (React only reads env vars at startup).

---

## Tech stack

- **Backend:** FastAPI, Uvicorn, SQLite, PyJWT, bcrypt, OpenAI Python SDK (pointed at Groq)
- **Frontend:** React, Create React App, CRACO, Tailwind CSS, Axios
- **AI:** Groq API (`llama-3.3-70b-versatile` by default)
