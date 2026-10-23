/**
 * What each capability can honestly do today. ONE source of truth: every page that mentions a capability's state reads it from here, so the
 * wording cannot drift into "Preview" in one place and "Planned" in another. Change a status here when the capability really changes.
 */

export type CapabilityId = "documents" | "expert" | "sharing" | "ai" | "market_data" | "persistence" | "screening" | "restore" | "calculator";

export interface CapabilityStatus {
  /** Short, accurate label for a badge or a sentence. */
  label: string;
  /** One honest sentence saying what this means for the person. */
  detail: string;
}

export const CAPABILITY_STATUS: Record<CapabilityId, CapabilityStatus> = {
  documents: { label: "Drafting available", detail: "You can edit and print drafts of an invoice and a packing list. They are drafts for you to check: nothing is submitted to customs or any authority." },
  expert: { label: "No expert connected", detail: "No expert is connected to the platform. It prepares a brief with your context filled in." },
  sharing: { label: "Manual sharing", detail: "You copy or download the brief and send it to an expert you choose. The platform sends nothing." },
  ai: { label: "AI not switched on", detail: "Everything is produced by rules from your data until the person running the server switches AI on, and then only when you agree each time." },
  market_data: { label: "Live data unavailable", detail: "There are no live tariffs, freight rates, exchange rates or prices. Trade figures are a dated snapshot, shown only where they are cleared for display." },
  persistence: { label: "Saved on this device only", detail: "Your work is saved in this browser. It does not follow you to another device. Export it from the Workspace page to keep a copy." },
  screening: { label: "Questions only", detail: "Screening lists questions to settle. Nothing is verified against an official source, and answering one does not mean the product complies." },
  restore: { label: "Restore not switched on", detail: "Archived products stay visible, but restoring one needs a database function that has been prepared and not yet switched on." },
  calculator: { label: "Your numbers, not market data", detail: "The calculator does arithmetic on the values you enter. Starting values are samples until you replace them." },
};

export const statusLabel = (id: CapabilityId) => CAPABILITY_STATUS[id].label;
export const statusDetail = (id: CapabilityId) => CAPABILITY_STATUS[id].detail;
