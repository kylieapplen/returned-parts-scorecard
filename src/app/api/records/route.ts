import { NextResponse } from "next/server";
import { listRecords, upsertRecord, markSheetSync, normalizeInput } from "@/lib/records";
import { syncToPartDocumentation } from "@/lib/sheet";
import type { RecordInput } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const records = await listRecords();
    return NextResponse.json({ ok: true, records });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RecordInput & { syncSheet?: boolean };
    const saved = await upsertRecord(body);
    const shouldSync = body.syncSheet !== false;

    let sheet = null;
    if (shouldSync) {
      const payload = normalizeInput(body);
      const sync = await syncToPartDocumentation(payload);
      const updated = await markSheetSync(saved.box, sync);
      sheet = sync;
      return NextResponse.json({
        ok: true,
        record: updated || saved,
        sheet,
      });
    }

    return NextResponse.json({ ok: true, record: saved, sheet });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message === "missing box" ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
