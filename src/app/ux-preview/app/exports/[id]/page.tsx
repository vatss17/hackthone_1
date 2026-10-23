import { AppFrame } from "@/components/ux-preview/chrome";
import { ProjectPage } from "@/components/ux-preview/workspace";
import { OPPORTUNITIES, PROJECTS } from "@/lib/ux-preview/data";

// The prototype's project page reads the route parameter at request time; opt out of instant-navigation validation like the real app does.
export const instant = false;

export function generateStaticParams() {
  return [...new Set([...PROJECTS.map((p) => p.id), ...OPPORTUNITIES.map((o) => o.id)])].map((id) => ({ id }));
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AppFrame screen={`W7e · Export project (${id})`} active="/ux-preview/app/exports"><ProjectPage id={id} /></AppFrame>;
}
