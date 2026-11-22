/**
 * Part Documentation sheet writer for Returned Parts Scorecard.
 *
 * Deploy: Extensions → Apps Script → paste → Deploy → New deployment → Web app
 *   Execute as: Me (account that can edit the sheet)
 *   Who has access: your org (or Anyone with the link + shared secret)
 * Copy the web app URL into SHEET_WEBHOOK. Set SECRET to match SHEET_SECRET.
 */
const SHEET_ID = '154RSmlSM5Ja90Htvy8FC04Q2rDvioi5xyGcpyz8ceQs';
const TAB = 'Sheet1';
const SECRET = 'CHANGE_ME'; // set the same value in SHEET_SECRET
const HUBSPOT_TICKET = 'https://app.hubspot.com/contacts/9033700/record/0-5/';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    if (body.secret !== SECRET) return json_({ ok: false, error: 'unauthorized' });
    const r = body.record || {};
    const box = String(r.box || '').trim();
    if (!box) return json_({ ok: false, error: 'missing box' });

    const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TAB);
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const last = sh.getLastRow();
      // (row, column, numRows, numColumns) — column B from row 2 through last
      const boxes = last > 1 ? sh.getRange(2, 2, last - 1, 1).getDisplayValues() : [];
      let row = -1;
      boxes.forEach((v, i) => { if (String(v[0]).trim() === box) row = i + 2; });

      const status = statusText_(r);
      const link = r.scorecardLink || '';

      if (row > 0) {
        // Never overwrite Diego's columns A–J — only K (Diagnosis Status) and L (Diagnoses Link)
        sh.getRange(row, 11, 1, 2).setValues([[status, link]]);
        return json_({ ok: true, action: 'updated', row });
      }
      const ticket = r.ticket ? (/^https?:/.test(r.ticket) ? r.ticket : HUBSPOT_TICKET + r.ticket + '/') : '';
      sh.appendRow([
        usDate_(r.dateTriaged) || usDate_(new Date().toISOString().slice(0, 10)),
        box, r.customer || '', r.missing || '', (r.parts || []).join(', '),
        r.expectedId || '', r.actualId || '', r.hwRev || '', r.triageNotes || '',
        ticket, status, link,
      ]);
      return json_({ ok: true, action: 'appended', row: sh.getLastRow() });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function statusText_(r) {
  let yes = 0, no = 0;
  Object.values(r.answers || {}).forEach(v => { if (v === 'Yes') yes++; else if (v === 'No') no++; });
  const pct = (yes + no) ? yes / (yes + no) : null;
  const result = pct === null ? '' : ((r.crit && r.crit.length) || pct < 0.85 ? 'Coach' : 'Pass');
  const scorePart = result ? `${result}${pct !== null ? ' ' + Math.round(pct * 100) + '%' : ''}` : '';
  return [r.bench || 'Not tested yet', scorePart].filter(Boolean).join(' · ');
}

function usDate_(d) {
  if (!d) return '';
  const [y, m, dd] = String(d).split('-');
  return `${+m}/${+dd}/${y.slice(2)}`;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
