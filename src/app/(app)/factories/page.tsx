import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/auth/notice";
import { PageHeader } from "@/components/page-header";
import { getT } from "@/lib/i18n/server";
import { requireOrganization } from "@/lib/organization";
import { listFactories } from "@/lib/factories";
import type { Factory } from "@/lib/factory-types";

export const metadata: Metadata = { title: "Factories · Atlas" };
// Reads the session on every request (see the (app) layout for why this opts out of instant validation).
export const instant = false;

// Fixed messages only: nothing from the query string is ever shown to the user.
const NOTICES: Record<string, { tone: "success" | "error" | "info"; text: string }> = {
  factory_added: { tone: "success", text: "Factory added." },
  factory_updated: { tone: "success", text: "Factory details saved." },
  factory_archived: { tone: "success", text: "Factory archived. It no longer appears in your active factories." },
  factory_missing: { tone: "error", text: "That factory could not be found, or it was already archived." },
  not_owner: { tone: "error", text: "Only company owners can add or change factories." },
  archive_failed: { tone: "error", text: "We could not archive that factory right now. Nothing was changed. Try again." },
};

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

function Address({ f, country }: { f: Factory; country: string }) {
  return (
    <>
      <p className="mt-0.5 break-words text-sm text-muted-foreground">
        {f.addressLine1}
        {f.addressLine2 ? `, ${f.addressLine2}` : ""}
      </p>
      <p className="break-words text-sm text-muted-foreground">
        {f.city}, {f.state} {f.postalCode}, {country}
      </p>
    </>
  );
}

export default async function FactoriesPage({ searchParams }: PageProps<"/factories">) {
  const { t } = await getT();
  const { organization } = await requireOrganization();
  const params = await searchParams;
  const pick = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const notice = NOTICES[pick(params.notice) ?? ""];
  const showArchived = pick(params.show) === "archived";
  const { active, archived } = await listFactories(organization.id);
  const isOwner = organization.role === "owner";

  return (
    <>
      <PageHeader
        eyebrow={t("My Factory")}
        title={t("Factories")}
        description={t("The sites you export from. Open a factory to describe its processes, capacity, machinery, materials and products.")}
        action={
          isOwner && (
            <Button asChild>
              <Link href="/factories/new">{t("Add factory")}</Link>
            </Button>
          )
        }
      />

      {notice && (
        <div className="mt-6">
          <Notice tone={notice.tone}>{t(notice.text)}</Notice>
        </div>
      )}

      <section className="mt-8" aria-labelledby="active-heading">
        <h2 id="active-heading" className="text-lg font-semibold tracking-tight">
          {t("Active factories")} <span className="font-normal text-muted-foreground">({active.length})</span>
        </h2>
        <div className="mt-4">
          {active.length === 0 ? (
            <EmptyState
              title={t("No active factories")}
              description={
                archived.length > 0
                  ? t("All your factories are archived. Register a replacement to continue to your dashboard.")
                  : t("Register your first factory to continue to your dashboard.")
              }
              action={
                isOwner && (
                  <Button asChild>
                    <Link href="/factories/new">{t("Register a factory")}</Link>
                  </Button>
                )
              }
            />
          ) : (
            <ul className="divide-y rounded-lg border bg-card">
              {active.map((f) => (
                <li key={f.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 sm:px-5">
                  <div className="min-w-0">
                    <h3 className="break-words text-[15px] font-semibold">{f.name}</h3>
                    <Address f={f} country={t("India")} />
                  </div>
                  <div className="flex gap-2">
                    <Button asChild size="sm">
                      <Link href={`/factories/${f.id}`} aria-label={t("Open profile of {name}", { name: f.name })}>
                        {t("Open profile")}
                      </Link>
                    </Button>
                    {isOwner && (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/factories/${f.id}/setup`}>{t("Guided setup")}</Link>
                      </Button>
                    )}
                    {isOwner && (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/factories/${f.id}/edit`} aria-label={t("Edit {name}", { name: f.name })}>
                          {t("Edit")}
                        </Link>
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {archived.length > 0 && (
        <section className="mt-10" aria-labelledby="archived-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="archived-heading" className="text-base font-semibold tracking-tight">
              {t("Archived factories")} <span className="font-normal text-muted-foreground">({archived.length})</span>
            </h2>
            <Link
              href={showArchived ? "/factories" : "/factories?show=archived"}
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {showArchived ? t("Hide archived") : t("Show archived")}
            </Link>
          </div>
          {showArchived && (
            <ul className="mt-4 divide-y rounded-lg border bg-card">
              {archived.map((f) => (
                <li key={f.id} className="px-4 py-4 sm:px-5">
                  <h3 className="break-words text-[15px] font-semibold text-muted-foreground">{f.name}</h3>
                  <Address f={f} country={t("India")} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("Archived {date}. Read only.", { date: f.archivedAt ? dateFormat.format(new Date(f.archivedAt)) : "" })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
