import {
  CRITICAL_MISSES,
  applicableChecks,
  type Answer,
  type Sections,
  type TrackingAnswers,
} from "./checks";

export type ScoreResult = {
  yes: number;
  no: number;
  pct: number | null;
  result: "Pass" | "Coach" | "";
  statusText: string;
  crit: string[];
};

export function scoreAnswers(
  answers: Record<string, Answer | string>,
  bench: string,
  tracking: TrackingAnswers = {
    bakeDay: "",
    repeatFailure: "",
    safetyConcern: "",
  },
  sections: Sections = {
    displayKnobSoftware: false,
    heatingFuse: false,
    steam: false,
    partShipped: false,
    valveSent: false,
    controlPcbSent: false,
  },
  criticalMissIds: string[] = [],
): ScoreResult {
  let yes = 0;
  let no = 0;
  const applicable = applicableChecks(tracking, sections);

  for (const check of applicable) {
    const v = answers[String(check.number)];
    if (v === "Yes") yes++;
    else if (v === "No") no++;
  }

  const critLabels = CRITICAL_MISSES.filter((m) => criticalMissIds.includes(m.id)).map(
    (m) => m.label,
  );

  const pct = yes + no ? yes / (yes + no) : null;
  const result: ScoreResult["result"] =
    pct === null && critLabels.length === 0
      ? ""
      : critLabels.length > 0 || (pct !== null && pct < 0.85)
        ? "Coach"
        : pct !== null
          ? "Pass"
          : "Coach";

  const scorePart = result
    ? `${result}${pct !== null ? ` ${Math.round(pct * 100)}%` : ""}`
    : "";
  const statusText = [bench || "Not tested yet", scorePart].filter(Boolean).join(" · ");

  return { yes, no, pct, result, statusText, crit: critLabels };
}
