import type { DocDetails } from "../workspace/types.ts";

/** Labels for the Document Studio form (not the printed documents). React-free so tests can check every string is translated. */

export const GROUPS: { title: string; keys: (keyof DocDetails)[] }[] = [
  { title: "Exporter", keys: ["sellerName", "sellerAddress", "iec", "gstin"] },
  { title: "Buyer", keys: ["buyerName", "buyerAddress", "buyerCountry", "buyerTrn", "buyerContact"] },
  { title: "Shipment", keys: ["invoiceNumber", "invoiceDate", "incoterm", "paymentTerms", "portLoading", "portDischarge", "countryOrigin", "marks", "currency"] },
];

export const LABELS: Record<keyof DocDetails, string> = {
  sellerName: "Exporter (seller)", sellerAddress: "Exporter address", iec: "Importer-Exporter Code (IEC)", gstin: "GSTIN",
  buyerName: "Buyer (consignee)", buyerAddress: "Buyer address", buyerCountry: "Buyer country", buyerTrn: "Buyer tax registration number", buyerContact: "Buyer contact (optional)",
  invoiceNumber: "Invoice number", invoiceDate: "Invoice date", incoterm: "Terms of delivery (Incoterm)", paymentTerms: "Payment terms",
  portLoading: "Port of loading", portDischarge: "Port of discharge", countryOrigin: "Country of origin (declared by exporter)", marks: "Marks and numbers", currency: "Invoice currency",
};

export const SOURCE_TEXT = { you: "Entered by you", prefilled: "From your records", calculator: "From the calculator", missing: "Missing" } as const;
