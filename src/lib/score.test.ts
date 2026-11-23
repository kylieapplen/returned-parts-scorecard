import { emptySections, emptyTracking } from "./checks";
import { scoreAnswers } from "./score";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const tracking = emptyTracking();
const sections = {
  ...emptySections(),
  displayKnobSoftware: true,
  partShipped: true,
};

const answers: Record<string, string> = {};
for (const n of [1, 2, 3, 4, 5, 6, 7, 14, 15, 18]) answers[String(n)] = "Yes";

const pass = scoreAnswers(answers, "No fault found", tracking, sections, []);
assert(pass.result === "Pass", `expected Pass, got ${pass.result}`);
assert(pass.pct === 1, `expected 100%`);

const withMiss = scoreAnswers(answers, "Fault confirmed", tracking, sections, [
  "ruled_out",
]);
assert(withMiss.result === "Coach", "critical miss forces Coach");
assert(withMiss.crit.length === 1, "one crit label");

const bakeTracking = { ...emptyTracking(), bakeDay: "Yes" as const };
const withBake = scoreAnswers(
  {
    "1": "Yes",
    "2": "Yes",
    "3": "Yes",
    "4": "Yes",
    "5": "Yes",
    "16": "No",
  },
  "No fault found",
  bakeTracking,
  emptySections(),
  [],
);
assert(withBake.result === "Coach", "5/6 Yes with bake-day miss → Coach");
assert(Math.round((withBake.pct || 0) * 100) === 83, `expected 83%, got ${withBake.pct}`);

// Tracking alone does not score
const trackOnly = scoreAnswers({}, "Not tested yet", bakeTracking, emptySections(), []);
assert(trackOnly.pct === null, "no scored answers yet");

console.log("score.test.ts: ok");
