import { NextResponse } from "next/server";
import { getRecord, markSheetSync } from "@/lib/records";
import { syncToPartDocumentation } from "@/lib/sheet";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ box: string }> };

/**
 * Manual "Send this box to the sheet" retry.
 * Apps Script finds by Box ID (col B) first — updates K/L if present,
 * appends only when missing — so a timed-out success won't double-append.
 */
export async function POST(_request: Request, ctx: Ctx) {
  try {
    const { box } = await ctx.params;
    const record = await getRecord(decodeURIComponent(box));
    if (!record) {
      return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    }

    const sync = await syncToPartDocumentation({
      box: record.box,
      ticket: record.ticket,
      customer: record.customer,
      parts: record.parts,
      bench: record.bench,
      answers: record.answers,
      crit: record.crit,
      dateTriaged: record.dateTriaged,
      missing: record.missing,
      expectedId: record.expectedId,
      actualId: record.actualId,
      hwRev: record.hwRev,
      triageNotes: record.triageNotes,
    });

    const updated = await markSheetSync(record.box, sync);
    return NextResponse.json({
      ok: sync.ok,
      record: updated || record,
      sheet: sync,
      error: sync.ok ? undefined : sync.error,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
