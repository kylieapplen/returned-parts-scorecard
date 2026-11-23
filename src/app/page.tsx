import Link from "next/link";
import { listRecords } from "@/lib/records";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let records: Awaited<ReturnType<typeof listRecords>> = [];
  let loadError: string | null = null;
  try {
    records = await listRecords();
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  }

  return (
    <main className="app-shell">
      <header className="brand-bar">
        <div>
          <h1 className="brand">
            Returned Parts <span>Scorecard</span>
          </h1>
          <p className="brand-sub">
            Diagnose returned boxes, then update Diego&apos;s Part Documentation sheet.
          </p>
        </div>
        <div className="top-actions">
          <Link className="btn btn-primary" href="/r/new">
            New box
          </Link>
        </div>
      </header>

      <section className="panel">
        <h2>Boxes</h2>
        {loadError ? (
          <p className="empty">Could not load boxes yet. Try refresh. ({loadError})</p>
        ) : records.length === 0 ? (
          <p className="empty">No records yet. Start with a new box triage.</p>
        ) : (
          <div className="list">
            {records.map((r) => (
              <Link key={r.box} className="list-item" href={`/r/${encodeURIComponent(r.box)}`}>
                <div className="box-id">#{r.box}</div>
                <div>
                  <div>{r.customer || "No customer"}</div>
                  <div className="meta">
                    {r.bench}
                    {r.parts.length ? ` · ${r.parts.join(", ")}` : ""}
                  </div>
                </div>
                <span
                  className={`score-pill ${
                    r.result === "Pass" ? "pass" : r.result === "Coach" ? "coach" : "none"
                  }`}
                >
                  {r.statusText || "—"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
