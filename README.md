# Returned Parts Scorecard → Part Documentation

Internal triage app for returned parts. On save, it updates Diego’s **Part Documentation** Google Sheet (Diagnosis Status + Diagnoses Link), or appends a new row when the Box ID# is new.

Sheet: [Part Documentation](https://docs.google.com/spreadsheets/d/154RSmlSM5Ja90Htvy8FC04Q2rDvioi5xyGcpyz8ceQs/edit) · tab `Sheet1`

## Setup

### 1. Google Apps Script (sheet writer)

1. Open the Part Documentation sheet → **Extensions → Apps Script**.
2. Paste [`apps-script/Code.gs`](apps-script/Code.gs).
3. Set `SECRET` to a long random string (same value as `SHEET_SECRET` below).
4. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: your org (or Anyone with the link + the secret)
5. Copy the web app URL.

### 2. App secrets

| Name | Purpose |
|------|---------|
| `SHEET_WEBHOOK` | Apps Script web app URL |
| `SHEET_SECRET` | Same value as `SECRET` in `Code.gs` |
| `SCORECARD_PUBLIC_URL` | Public origin of this app (used for column L links), e.g. `https://your-app.example` |

Locally you can put them in `.env.local` (not committed). On Cursor hosting, bind `SHEET_WEBHOOK` and `SHEET_SECRET` as app secrets.

### 3. Run locally

```bash
cd returned-parts-scorecard
npm install
npm run dev
```

Open http://127.0.0.1:3000. Without `DATABASE_URL`, data uses in-memory PGlite (resets when the server stops).

## Sheet rules (implemented in Apps Script)

1. Find the last row whose column **B** equals the box number (trimmed text).
2. **Found:** write only **K** (Diagnosis Status) and **L** (Diagnoses Link). Never overwrite A–J.
3. **Missing:** append A–L.
4. Status example: `No fault found · Coach 45%` — Pass if score ≥ 85% and no critical misses.

## Manual retry

After save, the UI shows “Updated row N” / “Added new row”. Use **Send this box to the sheet** to retry. The Apps Script match-on-box path prevents a duplicate append if a previous request actually succeeded.
