import type { Metadata } from "next";
import { Notice } from "@/components/auth/notice";
import { PageHeader } from "@/components/page-header";
import { FactoryForm } from "@/components/factories/factory-form";
import { requireOrganization } from "@/lib/organization";
import { listFactories } from "@/lib/factories";
import { addFactory } from "@/lib/actions/factory";

export const metadata: Metadata = { title: "Add a factory · Export Enablement Platform" };
export const instant = false;

export default async function NewFactoryPage() {
  const { organization } = await requireOrganization();
  const { active } = await listFactories(organization.id);
  const first = active.length === 0;

  return (
    <>
      <PageHeader
        eyebrow={first ? "Get started" : "My Factory"}
        title={first ? "Register your first factory" : "Add a factory"}
        description={
          first
            ? "Add the site you export from. After this you will reach your dashboard, and you can add more factories at any time."
            : "Add another site under your company."
        }
      />
      <div className="mt-6 max-w-[34rem]">
        {organization.role !== "owner" ? (
          <Notice tone="error">Only company owners can add factories.</Notice>
        ) : (
          <div className="rounded-md border bg-card p-5 sm:p-6">
            <FactoryForm
              action={addFactory}
              submitLabel="Register factory"
              pendingLabel="Registering…"
              cancelHref="/factories"
            />
          </div>
        )}
      </div>
    </>
  );
}
