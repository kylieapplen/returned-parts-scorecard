export type Answer = "Yes" | "No" | "";

export type CheckDef = {
  number: number;
  label: string;
  critical?: boolean;
};

/**
 * Diego scores the customer-support tech — only process/quality items
 * the tech owns. Unit condition, packing, shipping damage, and root-cause
 * / disposition are out of scope for this scorecard.
 */
export const CHECKS: CheckDef[] = [
  {
    number: 1,
    label: "Tech powered on the unit and documented the boot/power result",
    critical: true,
  },
  {
    number: 2,
    label: "Tech listed the oven serial on the record",
    critical: true,
  },
  {
    number: 3,
    label: "Tech inspected connectors/ports and noted the condition",
  },
  {
    number: 4,
    label: "Tech checked and recorded the firmware / software version",
  },
  {
    number: 5,
    label: "Tech ran functional self-test / diagnostics and recorded the result",
    critical: true,
  },
  {
    number: 6,
    label:
      "Tech tried to reproduce the customer-reported symptom (or marked N/A if none)",
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
