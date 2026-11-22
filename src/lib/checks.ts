export type Answer = "Yes" | "No" | "";

export type CheckDef = {
  number: number;
  label: string;
  critical?: boolean;
};

/** Diagnosis checks that apply to a returned-part bench session. */
export const CHECKS: CheckDef[] = [
  { number: 1, label: "Box contents match packing list / ticket", critical: true },
  { number: 2, label: "Expected UUID / S/N matches power-on ID", critical: true },
  { number: 3, label: "Unit powers on and boots cleanly", critical: true },
  { number: 4, label: "No visible shipping or handling damage" },
  { number: 5, label: "Connectors and ports undamaged" },
  { number: 6, label: "Firmware / software version as expected" },
  { number: 7, label: "Functional self-test / diagnostics pass", critical: true },
  { number: 8, label: "Customer-reported symptom reproduced (or N/A if none)" },
  { number: 9, label: "Root cause identified and documented" },
  { number: 10, label: "Disposition recommendation recorded" },
];

export const BENCH_OPTIONS = [
  "Not tested yet",
  "No fault found",
  "Fault confirmed",
  "Unable to test",
  "Needs further diagnosis",
] as const;

export type BenchResult = (typeof BENCH_OPTIONS)[number];
