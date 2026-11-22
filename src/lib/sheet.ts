import type { RecordInput } from "./types";
import type { SheetSyncResult } from "./types";

function webhookConfigured(): { url: string; secret: string } | null {
  const url = process.env.SHEET_WEBHOOK?.trim() ?? "";
  const secret = process.env.SHEET_SECRET?.trim() ?? "";
  if (!url || !secret || url.includes("XXXX") || secret === "CHANGE_ME") {
    return null;
  }
  return { url, secret };
}

export function scorecardLinkFor(box: string): string {
  const base =
    process.env.SCORECARD_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  const clean = String(box).trim();
  if (!base) return `#box${clean}`;
  return `${base.replace(/\/$/, "")}/r/${encodeURIComponent(clean)}`;
}

/**
 * POST to the Part Documentation Apps Script web app.
 * Uses text/plain to avoid a CORS preflight Apps Script does not answer.
 */
export async function syncToPartDocumentation(
  record: RecordInput & { crit?: string[] },
): Promise<SheetSyncResult> {
  const cfg = webhookConfigured();
  if (!cfg) {
    return {
      ok: false,
      skipped: true,
      error:
        "Sheet sync not configured. Set SHEET_WEBHOOK and SHEET_SECRET (and deploy Apps Script).",
    };
  }

  const payload = {
    secret: cfg.secret,
    record: {
      ...record,
      scorecardLink: scorecardLinkFor(String(record.box || "")),
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow",
      signal: controller.signal,
    });
    const text = await res.text();
    let out: SheetSyncResult;
    try {
      out = JSON.parse(text) as SheetSyncResult;
    } catch {
      return { ok: false, error: `Sheet response not JSON (${res.status})` };
    }
    if (!out.ok) return { ok: false, error: out.error || "Sheet update failed" };
    return out;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg.includes("abort") ? "Sheet request timed out" : msg };
  } finally {
    clearTimeout(timer);
  }
}
