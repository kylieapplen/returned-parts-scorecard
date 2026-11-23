import { sql } from "./db";
import {
  emptySections,
  emptyTracking,
  type Sections,
  type TrackingAnswers,
} from "./checks";
import { scoreAnswers } from "./score";
import type { RecordInput, StoredRecord } from "./types";

type Row = {
  box: string;
  ticket: string;
  customer: string;
  parts: unknown;
  bench: string;
  answers: unknown;
  crit: unknown;
  tracking?: unknown;
  sections?: unknown;
  critical_misses?: unknown;
  date_triaged: string;
  missing: string;
  expected_id: string;
  actual_id: string;
  hw_rev: string;
  triage_notes: string;
  sheet_action: string | null;
  sheet_row: number | null;
  sheet_error: string | null;
  sheet_synced_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
};

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v) as unknown;
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function asAnswerMap(v: unknown): Record<string, string> {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, String(val)]),
    );
  }
  if (typeof v === "string") {
    try {
      return asAnswerMap(JSON.parse(v));
    } catch {
      return {};
    }
  }
  return {};
}

function asTracking(v: unknown): TrackingAnswers {
  const base = emptyTracking();
  const obj = asAnswerMap(v);
  for (const key of Object.keys(base) as (keyof TrackingAnswers)[]) {
    const val = obj[key];
    if (val === "Yes" || val === "No") base[key] = val;
  }
  return base;
}

function asSections(v: unknown): Sections {
  const base = emptySections();
  if (!v || typeof v !== "object") return base;
  const obj = v as Record<string, unknown>;
  for (const key of Object.keys(base) as (keyof Sections)[]) {
    if (typeof obj[key] === "boolean") base[key] = obj[key];
    else if (obj[key] === "true" || obj[key] === true) base[key] = true;
  }
  return base;
}

function iso(v: string | Date | null | undefined): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function mapRow(row: Row): StoredRecord {
  const answers = asAnswerMap(row.answers);
  const tracking = asTracking(row.tracking);
  const sections = asSections(row.sections);
  const criticalMisses = asStringArray(row.critical_misses);
  const scored = scoreAnswers(
    answers,
    row.bench,
    tracking,
    sections,
    criticalMisses,
  );
  return {
    box: row.box,
    ticket: row.ticket ?? "",
    customer: row.customer ?? "",
    parts: asStringArray(row.parts),
    bench: row.bench,
    answers,
    tracking,
    sections,
    criticalMisses,
    crit: scored.crit,
    dateTriaged: row.date_triaged ?? "",
    missing: row.missing ?? "",
    expectedId: row.expected_id ?? "",
    actualId: row.actual_id ?? "",
    hwRev: row.hw_rev ?? "",
    triageNotes: row.triage_notes ?? "",
    sheetAction: row.sheet_action,
    sheetRow: row.sheet_row,
    sheetError: row.sheet_error,
    sheetSyncedAt: iso(row.sheet_synced_at),
    createdAt: iso(row.created_at) || "",
    updatedAt: iso(row.updated_at) || "",
    statusText: scored.statusText,
    result: scored.result,
    scorePct: scored.pct === null ? null : Math.round(scored.pct * 100),
  };
}

export function normalizeInput(input: RecordInput): RecordInput & {
  box: string;
  parts: string[];
  answers: Record<string, string>;
  tracking: TrackingAnswers;
  sections: Sections;
  criticalMisses: string[];
  crit: string[];
} {
  const box = String(input.box || "").trim();
  const parts = (input.parts || [])
    .map((p) => String(p).trim())
    .filter(Boolean);
  const answers: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.answers || {})) {
    if (v === "Yes" || v === "No") answers[String(k)] = v;
  }
  const tracking = asTracking(input.tracking || {});
  const sections = asSections(input.sections || {});
  const criticalMisses = (input.criticalMisses || []).map(String);
  const scored = scoreAnswers(
    answers,
    input.bench || "Not tested yet",
    tracking,
    sections,
    criticalMisses,
  );
  return {
    box,
    ticket: String(input.ticket || "").trim(),
    customer: String(input.customer || "").trim(),
    parts,
    bench: input.bench || "Not tested yet",
    answers,
    tracking,
    sections,
    criticalMisses,
    crit: scored.crit,
    dateTriaged: String(input.dateTriaged || "").trim(),
    missing: String(input.missing || "").trim(),
    expectedId: String(input.expectedId || "").trim(),
    actualId: String(input.actualId || "").trim(),
    hwRev: String(input.hwRev || "").trim(),
    triageNotes: String(input.triageNotes || "").trim(),
  };
}

export async function listRecords(): Promise<StoredRecord[]> {
  const rows = await sql<Row>(
    `select * from records order by updated_at desc, box asc`,
  );
  return rows.map(mapRow);
}

export async function getRecord(box: string): Promise<StoredRecord | null> {
  const rows = await sql<Row>(`select * from records where box = $1`, [
    String(box).trim(),
  ]);
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function upsertRecord(input: RecordInput): Promise<StoredRecord> {
  const r = normalizeInput(input);
  if (!r.box) throw new Error("missing box");

  await sql(
    `insert into records (
      box, ticket, customer, parts, bench, answers, crit,
      tracking, sections, critical_misses,
      date_triaged, missing, expected_id, actual_id, hw_rev, triage_notes,
      updated_at
    ) values (
      $1, $2, $3, $4::jsonb, $5, $6::jsonb, $7::jsonb,
      $8::jsonb, $9::jsonb, $10::jsonb,
      $11, $12, $13, $14, $15, $16, now()
    )
    on conflict (box) do update set
      ticket = excluded.ticket,
      customer = excluded.customer,
      parts = excluded.parts,
      bench = excluded.bench,
      answers = excluded.answers,
      crit = excluded.crit,
      tracking = excluded.tracking,
      sections = excluded.sections,
      critical_misses = excluded.critical_misses,
      date_triaged = excluded.date_triaged,
      missing = excluded.missing,
      expected_id = excluded.expected_id,
      actual_id = excluded.actual_id,
      hw_rev = excluded.hw_rev,
      triage_notes = excluded.triage_notes,
      updated_at = now()`,
    [
      r.box,
      r.ticket,
      r.customer,
      JSON.stringify(r.parts),
      r.bench,
      JSON.stringify(r.answers),
      JSON.stringify(r.crit),
      JSON.stringify(r.tracking),
      JSON.stringify(r.sections),
      JSON.stringify(r.criticalMisses),
      r.dateTriaged,
      r.missing,
      r.expectedId,
      r.actualId,
      r.hwRev,
      r.triageNotes,
    ],
  );

  const saved = await getRecord(r.box);
  if (!saved) throw new Error("save failed");
  return saved;
}

export async function markSheetSync(
  box: string,
  result: {
    ok: boolean;
    action?: string;
    row?: number;
    error?: string;
    skipped?: boolean;
  },
): Promise<StoredRecord | null> {
  if (result.ok) {
    await sql(
      `update records set
        sheet_action = $2,
        sheet_row = $3,
        sheet_error = null,
        sheet_synced_at = now(),
        updated_at = now()
      where box = $1`,
      [String(box).trim(), result.action || "updated", result.row ?? null],
    );
  } else if (result.skipped) {
    await sql(
      `update records set
        sheet_error = $2,
        updated_at = now()
      where box = $1`,
      [
        String(box).trim(),
        result.error ||
          "Sheet sync not configured (set SHEET_WEBHOOK and SHEET_SECRET).",
      ],
    );
  } else {
    await sql(
      `update records set
        sheet_error = $2,
        updated_at = now()
      where box = $1`,
      [String(box).trim(), result.error || "Sheet update failed"],
    );
  }
  return getRecord(box);
}
