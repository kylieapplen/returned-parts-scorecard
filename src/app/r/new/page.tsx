import Link from "next/link";
import { RecordForm } from "@/components/RecordForm";

export default function NewRecordPage() {
  return (
    <main className="app-shell">
      <header className="brand-bar">
        <div>
          <h1 className="brand">
            Returned Parts <span>Scorecard</span>
          </h1>
          <p className="brand-sub">New box — score the CS tech’s triage work</p>
        </div>
        <div className="top-actions">
          <Link className="btn btn-secondary" href="/">
            All boxes
          </Link>
        </div>
      </header>
      <RecordForm />
    </main>
  );
}
