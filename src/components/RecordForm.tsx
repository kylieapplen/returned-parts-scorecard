"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BENCH_OPTIONS,
  CRITICAL_MISSES,
  SECTION_TOGGLES,
  TRACKING_QUESTIONS,
  applicableChecks,
  emptySections,
  emptyTracking,
  sectionHeading,
  type Answer,
  type Sections,
  type TrackingAnswers,
} from "@/lib/checks";
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
  tracking: TrackingAnswers;
  sections: Sections;
  criticalMisses: string[];
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
  for (const [k, v] of Object.entries(r?.answers || {})) {
    if (v === "Yes" || v === "No") answers[k] = v;
  }
  return {
    box: r?.box || "",
    ticket: r?.ticket || "",
    customer: r?.customer || "",
    partsText: (r?.parts || []).join(", "),
    bench: r?.bench || "Not tested yet",
    answers,
    tracking: { ...emptyTracking(), ...(r?.tracking || {}) },
    sections: { ...emptySections(), ...(r?.sections || {}) },
    criticalMisses: r?.criticalMisses || [],
    dateTriaged: r?.dateTriaged || todayYmd(),
    missing: r?.missing || "",
    expectedId: r?.expectedId || "",
    actualId: r?.actualId || "",
    hwRev: r?.hwRev || "",
    triageNotes: r?.triageNotes || "",
  };
}

function sheetMessage(
  _record: StoredRecord,
  sheet: {
    ok?: boolean;
    action?: string;
    row?: number;
    error?: string;
    skipped?: boolean;
  } | null,
): { kind: "ok" | "warn" | "err"; text: string } | null {
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

function YesNo({
  value,
  onChange,
  label,
}: {
  value: Answer;
  onChange: (v: Answer) => void;
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      <button
        type="button"
        className={value === "Yes" ? "active-yes" : ""}
        onClick={() => onChange(value === "Yes" ? "" : "Yes")}
      >
        Yes
      </button>
      <button
        type="button"
        className={value === "No" ? "active-no" : ""}
        onClick={() => onChange(value === "No" ? "" : "No")}
      >
        No
      </button>
    </div>
  );
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

  const visibleChecks = useMemo(
    () => applicableChecks(form.tracking, form.sections),
    [form.tracking, form.sections],
  );

  const liveScore = useMemo(
    () =>
      scoreAnswers(
        form.answers,
        form.bench,
        form.tracking,
        form.sections,
        form.criticalMisses,
      ),
    [form.answers, form.bench, form.tracking, form.sections, form.criticalMisses],
  );

  const grouped = useMemo(() => {
    const groups: { heading: string; checks: typeof visibleChecks }[] = [];
    for (const check of visibleChecks) {
      const heading = sectionHeading(check.section);
      const last = groups[groups.length - 1];
      if (last && last.heading === heading) last.checks.push(check);
      else groups.push({ heading, checks: [check] });
    }
    return groups;
  }, [visibleChecks]);

  function setAnswer(n: number, value: Answer) {
    setForm((prev) => ({
      ...prev,
      answers: {
        ...prev.answers,
        [String(n)]: prev.answers[String(n)] === value ? "" : value,
      },
    }));
  }

  function payload() {
    const allowed = new Set(visibleChecks.map((c) => String(c.number)));
    const answers: Record<string, Answer> = {};
    for (const [k, v] of Object.entries(form.answers)) {
      if (allowed.has(k) && (v === "Yes" || v === "No")) answers[k] = v;
    }
    return {
      box: form.box.trim(),
      ticket: form.ticket.trim(),
      customer: form.customer.trim(),
      parts: form.partsText
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
      bench: form.bench,
      answers,
      tracking: form.tracking,
      sections: form.sections,
      criticalMisses: form.criticalMisses,
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
      if (isNew) router.replace(`/r/${encodeURIComponent(body.box)}`);
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
          <h2>Call / box</h2>
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
            <label htmlFor="customer">Customer</label>
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
            />
          </div>
          <div className="field full">
            <label htmlFor="parts">Parts sent (comma-separated)</label>
            <input
              id="parts"
              value={form.partsText}
              onChange={(e) => setForm({ ...form, partsText: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="expectedId">Oven serial</label>
            <input
              id="expectedId"
              value={form.expectedId}
              onChange={(e) => setForm({ ...form, expectedId: e.target.value })}
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
            <label htmlFor="bench">Bench result (Diego)</label>
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
            <label htmlFor="triageNotes">Notes</label>
            <textarea
              id="triageNotes"
              value={form.triageNotes}
              onChange={(e) => setForm({ ...form, triageNotes: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="panel">
        <h2>Tracking (not scored)</h2>
        <p className="sheet-note" style={{ marginTop: 0, marginBottom: 12 }}>
          These only decide which scored checks appear.
        </p>
        <div className="checks">
          {TRACKING_QUESTIONS.map((q) => (
            <div key={q.key} className="check-row">
              <div className="check-label">
                <strong>{q.label}</strong>
                <div className="sheet-note" style={{ margin: "4px 0 0" }}>
                  {q.help}
                </div>
              </div>
              <YesNo
                label={q.label}
                value={form.tracking[q.key]}
                onChange={(v) =>
                  setForm((prev) => ({
                    ...prev,
                    tracking: { ...prev.tracking, [q.key]: v },
                  }))
                }
              />
            </div>
          ))}
        </div>
        {form.tracking.bakeDay === "Yes" && (
          <p className="sheet-note">Bake day → check 16 appears below.</p>
        )}
        {form.tracking.repeatFailure === "Yes" && (
          <p className="sheet-note">Repeat failure → check 17 appears below.</p>
        )}
        {form.tracking.safetyConcern === "Yes" && (
          <div className="banner warn" style={{ marginTop: 12 }}>
            Safety concern on the call — verify check 4 (all five questions + unplug) and
            use a critical miss if Engineering wasn’t looped in when required.
          </div>
        )}
      </div>

      <div className="panel">
        <h2>Which sections apply?</h2>
        <p className="sheet-note" style={{ marginTop: 0, marginBottom: 12 }}>
          Turn on the problem types for this call. Extra part-type toggles unlock
          valve / control-board checks.
        </p>
        <div className="section-toggles">
          {SECTION_TOGGLES.map((s) => (
            <label key={s.key} className="toggle-chip">
              <input
                type="checkbox"
                checked={form.sections[s.key]}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    sections: { ...prev.sections, [s.key]: e.target.checked },
                  }))
                }
              />
              {s.label}
            </label>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>Tech scorecard</h2>
        <p className="sheet-note" style={{ marginTop: 0, marginBottom: 12 }}>
          Pass = ≥ 85% Yes among answered applicable checks, and no critical
          misses. Unanswered checks are skipped. Score = Yes ÷ (Yes + No).
        </p>

        {grouped.map((group) => (
          <div key={group.heading} className="check-group">
            <h3 className="check-group-title">{group.heading}</h3>
            <div className="checks">
              {group.checks.map((c) => {
                const value = form.answers[String(c.number)] || "";
                return (
                  <div key={c.number} className="check-row">
                    <div className="check-label">
                      <strong>{c.number}.</strong>
                      {c.label}
                    </div>
                    <YesNo
                      label={`Check ${c.number}`}
                      value={value}
                      onChange={(v) => setAnswer(c.number, v)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {visibleChecks.length === 0 && (
          <p className="empty">Turn on a section above to show scored checks.</p>
        )}
      </div>

      <div className="panel">
        <h2>Critical misses</h2>
        <p className="sheet-note" style={{ marginTop: 0, marginBottom: 12 }}>
          Any one checked makes the result Coach, whatever the percentage.
        </p>
        <div className="checks">
          {CRITICAL_MISSES.map((m) => {
            const on = form.criticalMisses.includes(m.id);
            return (
              <label key={m.id} className={`check-row miss-row${on ? " miss-on" : ""}`}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      criticalMisses: e.target.checked
                        ? [...prev.criticalMisses, m.id]
                        : prev.criticalMisses.filter((id) => id !== m.id),
                    }))
                  }
                />
                <span className="check-label">{m.label}</span>
              </label>
            );
          })}
        </div>

        {liveScore.crit.length > 0 && (
          <div className="banner warn" style={{ marginTop: 12 }}>
            Critical miss → Coach
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
            Last sheet sync: {record.sheetAction} row {record.sheetRow}
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
