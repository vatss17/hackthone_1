import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Notice } from "@/components/auth/notice";
import { PageHeader } from "@/components/page-header";
import { FactoryForm } from "@/components/factories/factory-form";
import { ArchiveFactory } from "@/components/factories/archive-factory";
import { requireOrganization } from "@/lib/organization";
import { getActiveFactory } from "@/lib/factories";
import { isUuid } from "@/lib/factory-validation";
import { updateFactory } from "@/lib/actions/factory";

export const metadata: Metadata = { title: "Edit factory · Export Enablement Platform" };
export const instant = false;

export default async function EditFactoryPage({ params }: PageProps<"/factories/[id]/edit">) {
  const { organization } = await requireOrganization();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  // Looked up inside the user's own company: another company's id, an archived factory and an
  // unknown id all look the same (not found).
  const factory = await getActiveFactory(organization.id, id);
  if (!factory) notFound();

  return (
    <>
      <PageHeader eyebrow="My Factory" title={`Edit ${factory.name}`} description="Change this factory's details." />
      <div className="mt-6 max-w-[34rem]">
        {organization.role !== "owner" ? (
          <Notice tone="error">Only company owners can change factories.</Notice>
        ) : (
          <>
            <div className="rounded-md border bg-card p-5 sm:p-6">
              <FactoryForm
                action={updateFactory}
                id={factory.id}
                initial={{
                  factoryName: factory.name,
                  addressLine1: factory.addressLine1,
                  addressLine2: factory.addressLine2 ?? "",
                  city: factory.city,
                  state: factory.state,
                  postalCode: factory.postalCode,
                }}
                submitLabel="Save changes"
                pendingLabel="Saving…"
                cancelHref="/factories"
              />
            </div>

            <section className="mt-8 rounded-md border bg-card p-5 sm:p-6" aria-labelledby="archive-heading">
              <h2 id="archive-heading" className="text-base font-semibold tracking-tight">
                Archive this factory
              </h2>
              <p className="mb-4 mt-1 text-sm text-muted-foreground">
                Archiving hides the factory from your active list. Nothing is deleted. If it is your only factory you
                will be asked to register a replacement before using the dashboard.
              </p>
              <ArchiveFactory id={factory.id} name={factory.name} />
            </section>
          </>
        )}
      </div>
    </>
  );
}
