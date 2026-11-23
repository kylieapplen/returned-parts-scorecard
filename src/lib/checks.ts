export type Answer = "Yes" | "No" | "";

export type TrackingKey = "bakeDay" | "repeatFailure" | "safetyConcern";
export type TrackingAnswers = Record<TrackingKey, Answer>;

export type SectionKey =
  | "displayKnobSoftware"
  | "heatingFuse"
  | "steam"
  | "partShipped"
  | "valveSent"
  | "controlPcbSent";

export type Sections = Record<SectionKey, boolean>;

export type CheckDef = {
  number: number;
  label: string;
  /** Which call section this belongs to (always = every call). */
  section: "always" | SectionKey | "bakeDay" | "repeatFailure";
};

export type CriticalMissDef = {
  id: string;
  label: string;
};

/** Tracking only — shows/hides some checks; never enters the score. */
export const TRACKING_QUESTIONS: { key: TrackingKey; label: string; help: string }[] = [
  {
    key: "bakeDay",
    label: "Bake day coming?",
    help: "Yes if the customer had a bake, market, event, or big order coming up.",
  },
  {
    key: "repeatFailure",
    label: "Repeat failure on this oven?",
    help: "Yes if the same part was already sent to this serial, or this is the oven’s second board.",
  },
  {
    key: "safetyConcern",
    label: "Safety concern reported?",
    help: "Yes if a shock, burning smell, smoke, burnt wires, or moisture came up on the call.",
  },
];

export const SECTION_TOGGLES: { key: SectionKey; label: string }[] = [
  { key: "displayKnobSoftware", label: "Display, knob, or software problems" },
  { key: "heatingFuse", label: "Heating or fuse problems" },
  { key: "steam", label: "Steam problems" },
  { key: "partShipped", label: "A part was / will be shipped" },
  { key: "valveSent", label: "A valve was sent (steam)" },
  { key: "controlPcbSent", label: "A control PCB was sent" },
];

export const CHECKS: CheckDef[] = [
  {
    number: 1,
    section: "always",
    label:
      "Serial number, right customer: serial is on the ticket, and the ticket is on the buyer’s own HubSpot contact, spelled right",
  },
  {
    number: 2,
    section: "always",
    label: "Delivery date or version: either one is written down",
  },
  {
    number: 3,
    section: "always",
    label:
      "Earlier parts listed: parts already sent to this serial are listed, or the ticket says none were sent",
  },
  {
    number: 4,
    section: "always",
    label:
      "Safety questions asked: rep asked all five (shock, burning smell, smoke, burnt wires, moisture). If any was yes, the oven was turned off and unplugged before any work",
  },
  {
    number: 5,
    section: "always",
    label:
      "Troubleshooting written down: the FAQ sheet and the last step reached. If there’s no FAQ sheet for the symptom, every step the rep took",
  },
  {
    number: 6,
    section: "displayKnobSoftware",
    label: "Firmware version: the version number from the Info screen",
  },
  {
    number: 7,
    section: "displayKnobSoftware",
    label:
      "Update before hardware: updated to 1.3.0 (never a beta). If the update failed or was missing, escalated for remote recovery before any part",
  },
  {
    number: 8,
    section: "heatingFuse",
    label: "Grafana: which deck runs hot or slow and since when, or “normal”",
  },
  {
    number: 9,
    section: "heatingFuse",
    label:
      "Heater and fuse: a resistance number in ohms (68–72 Ω is normal) plus the fuse and fuse-housing result",
  },
  {
    number: 10,
    section: "steam",
    label: "Steam test: the number of presses to empty a full reservoir, not a description",
  },
  {
    number: 11,
    section: "steam",
    label: "Water type: distilled, filtered, or tap",
  },
  {
    number: 12,
    section: "valveSent",
    label:
      "Valve cleaned first: customer cleaned the valve and re-tested on distilled water, and it still failed",
  },
  {
    number: 13,
    section: "controlPcbSent",
    label:
      "Control board lights: each LED (on, off, or flashing), and whether the display and buttons work",
  },
  {
    number: 14,
    section: "partShipped",
    label:
      "Proof test for each part: the named test from the Approval Criteria table. If a part has no test, the ticket says why it was needed",
  },
  {
    number: 15,
    section: "partShipped",
    label:
      "One part per problem: extras only with Engineering or CSM approval written on the ticket",
  },
  {
    number: 16,
    section: "bakeDay",
    label:
      "Bake day handled: a way to keep baking was offered, and only the one approved part was rushed",
  },
  {
    number: 17,
    section: "repeatFailure",
    label: "Repeat sent to Engineering: Engineering was looped in before any part was approved",
  },
  {
    number: 18,
    section: "partShipped",
    label:
      "Return set up and packed: Return Label Required? = Yes, ticket # on the box, only the named part inside, fuses left in, a photo before sealing, and the label scanned",
  },
];

export const CRITICAL_MISSES: CriticalMissDef[] = [
  {
    id: "software_or_no_hw",
    label:
      "Hardware was sent even though the rep found a software cause, or said there was no sign of a hardware fault",
  },
  {
    id: "multi_part_no_test",
    label: "More than one part was sent without a test proving each one bad",
  },
  {
    id: "repeat_no_eng",
    label:
      "A repeat failure didn’t go to Engineering (also counts for a safety case the customer asked to escalate, or one that was still unsafe with the oven unplugged)",
  },
  {
    id: "ruled_out",
    label: "A part was sent for a problem the ticket had already ruled out",
  },
];

export const BENCH_OPTIONS = [
  "Not tested yet",
  "No fault found",
  "Fault confirmed",
  "Different fault",
  "Unable to test",
] as const;

export type BenchResult = (typeof BENCH_OPTIONS)[number];

export function emptyTracking(): TrackingAnswers {
  return { bakeDay: "", repeatFailure: "", safetyConcern: "" };
}

export function emptySections(): Sections {
  return {
    displayKnobSoftware: false,
    heatingFuse: false,
    steam: false,
    partShipped: false,
    valveSent: false,
    controlPcbSent: false,
  };
}

/** Checks that apply given tracking + section toggles. */
export function applicableChecks(
  tracking: TrackingAnswers,
  sections: Sections,
): CheckDef[] {
  return CHECKS.filter((c) => {
    if (c.section === "always") return true;
    if (c.section === "bakeDay") return tracking.bakeDay === "Yes";
    if (c.section === "repeatFailure") return tracking.repeatFailure === "Yes";
    if (c.section === "valveSent") return sections.steam && sections.valveSent;
    if (c.section === "controlPcbSent") {
      return sections.partShipped && sections.controlPcbSent;
    }
    if (c.section === "partShipped") return sections.partShipped;
    if (c.section === "displayKnobSoftware") return sections.displayKnobSoftware;
    if (c.section === "heatingFuse") return sections.heatingFuse;
    if (c.section === "steam") return sections.steam;
    return false;
  });
}

export function sectionHeading(section: CheckDef["section"]): string {
  switch (section) {
    case "always":
      return "Every call";
    case "displayKnobSoftware":
      return "Display, knob, or software";
    case "heatingFuse":
      return "Heating or fuse";
    case "steam":
    case "valveSent":
      return "Steam";
    case "partShipped":
    case "controlPcbSent":
    case "bakeDay":
    case "repeatFailure":
      return "Before a part ships";
    default:
      return "Checks";
  }
}
