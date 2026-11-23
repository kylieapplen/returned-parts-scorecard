"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BENCH_OPTIONS, CHECKS, type Answer } from "@/lib/checks";
import { scoreAnswers } from "@/lib/score";
import type { StoredRecord } from "@/lib/types";

type Props = {
  initial?: StoredRecord | null;
};

type FormState = {
  box: string;
  ticket: string;
  customer: string;
  partsText: string;
  bench: string;
  answers: Record<string, Answer>;
  dateTriaged: string;
  missing: string;
  expectedId: string;
  actualId: string;
  hwRev: string;
  triageNotes: string;
};

function todayYmd(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function fromRecord(r?: StoredRecord | null): FormState {
  const answers: Record<string, Answer> = {};
  for (const c of CHECKS) {
    const v = r?.answers?.[String(c.number)];
    answers[String(c.number)] = v === "Yes" || v === "No" ? v : "";
  }
  return {
    box: r?.box || "",
    ticket: r?.ticket || "",
    customer: r?.customer || "",
    partsText: (r?.parts || []).join(", "),
    bench: r?.bench || "Not tested yet",
    answers,
    dateTriaged: r?.dateTriaged || todayYmd(),
    missing: r?.missing || "",
    expectedId: r?.expectedId || "",
    actualId: r?.actualId || "",
    hwRev: r?.hwRev || "",
    triageNotes: r?.triageNotes || "",
  };
}

function sheetMessage(record: StoredRecord, sheet: {
  ok?: boolean;
  action?: string;
  row?: number;
  error?: string;
  skipped?: boolean;
} | null): { kind: "ok" | "warn" | "err"; text: string } | null {
  if (!sheet) return null;
  if (sheet.skipped) {
    return {
      kind: "warn",
      text: sheet.error || "Sheet sync skipped (webhook not configured).",
    };
  }
  if (sheet.ok) {
    if (sheet.action === "appended") {
      return { kind: "ok", text: `Added new row ${sheet.row} on Part Documentation.` };
    }
    return { kind: "ok", text: `Updated row ${sheet.row} on Part Documentation.` };
  }
  return {
    kind: "err",
    text: `Saved locally, but sheet sync failed: ${sheet.error || "unknown error"}`,
  };
}

export function RecordForm({ initial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => fromRecord(initial));
  const [record, setRecord] = useState<StoredRecord | null>(initial || null);
  const [banner, setBanner] = useState<{ kind: "ok" | "warn" | "err"; text: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const [syncing, setSyncing] = useState(false);

  const liveScore = useMemo(
    () => scoreAnswers(form.answers, form.bench),
    [form.answers, form.bench],
  );

  function setAnswer(n: number, value: Answer) {
    setForm((prev) => ({
      ...prev,
      answers: { ...prev.answers, [String(n)]: prev.answers[String(n)] === value ? "" : value },
    }));
  }

  function payload() {
    return {
      box: form.box.trim(),
      ticket: form.ticket.trim(),
      customer: form.customer.trim(),
      parts: form.partsText
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
      bench: form.bench,
      answers: form.answers,
      dateTriaged: form.dateTriaged,
      missing: form.missing.trim(),
      expectedId: form.expectedId.trim(),
      actualId: form.actualId.trim(),
      hwRev: form.hwRev.trim(),
      triageNotes: form.triageNotes.trim(),
    };
  }

  async function save(syncSheet: boolean) {
    const body = payload();
    if (!body.box) {
      setBanner({ kind: "err", text: "Box ID# is required." });
      return;
    }

    const isNew = !initial?.box;
    const url = isNew ? "/api/records" : `/api/records/${encodeURIComponent(body.box)}`;
    const method = isNew ? "POST" : "PUT";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, syncSheet }),
    });
    const out = await res.json();
    if (!out.ok) {
      setBanner({ kind: "err", text: out.error || "Save failed" });
      return;
    }

    setRecord(out.record);
    setBanner(sheetMessage(out.record, out.sheet) || { kind: "ok", text: "Saved." });

    if (isNew || form.box.trim() !== initial?.box) {
      startTransition(() => {
        router.replace(`/r/${encodeURIComponent(out.record.box)}`);
        router.refresh();
      });
    } else {
      router.refresh();
    }
  }

  async function retrySheet() {
    const body = payload();
    if (!body.box) {
      setBanner({ kind: "err", text: "Save the record before sending to the sheet." });
      return;
    }
    setSyncing(true);
    try {
      // Persist latest form first, without auto-sync, then push to the sheet.
      // Apps Script matches on Box ID and updates K/L when the row exists,
      // so a prior timed-out append will not create a duplicate.
      const isNew = !initial?.box && !record?.box;
      const saveRes = await fetch(
        isNew ? "/api/records" : `/api/records/${encodeURIComponent(body.box)}`,
        {
          method: isNew ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, syncSheet: false }),
        },
      );
      const saved = await saveRes.json();
      if (!saved.ok) {
        setBanner({ kind: "err", text: saved.error || "Save failed before sheet sync" });
        return;
      }
      setRecord(saved.record);

      const res = await fetch(`/api/records/${encodeURIComponent(body.box)}/sync`, {
        method: "POST",
      });
      const out = await res.json();
      if (out.record) setRecord(out.record);
      setBanner(
        sheetMessage(out.record || saved.record, out.sheet) || {
          kind: out.ok ? "ok" : "err",
          text: out.error || "Sheet sync finished",
        },
      );
      if (isNew) {
        router.replace(`/r/${encodeURIComponent(body.box)}`);
      }
      router.refresh();
    } catch (err) {
      setBanner({
        kind: "err",
        text: err instanceof Error ? err.message : "Sheet sync failed",
      });
    } finally {
      setSyncing(false);
    }
  }

  const resultClass =
    liveScore.result === "Pass" ? "pass" : liveScore.result === "Coach" ? "coach" : "none";

  return (
    <>
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h2>Triage</h2>
          <span className={`score-pill ${resultClass}`}>
            {liveScore.statusText || "No score yet"}
          </span>
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="box">Box ID#</label>
            <input
              id="box"
              value={form.box}
              onChange={(e) => setForm({ ...form, box: e.target.value })}
              placeholder="84"
              disabled={Boolean(initial?.box)}
            />
          </div>
          <div className="field">
            <label htmlFor="dateTriaged">Date triaged</label>
            <input
              id="dateTriaged"
              type="date"
              value={form.dateTriaged}
              onChange={(e) => setForm({ ...form, dateTriaged: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="customer">Shipped by (customer)</label>
            <input
              id="customer"
              value={form.customer}
              onChange={(e) => setForm({ ...form, customer: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="ticket">HubSpot ticket ID or URL</label>
            <input
              id="ticket"
              value={form.ticket}
              onChange={(e) => setForm({ ...form, ticket: e.target.value })}
              placeholder="1234567890"
            />
          </div>
          <div className="field full">
            <label htmlFor="parts">Part description (comma-separated)</label>
            <input
              id="parts"
              value={form.partsText}
              onChange={(e) => setForm({ ...form, partsText: e.target.value })}
              placeholder="Main board, Power cable"
            />
          </div>
          <div className="field full">
            <label htmlFor="missing">Missing</label>
            <input
              id="missing"
              value={form.missing}
              onChange={(e) => setForm({ ...form, missing: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="expectedId">Oven serial (listed)</label>
            <input
              id="expectedId"
              value={form.expectedId}
              onChange={(e) => setForm({ ...form, expectedId: e.target.value })}
              placeholder="Serial from ticket / label"
            />
          </div>
          <div className="field">
            <label htmlFor="actualId">Oven serial (verified at bench)</label>
            <input
              id="actualId"
              value={form.actualId}
              onChange={(e) => setForm({ ...form, actualId: e.target.value })}
              placeholder="Optional — if confirmed on unit"
            />
          </div>
          <div className="field">
            <label htmlFor="hwRev">HW rev</label>
            <input
              id="hwRev"
              value={form.hwRev}
              onChange={(e) => setForm({ ...form, hwRev: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="bench">Bench result</label>
            <select
              id="bench"
              value={form.bench}
              onChange={(e) => setForm({ ...form, bench: e.target.value })}
            >
              {BENCH_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div className="field full">
            <label htmlFor="triageNotes">Triage notes</label>
            <textarea
              id="triageNotes"
              value={form.triageNotes}
              onChange={(e) => setForm({ ...form, triageNotes: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="panel">
        <h2>Tech scorecard (Diego → CS tech)</h2>
        <p className="sheet-note" style={{ marginTop: 0, marginBottom: 12 }}>
          Score only what the support tech did. Unit faults, packing, shipping
          damage, root cause, and disposition are not part of this score. Pass =
          ≥ 85% Yes and no critical misses. Score = Yes ÷ (Yes + No).
        </p>
        <div className="checks">
          {CHECKS.map((c) => {
            const value = form.answers[String(c.number)] || "";
            return (
              <div key={c.number} className={`check-row${c.critical ? " critical" : ""}`}>
                <div className="check-label">
                  <strong>{c.number}.</strong>
                  {c.label}
                </div>
                <div className="seg" role="group" aria-label={`Check ${c.number}`}>
                  <button
                    type="button"
                    className={value === "Yes" ? "active-yes" : ""}
                    onClick={() => setAnswer(c.number, "Yes")}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    className={value === "No" ? "active-no" : ""}
                    onClick={() => setAnswer(c.number, "No")}
                  >
                    No
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {liveScore.crit.length > 0 && (
          <div className="banner warn" style={{ marginTop: 12 }}>
            Critical misses: {liveScore.crit.join("; ")}
          </div>
        )}

        <div className="actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={pending || syncing}
            onClick={() => startTransition(() => void save(true))}
          >
            {pending ? "Saving…" : "Save & sync to sheet"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={pending || syncing || !(record?.box || form.box.trim())}
            onClick={() => void retrySheet()}
          >
            {syncing ? "Sending…" : "Send this box to the sheet"}
          </button>
        </div>

        {banner && <div className={`banner ${banner.kind}`}>{banner.text}</div>}

        {record?.sheetSyncedAt && record.sheetAction && !banner && (
          <p className="sheet-note">
            Last sheet sync: {record.sheetAction} row {record.sheetRow} ·{" "}
            {new Date(record.sheetSyncedAt).toLocaleString("en-US", {
              timeZone: "America/Los_Angeles",
            })}{" "}
            PT
          </p>
        )}
        {record?.sheetError && !banner && (
          <div
            className={`banner ${
              record.sheetError.includes("not configured") ? "warn" : "err"
            }`}
          >
            {record.sheetError.includes("not configured")
              ? record.sheetError
              : `Last sheet error: ${record.sheetError}`}
          </div>
        )}
      </div>
    </>
  );
}
