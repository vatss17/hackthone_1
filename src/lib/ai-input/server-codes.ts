import type { AiErrorCode } from "../ai/provider.ts";

/** Failure codes shared by the endpoints and the interface (no server-only imports, so the browser can use the type). */
export type InputFailureCode = AiErrorCode | "unauthorized" | "empty" | "unsupported" | "bad_request";
