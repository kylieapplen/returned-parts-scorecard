export type Answer = "Yes" | "No" | "";

export type CheckDef = {
  number: number;
  label: string;
  critical?: boolean;
};

/**
 * Bench checks scored for the tech — only what they control at triage.
 * Not scored: packing-list completeness (customer packing), shipping damage
 * (carrier/customer), root cause / disposition (Diego’s diagnosis work).
 */
export const CHECKS: CheckDef[] = [
  { number: 1, label: "Unit powers on and boots cleanly", critical: true },
  { number: 2, label: "Oven serial is listed", critical: true },
  { number: 3, label: "Connectors and ports undamaged" },
  { number: 4, label: "Firmware / software version as expected" },
  { number: 5, label: "Functional self-test / diagnostics pass", critical: true },
  {
    number: 6,
    label: "Customer-reported symptom reproduced (or N/A if none reported)",
  },
];

export const BENCH_OPTIONS = [
  "Not tested yet",
  "No fault found",
  "Fault confirmed",
  "Unable to test",
  "Needs further diagnosis",
] as const;

export type BenchResult = (typeof BENCH_OPTIONS)[number];
