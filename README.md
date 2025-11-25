## Ocean AI Document Builder

End-to-end platform for authoring, refining, and exporting business documents with Gemini assistance. Users authenticate, design a structure for either Word (`.docx`) or PowerPoint (`.pptx`), let the LLM fill in each section/slide, iterate with targeted prompts and feedback, then export the final artifact.

### Stack
- **Backend:** FastAPI, SQLAlchemy, SQLite (`backend/ocean_ai.db`), JWT auth, Google Gemini client, `python-docx`, `python-pptx`.
- **Frontend:** React + Vite, Axios, modern responsive UI.
- **AI:** Gemini 2.0 Flash model for outline suggestions, section generation, and refinements.

### Prerequisites
- Python 3.11+ (project developed on 3.12)
- Node.js 18+
- A valid `GEMINI_API_KEY`

### Environment Variables
| Name | Where | Description |
| --- | --- | --- |
| `GEMINI_API_KEY` | Backend | Required; Google AI Studio key. |
| `JWT_SECRET` | Backend (optional) | Overrides default signing key for auth tokens. |

Recommended (macOS / zsh):
```bash
echo 'export GEMINI_API_KEY="your-key-here"' >> ~/.zshrc
echo 'export JWT_SECRET="choose-a-strong-secret"' >> ~/.zshrc
source ~/.zshrc
```

### Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

The API runs at `http://127.0.0.1:8000`. A new SQLite DB (`ocean_ai.db`) is created automatically; delete it to reset your data.

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Visit `http://127.0.0.1:5173` and log in or create an account.

### Usage Flow
1. **Sign up / Sign in** (JWT-based auth).  
2. **Create a project:** choose `.docx` or `.pptx`, enter topic and headings (or use “AI suggest outline”).  
3. **Generate content:** trigger `Generate` to have Gemini draft each section/slide.  
4. **Refine:** per-section prompt box, like/dislike buttons, and comment field persist history.  
5. **Export:** download the latest `.docx` or `.pptx` assembled from refined content.

### API Highlights
- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- `GET/POST /projects`, `GET /projects/{id}`
- `POST /projects/{id}/generate` (initial or regenerate)
- `POST /sections/{id}/refine` and `/sections/{id}/feedback`
- `GET /projects/{id}/export` → binary `.docx` or `.pptx`
- `GET /ai/suggest-outline` → AI-generated structure seeds

### Demo Checklist
Record a walkthrough covering: user registration & login, new Word + PowerPoint flows, AI generation, refinement with prompts + like/dislike/comments, and exports. (An optional segment can show the AI-generated outline helper.)

### Troubleshooting
- **“Could not validate credentials”** – ensure `Authorization: Bearer token` is sent; log in again if token expired.
- **AI errors** – confirm `GEMINI_API_KEY` is set and the backend terminal shows no auth errors.
- **Schema mismatch** – delete `backend/ocean_ai.db` to rebuild tables after model changes.

Happy building! Adjust styling/content as needed before publishing or deploying.

