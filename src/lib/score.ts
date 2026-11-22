import { CHECKS, type Answer } from "./checks";

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
): ScoreResult {
  let yes = 0;
  let no = 0;
  const crit: string[] = [];

  for (const check of CHECKS) {
    const v = answers[String(check.number)];
    if (v === "Yes") yes++;
    else if (v === "No") {
      no++;
      if (check.critical) crit.push(`${check.number}. ${check.label}`);
    }
  }

  const pct = yes + no ? yes / (yes + no) : null;
  const result: ScoreResult["result"] =
    pct === null ? "" : crit.length > 0 || pct < 0.85 ? "Coach" : "Pass";
  const scorePart = result
    ? `${result}${pct !== null ? ` ${Math.round(pct * 100)}%` : ""}`
    : "";
  const statusText = [bench || "Not tested yet", scorePart].filter(Boolean).join(" · ");

  return { yes, no, pct, result, statusText, crit };
}
