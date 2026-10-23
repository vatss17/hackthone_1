import type { Metadata } from "next";
import { chooseGoal } from "@/lib/actions/start";
import { requireOrganization } from "@/lib/organization";
import { getT } from "@/lib/i18n/server";
import { Box, H1, P } from "@/components/ux-preview/wf";

export const metadata: Metadata = { title: "Where would you like to start? · Atlas" };
export const instant = false;

export default async function StartPage({ searchParams }: PageProps<"/start">) {
  await requireOrganization();
  const { t } = await getT();
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <H1>{t("What would you like to do first?")}</H1>
      <P muted>{t("This only decides where we start. You can do the other one any time.")}</P>
      <P muted>{t("You can answer by chatting instead of filling a form.")}</P>
      {sp.error && <p role="alert" className="text-sm font-medium text-destructive">{t("Choose one to continue.")}</p>}
      <form action={chooseGoal} className="space-y-3">
        <Box title={t("A. Export products I already make")}>
          <P muted>{t("You have products or a catalogue. We check whether each could sell in the destination market and what it would take. Start with one product or a file.")}</P>
          <button name="goal" value="A" className="mt-3 inline-flex min-h-10 items-center rounded border border-primary bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">{t("Start with my products")}</button>
        </Box>
        <Box title={t("B. Discover what else my factory could make")}>
          <P muted>{t("You are not sure what to export yet. Tell us your processes, machines and materials. We suggest products your factory is suited to.")}</P>
          <button name="goal" value="B" className="mt-3 inline-flex min-h-10 items-center rounded border border-primary bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">{t("Start with my factory")}</button>
        </Box>
      </form>
    </div>
  );
}
