# FECC Candidate Onboarding

Upload the candidate onboarding Excel sheet, see everyone's progress at a glance, and ask an AI assistant questions about it. Answers come only from the uploaded data.

Built on the [aboutmeai](https://github.com/surajydsde/aboutmeai) app shell (React 19, Vite, Tailwind CSS 4, Express, Google Gemini, Vercel Blob), rewritten in plain JavaScript.

## What it does

- **Excel upload (owner only).** Sign in with the owner passcode, then upload a `.xlsx` or `.csv` file (up to 3 MB) on the **Onboarding** tab. The server reads and validates it, then saves it.
- **Upload history.** Every upload is listed with its file name, date and time, row count and size. The newest upload is **LIVE**. The owner can download the original file or delete an upload; deleting the live one makes the previous upload live again. The last 50 uploads are kept.
- **Onboarding dashboard.** Summary cards for pre-onboarding, post-onboarding, required courses and release candidates. A searchable list of candidates with status and department filters, plus a "pending by course" breakdown.
- **AI chat grounded in the sheet.** Every question is answered from the live upload only. The AI does not receive the sheet: it calls four server tools (summary, list candidates, one candidate, grouped counts) that filter and count in code, then words the answer from their exact results. With no upload, the chat says so without calling the AI.

### Business rules

| Field | Meaning |
|---|---|
| Pre-Onboarding Checklist | Completed or Pending |
| Post-Onboarding Checklist | Completed or Pending |
| Required Courses / Completed Courses | Semicolon-separated lists. Courses are complete when every required course appears in Completed Courses (case-insensitive). |
| Release Status | Released or Not Released |

Release candidates and course-complete candidates are the **same category**: anyone who has completed all required courses counts as released.

Each candidate gets one stage, in this order: Pre-onboarding pending → Post-onboarding pending → Courses pending → Released / course complete.

## Excel format

Download the sample from the app (**Sample Excel** link) or use [`public/sample/fecc-candidates-sample.xlsx`](public/sample/fecc-candidates-sample.xlsx): 25 dummy candidates with an Instructions sheet and dropdowns for the status columns. Regenerate it with `npm run sample`.

| Column | Required | Notes |
|---|---|---|
| Candidate Name | Yes | |
| Pre-Onboarding Checklist | Yes | Completed / Pending (Yes/No and Done also work) |
| Post-Onboarding Checklist | Yes | Completed / Pending |
| Candidate ID, Email, Department, Role, Joining Date | No | |
| Required Courses, Completed Courses | Recommended | Separate courses with `;` |
| Release Status | No | Released / Not Released |
| Remarks | No | |

Headers are matched loosely ("Pre Onboarding", "PRE-ONBOARDING STATUS" and "pre_onboarding" all work). The app reads the sheet named **Candidates**, or the first sheet with data. Unrecognised values and missing optional columns are reported as notes after the upload.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
cp .env.example .env    # set GEMINI_API_KEY and OWNER_PASSCODE
npm run dev             # http://localhost:3000
```

Without a Blob token, uploads are kept in memory until the server restarts.

| Script | What it does |
|---|---|
| `npm run dev` | Express + Vite dev server |
| `npm run build` | Production build into `dist/` |
| `npm start` | Serve the production build |
| `npm test` | Vitest (parsing, API, storage, components) |
| `npm run lint` | ESLint |
| `npm run sample` | Regenerate the sample Excel |

## Deploy to Vercel

1. Import this repo in Vercel. The framework preset can stay as "Other"; `vercel.json` handles the build and routing.
2. Under **Settings → Environment Variables**, add `GEMINI_API_KEY` and `OWNER_PASSCODE` (use a long, unique passcode).
3. Under **Storage**, create a **Blob** store and connect it to the project. This adds `BLOB_READ_WRITE_TOKEN` automatically. Private stores are preferred; public stores also work.
4. Redeploy, open the site, tap the lock icon, enter the passcode and upload the sheet.

Check `/api/health` to confirm the API key, owner login and storage are all set.

## API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/dataset` | – | Live dataset, summary and upload history |
| POST | `/api/uploads` | Owner | Upload a sheet: JSON `{ fileName, contentType, contentBase64 }` |
| GET | `/api/uploads/:id/file` | Owner | Download the original file |
| DELETE | `/api/uploads/:id` | Owner | Delete an upload |
| POST | `/api/chat` | – | Ask a question: `{ message, history }` |
| POST | `/api/admin/login` | – | Exchange the passcode for a 12-hour token |
| GET | `/api/admin/verify` | – | Check a token |
| GET | `/api/health` | – | Configuration status |

Uploads travel as base64 JSON because JSON bodies parse reliably on Vercel's Node runtime; that is also why the file limit is 3 MB (Vercel caps request bodies at 4.5 MB).

## Security and privacy

- The passcode is checked on the server only; tokens are HMAC-signed and expire after 12 hours. Login, upload and chat are rate-limited.
- Files are parsed on the server with size, type and row limits (5,000 candidates). File names are sanitised.
- The AI is told to treat the sheet as data, not instructions.
- **Candidate data is personal data.** Anyone with the site link can view the dashboard and chat; only the owner can upload, download or delete. Share the link only with people who need it.

## Project structure

```
api/index.js            Express API (also the Vercel function)
server/                 auth, rate limit, Excel/CSV parsing, Blob storage
server.js               local dev / production server
src/lib/candidates.js   shared rules: column mapping, stages, summary, AI context
src/components/         chat, dashboard, upload, history, candidate list
scripts/generate-sample.js
public/                 logo, icons, sample Excel
```

## License

MIT
