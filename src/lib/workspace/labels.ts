import type { RequestStatus, TaskStatus } from "./types.ts";

/**
 * Display text that used to sit inside components, kept here without React so tests can check every string has a Hindi and a
 * Gujarati translation. Components show it with t(label).
 */

export const MISSION_COLUMNS: { status: TaskStatus; title: string }[] = [
  { status: "not_started", title: "To do" },
  { status: "in_progress", title: "Doing" },
  { status: "needs_review", title: "Needs review" },
  { status: "completed", title: "Done" },
];

/** The next step for a saved expert request, which the person moves by hand. */
export const REQUEST_NEXT: Record<RequestStatus, { to: RequestStatus; label: string } | null> = {
  draft: { to: "ready", label: "Mark ready to share" },
  ready: { to: "sent", label: "I shared it" },
  sent: { to: "answered", label: "Record an answer" },
  answered: { to: "closed", label: "Close" },
  closed: null,
};
