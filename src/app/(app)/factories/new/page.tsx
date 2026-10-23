import type { Metadata } from "next";
import { Notice } from "@/components/auth/notice";
import { PageHeader } from "@/components/page-header";
import { FactoryForm } from "@/components/factories/factory-form";
import { getT } from "@/lib/i18n/server";
import { requireOrganization } from "@/lib/organization";
import { listFactories } from "@/lib/factories";
import { addFactory } from "@/lib/actions/factory";

export const metadata: Metadata = { title: "Add a factory · Atlas" };
export const instant = false;

export default async function NewFactoryPage() {
  const { t } = await getT();
  const { organization } = await requireOrganization();
  const { active } = await listFactories(organization.id);
  const first = active.length === 0;

  return (
    <>
      <PageHeader
        eyebrow={first ? t("Get started") : t("My Factory")}
        title={first ? t("Register your first factory") : t("Add a factory")}
        description={
          first
            ? t("Add the site you export from. After this you will reach your dashboard, and you can add more factories at any time.")
            : t("Add another site under your company.")
        }
      />
      <div className="mt-6 max-w-[34rem]">
        {organization.role !== "owner" ? (
          <Notice tone="error">{t("Only company owners can add factories.")}</Notice>
        ) : (
          <div className="rounded-lg border bg-card p-5 sm:p-6">
            <FactoryForm
              action={addFactory}
              submitLabel={t("Register factory")}
              pendingLabel={t("Registering…")}
              cancelHref="/factories"
            />
          </div>
        )}
      </div>
    </>
  );
}
