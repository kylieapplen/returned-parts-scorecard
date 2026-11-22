import type { Answer, BenchResult } from "./checks";

export type RecordInput = {
  box: string;
  ticket?: string;
  customer?: string;
  parts?: string[];
  bench?: BenchResult | string;
  answers?: Record<string, Answer | string>;
  dateTriaged?: string;
  missing?: string;
  expectedId?: string;
  actualId?: string;
  hwRev?: string;
  triageNotes?: string;
};

export type StoredRecord = {
  box: string;
  ticket: string;
  customer: string;
  parts: string[];
  bench: string;
  answers: Record<string, string>;
  crit: string[];
  dateTriaged: string;
  missing: string;
  expectedId: string;
  actualId: string;
  hwRev: string;
  triageNotes: string;
  sheetAction: string | null;
  sheetRow: number | null;
  sheetError: string | null;
  sheetSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
  statusText: string;
  result: "Pass" | "Coach" | "";
  scorePct: number | null;
};

export type SheetSyncResult = {
  ok: boolean;
  action?: "updated" | "appended";
  row?: number;
  error?: string;
  skipped?: boolean;
};
