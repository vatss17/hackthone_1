import type { Metadata } from "next";
import { Landing } from "@/components/public/landing";

export const metadata: Metadata = { title: "Atlas · Export operating system" };

export default function WelcomePage() {
  return <Landing />;
}
