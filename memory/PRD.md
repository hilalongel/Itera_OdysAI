# OdysAI — Product Requirements & Progress

## Original problem statement
Build "OdysAI", a travel itinerary organizer powered by a ChatGPT-style AI. Simple ChatGPT clone focused on travel planning.
Stack: React frontend, FastAPI backend, SQLite database, ChatGPT-style AI via prompt engineering. Clean modern UI.

## User reported issue (2026-06-02)
"When user doesn't enter any information, or enters a few information, the agent does produce random travel plans, maybe we can add a form prior to this generation so that user can enter budget etc etc." — keep it simple (MVP), no fancy stuff.

## User choices
- AI: Emergent Universal LLM key + Gemini 3 Flash (`gemini-3-flash-preview`).
- Database: SQLite.
- Auth: simple email/password (custom JWT in httpOnly cookie, bcrypt).
- Design: Organic & Earthy travel-journal theme (Terracotta #C05621 + Moss #3F5E4D, Cormorant Garamond + Work Sans). Keep as-is.

## Architecture
- Backend `/app/backend`: server.py (FastAPI routes), database.py (SQLite schema), auth.py (bcrypt + JWT cookie), llm_service.py (Gemini).
- SQLite file: `/app/backend/odysai.db`. Tables: users, itineraries, itinerary_days, activities.
- Frontend `/app/frontend/src`: AuthContext, lib/api.js, pages/Login.jsx, pages/Dashboard.jsx, components/{Sidebar, ChatPanel, PreferencesForm, ItineraryView}.jsx, hooks/useItineraries.js.

## Core requirements
- ChatGPT-style chat to request itineraries.
- Travel preferences form (age, destination, dates, budget, travel style, activity types, walking tolerance, food, hotel, travelers).
- Day-by-day itinerary view (activities, time slot, cost, location, type badge, booking link).
- Buttons: Generate, Update, Save, Clear.
- **NEW: Required preferences gate before first generation** — destination + start_date + end_date + budget + num_travelers must be filled.

## Implemented
### 2026-06-01
- Full auth (signup/login/me) with JWT cookie + bcrypt on SQLite.
- /chat endpoint generating structured itineraries via Gemini 3 Flash.
- Full itinerary CRUD (create/update/list/get/delete).
- Frontend: split-screen login, sidebar with saved trips, chat panel with 4 action buttons, bento preferences form, day-by-day timeline view.

### 2026-06-02 (bug fix per user request)
- **Required preferences gate**: Dashboard now blocks the first /api/chat call if any of {destination, start_date, end_date, budget, num_travelers} is empty.
- Missing required fields are highlighted with red borders, red asterisks, an inline error banner inside the form, and an inline hint under the action buttons.
- Toast error lists missing field labels and the right panel auto-switches to the Preferences tab.
- Once an itinerary exists, all chat/update interactions stay unblocked (refinement flow unchanged).
- LLM prompt rule 7 tightened: never invent a destination, never override explicit start_date/end_date/budget/num_travelers from preferences.

## Verified by testing agent (iteration_5)
- 8/8 backend pytest passing (auth + CRUD + /chat).
- Frontend flow: empty-prefs Generate is blocked (0 /api/chat calls), banner + missing-prefs-hint + empty-state-missing-prefs all render, red borders on 5 required fields. After filling Rome / dates / Mid-range / 2 travelers, /api/chat fires, itinerary renders, Save works.

## Backlog / Next
- P1: Mobile layout for preferences/itinerary (currently right panel is lg+ only).
- P1: Per-activity inline edit / drag reorder.
- P2: Map view of all activities; export/share itinerary (PDF/link).
- P2: Weather API integration for real weather snapshots.
