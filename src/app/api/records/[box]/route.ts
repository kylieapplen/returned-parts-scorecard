import { NextResponse } from "next/server";
import { getRecord, upsertRecord, markSheetSync, normalizeInput } from "@/lib/records";
import { syncToPartDocumentation } from "@/lib/sheet";
import type { RecordInput } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ box: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { box } = await ctx.params;
    const record = await getRecord(decodeURIComponent(box));
    if (!record) {
      return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, record });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, ctx: Ctx) {
  try {
    const { box } = await ctx.params;
    const body = (await request.json()) as RecordInput & { syncSheet?: boolean };
    body.box = decodeURIComponent(box);
    const saved = await upsertRecord(body);
    const shouldSync = body.syncSheet !== false;

    if (shouldSync) {
      const payload = normalizeInput(body);
      const sync = await syncToPartDocumentation(payload);
      const updated = await markSheetSync(saved.box, sync);
      return NextResponse.json({ ok: true, record: updated || saved, sheet: sync });
    }

    return NextResponse.json({ ok: true, record: saved, sheet: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message === "missing box" ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
