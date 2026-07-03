# QuickMove Intake Tracker — Deployment Guide

Three parts to set up: (1) your Google Sheet as the tracker backend, (2) a Gemini API key for real AI classification, (3) hosting the app itself. Total time: about 15 minutes.

---

## Part 1 — Connect a Google Sheet as your backend

1. Open Google Sheets and create a new blank sheet (or use an existing one).
2. Go to **Extensions > Apps Script**.
3. Delete whatever placeholder code is in `Code.gs`, then paste in the entire contents of **apps-script.gs** (included in this folder).
4. Save the project (Ctrl+S / Cmd+S). Give it any name, e.g. "QuickMove Intake Backend".
5. Click **Deploy > New deployment**.
6. Click the gear icon next to "Select type" and choose **Web app**.
7. Set:
   - **Execute as:** Me
   - **Who has access:** Anyone
8. Click **Deploy**.
9. Google will ask you to authorize the script — click through the prompts. It may warn "Google hasn't verified this app" since it's your own script; click **Advanced > Go to [project name] (unsafe)** to proceed. This is expected and safe — you're authorizing your own script to edit your own sheet.
10. Copy the **Web App URL** you're given (looks like `https://script.google.com/macros/s/XXXXXXX/exec`). You'll need this in Part 3.

The script automatically creates a tab called **"Intake"** in your sheet the first time it runs, with the right columns already set up.

---

## Part 2 — Get a Gemini API key

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and sign in with your Google account.
2. Click **Create API key** (free tier is fine to start).
3. Copy the key — you'll paste it into Vercel's environment variables in the next step, not into the app itself.

---

## Part 3 — Host the app on Vercel

This app now includes a serverless function (`api/classify.js`), so it needs Vercel specifically (not a plain drag-and-drop static host).

1. Push this whole `quickmove-deploy` folder to a GitHub repository (or use the Vercel CLI to deploy the folder directly — see [vercel.com/docs/cli](https://vercel.com/docs/cli)).
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
3. No build settings needed — Vercel auto-detects the `api/` folder as serverless functions and `index.html` as a static file.
4. Before or after the first deploy, go to **Project Settings > Environment Variables** and add:
   - `GEMINI_API_KEY` — the key from Part 2
   - `GEMINI_MODEL` — optional, defaults to `gemini-2.5-flash` if not set
5. Deploy (or redeploy, if you added the env vars after the first deploy — env var changes need a redeploy to take effect).
6. You'll get a live URL (e.g. `your-project.vercel.app`).

---

## Part 4 — Connect the app to your Sheet

1. Open your deployed URL.
2. At the top, paste your **Apps Script Web App URL** from Part 1 into the "Google Sheet Connection" box.
3. Click **Save**, then **Test Connection** — you should see a confirmation.
4. Try sending one of the sample messages from the Customer Chat tab, then switch to the Ops Tracker tab and click Refresh — it should appear there **and** as a new row in your Google Sheet.

Each teammate who opens the app for the first time needs to paste the same Apps Script URL once (saved in their browser after that). The Gemini key is server-side and shared automatically — nobody needs to configure that part individually.

---

## Notes & limitations

- **Classification runs on Gemini** (via the serverless function), with the old keyword-matching logic kept as an automatic fallback — if the Gemini call ever fails (quota, network, misconfigured key), the message still gets classified and saved, just with a "[keyword fallback]" tag in the save-status line so you know it happened.
- **No authentication on the Sheet endpoint.** Anyone with the Apps Script Web App URL can write to your sheet. Fine for an internal pilot; add a shared secret/token check in the Apps Script before trusting it with sensitive production data.
- **Status updates** (Open/Resolved) write back to the same Sheet, so the Sheet stays the single source of truth — the app is just a nicer front door to it.
- **Gemini API key never touches the browser** — it lives only in Vercel's environment variables and is used inside `api/classify.js`, which runs server-side.

