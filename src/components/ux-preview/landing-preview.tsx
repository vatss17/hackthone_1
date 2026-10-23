"use client";

import { usePreview } from "@/lib/ux-preview/use-preview.ts";
import { Landing } from "./landing.tsx";

export function PreviewLanding() {
  const { state } = usePreview();
  return <Landing returning={state.scenario === "returning-visit"} />;
}
