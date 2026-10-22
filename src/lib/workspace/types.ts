import type { FitLevel } from "../opportunities/types.ts";

/**
 * Shared types for the export workspace: what the server knows about a product (facts), and the
 * small amount of state that lives in the user's browser (task progress, document details, expert
 * requests). Nothing here talks to a database or the network.
 */

export type TaskStatus = "not_started" | "in_progress" | "completed" | "needs_review";
export const TASK_STATUSES: TaskStatus[] = ["not_started", "in_progress", "completed", "needs_review"];

export interface TaskState {
  status: TaskStatus;
  note: string;
  updatedAt: string;
}

/** Document details the person typed. Anything absent falls back to what the platform can prefill. */
export interface DocDetails {
  sellerName: string;
  sellerAddress: string;
  iec: string;
  gstin: string;
  buyerName: string;
  buyerAddress: string;
  buyerCountry: string;
  buyerTrn: string;
  buyerContact: string;
  invoiceNumber: string;
  invoiceDate: string;
  incoterm: string;
  paymentTerms: string;
  portLoading: string;
  portDischarge: string;
  countryOrigin: string;
  marks: string;
  currency: string;
}

export const DOC_KEYS: (keyof DocDetails)[] = [
  "sellerName", "sellerAddress", "iec", "gstin", "buyerName", "buyerAddress", "buyerCountry", "buyerTrn", "buyerContact",
  "invoiceNumber", "invoiceDate", "incoterm", "paymentTerms", "portLoading", "portDischarge", "countryOrigin", "marks", "currency",
];

export type ChecklistAnswer = "have" | "need" | "na";

export interface DocsState {
  details: Partial<DocDetails>;
  checklist: Record<string, ChecklistAnswer>;
}

export type RequestTopic = "hs" | "regulatory" | "cepa" | "freight" | "documents" | "review";
export type RequestStatus = "draft" | "ready" | "sent" | "answered" | "closed";

export interface ExpertRequest {
  id: string;
  topic: RequestTopic;
  productRef: string | null;
  productName: string | null;
  title: string;
  summary: string;
  status: RequestStatus;
  reply: string;
  createdAt: string;
  updatedAt: string;
}

/** What the server can say about one product and the company. All of it is serialisable. */
export interface WorkspaceFacts {
  ref: string;
  standalone: boolean;
  company: { name: string; legalName: string | null; address: string | null };
  product: {
    name: string;
    own: boolean;
    description: boolean;
    category: boolean;
    intendedUse: boolean;
    specCount: number;
    hsCode: string | null;
    unitWeightG: number | null;
    unitsPerCarton: number | null;
    cartonWeightKg: number | null;
    cartonDims: boolean;
    linkedFactories: string[];
    /** The product's own words, for expert briefs and documents. */
    details: { description: string | null; category: string | null; intendedUse: string | null; specs: { name: string; value: string; unit: string | null }[]; materials: string[] };
  } | null;
  fit: { level: FitLevel | null; score: number | null; gaps: string[]; missingProcesses: string[] };
  profile: { processNames: string[]; materialNames: string[]; factories: number; processes: number; machines: number; ratedMachines: number; materials: number; capacity: boolean };
  /** Screening question ids for the product's family, grouped by where they appear. */
  questions: { family: string | null; all: string[]; compliance: string[]; testing: string[]; hs: string[]; cepa: string[]; schemes: string[] };
  opportunities: { count: number; top: { id: string; name: string; score: number }[] };
}
