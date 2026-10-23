import { AppFrame } from "@/components/ux-preview/chrome";
import { Assessment } from "@/components/ux-preview/assessment";

export default function Page() {
  return <AppFrame screen="W6 · Shared opportunity assessment" active="/ux-preview/app/opportunities"><Assessment /></AppFrame>;
}
