import { scoreAnswers } from "./score";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const allYes: Record<string, string> = {};
for (let i = 1; i <= 10; i++) allYes[String(i)] = "Yes";

const pass = scoreAnswers(allYes, "No fault found");
assert(pass.result === "Pass", `expected Pass, got ${pass.result}`);
assert(pass.pct === 1, `expected 100%, got ${pass.pct}`);
assert(
  pass.statusText === "No fault found · Pass 100%",
  `unexpected status: ${pass.statusText}`,
);

const withCrit = { ...allYes, "2": "No" };
const coach = scoreAnswers(withCrit, "Fault confirmed");
assert(coach.result === "Coach", `expected Coach for critical miss`);
assert(coach.crit.length === 1, `expected one critical`);

const low = scoreAnswers(
  { "1": "Yes", "2": "Yes", "3": "No", "4": "No", "5": "Yes" },
  "Needs further diagnosis",
);
assert(low.result === "Coach", "expected Coach under 85%");
assert(Math.round((low.pct || 0) * 100) === 60, `expected 60%, got ${low.pct}`);

console.log("score.test.ts: ok");
