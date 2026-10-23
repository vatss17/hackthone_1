import type { Metadata } from "next";
import { SampleDemo } from "@/components/ux-preview/sample-demo";

export const metadata: Metadata = { title: "Guest sample · Atlas" };

export default function SamplePage() {
  return <SampleDemo links={{ signup: "/signup", home: "/" }} />;
}
