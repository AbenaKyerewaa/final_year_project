# Phase 1 Documentation: Project Setup & Architecture

This document tracks the deliverables, structure, and verification guides for **Phase 1: Project Setup and Architecture** of EasyBiz AI.

## Objectives Completed
1.  **Project Directory Scaffolding:** Configured root, backend, and frontend directory layouts.
2.  **FastAPI Backend Initialization:** Set up standard FastAPI web app, CORS configurations, health check endpoint (`/health`), and modular package folders.
3.  **Next.js Frontend Initialization:** Initialized Next.js project with TypeScript, Tailwind CSS, App Router, and ESLint.
4.  **Integration Health Verification:** Developed a frontend service client to fetch backend health status and display connection state on the UI.

---

## File Structure Scaffolded in Phase 1
```text
EasyBiz-ai/
  backend/
    app/
      auth/          # [Placeholder] Authentication and User Roles
      businesses/    # [Placeholder] SME Profile Operations
      products/      # [Placeholder] Product Catalogs
      services/      # [Placeholder] Service Catalogs
      faqs/          # [Placeholder] FAQ Management
      documents/     # [Placeholder] Document upload parsing
      chat/          # [Placeholder] Chat Sessions and History
      rag/           # [Placeholder] Clean, Chunk, Embed and Index
      ai_providers/  # [Placeholder] LLM & Embedding provider abstractions
      database/      # [Placeholder] DB engine, models, and sessions
      utils/         # [Placeholder] Common utilities
      main.py        # FastAPI Application config & CORS/Health routes
    requirements.txt # Python package requirements
    .env.example     # Backend Environment blueprint
  frontend/
    app/             # App Router layout, home page, styles
    components/      # UI components (status badges, layouts)
    lib/             # Library configs
    services/        # Service clients for API requests
    styles/          # Vanilla/Tailwind CSS
    package.json     # Node/npm dependency settings
    .env.example     # Frontend Environment blueprint
  docs/
    README.md        # Root overview index
    methodology.md   # System architectural description
    PHASE_1_README.md# Phase 1 Documentation (This file)
```

---

## Configuration & Environment Variables

### Backend Configuration (`backend/.env.example`)
*   `PORT`: Backend running port (default `8000`).
*   `HOST`: Listening IP address (default `0.0.0.0`).
*   `CORS_ORIGINS`: Allowed origins (default `http://localhost:3000`).
*   `DATABASE_URL`: PostgreSQL connection string.
*   `AI_MODE`: Default mock/local/api setting.

### Frontend Configuration (`frontend/.env.example`)
*   `NEXT_PUBLIC_API_URL`: Path to FastAPI backend API (default `http://localhost:8000`).

---

## Verification Guide

### 1. Launch Backend API
```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Open [http://localhost:8000/health](http://localhost:8000/health) in browser. It should yield:
```json
{
  "status": "healthy",
  "database": "mocked_ok",
  "ai_provider": "mocked_ok",
  "timestamp": "2026-06-22T..."
}
```

### 2. Launch Next.js Dev Client
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in browser. It should load the splash dashboard displaying:
*   **EasyBiz AI Platform Setup** status.
*   **Backend Health Status Badge:** Displays green `Connected` when FastAPI responds to `/health` calls, or red `Disconnected` if API server is offline.
