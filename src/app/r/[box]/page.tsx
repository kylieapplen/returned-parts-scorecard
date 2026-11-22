import Link from "next/link";
import { notFound } from "next/navigation";
import { RecordForm } from "@/components/RecordForm";
import { getRecord } from "@/lib/records";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ box: string }> };

export default async function RecordPage({ params }: Props) {
  const { box: raw } = await params;
  const box = decodeURIComponent(raw);
  if (box === "new") notFound();

  const record = await getRecord(box);
  if (!record) notFound();

  return (
    <main className="app-shell">
      <header className="brand-bar">
        <div>
          <h1 className="brand">
            Box <span>#{record.box}</span>
          </h1>
          <p className="brand-sub">
            {record.customer || "Returned part"} · {record.statusText || "No score yet"}
          </p>
        </div>
        <div className="top-actions">
          <Link className="btn btn-secondary" href="/">
            All boxes
          </Link>
          <Link className="btn btn-primary" href="/r/new">
            New box
          </Link>
        </div>
      </header>
      <RecordForm initial={record} />
    </main>
  );
}
