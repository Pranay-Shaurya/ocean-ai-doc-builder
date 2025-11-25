# Frontend

React + Vite single-page app for Ocean AI Document Builder. It provides:

- Auth screens (login + register) that talk to the FastAPI backend.
- Guided project creation with AI-assisted outlines.
- Real-time project dashboard with generation, refinement, and export controls.

## Getting Started

```bash
cd frontend
npm install
npm run dev
```

Set `VITE_API_BASE` if you deploy the backend elsewhere (defaults to `http://127.0.0.1:8000` through the Axios client). See the root `README.md` for the full system overview, environment variables, and usage notes.
