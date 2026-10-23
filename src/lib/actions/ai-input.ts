"use server";

import { requireOrganization } from "@/lib/organization";
import { aiStatus } from "@/lib/ai/provider";

/** Whether the server's AI is switched on, so the interface offers the right input path. Says nothing secret. */
export async function inputCapabilities(): Promise<{ ai: boolean }> {
  await requireOrganization();
  return { ai: aiStatus(process.env).configured };
}
