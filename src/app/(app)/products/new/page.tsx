import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/auth/notice";
import { PageHeader } from "@/components/page-header";
import { Field, Flash, SubmitButton, Textarea } from "@/components/profile/form-bits";
import { requireOrganization } from "@/lib/organization";
import { listFactories } from "@/lib/factories";
import { isUuid } from "@/lib/factory-validation";
import { createProduct } from "@/lib/actions/capabilities";
import { CATEGORY_SUGGESTIONS } from "@/components/profile/category-suggestions";

export const metadata: Metadata = { title: "Add product · Export Enablement Platform" };
export const instant = false;

export default async function NewProductPage({ searchParams }: PageProps<"/products/new">) {
  const { organization } = await requireOrganization();
  const [{ active }, sp] = await Promise.all([listFactories(organization.id), searchParams]);
  const preselect = typeof sp.factory === "string" && isUuid(sp.factory) ? sp.factory : active.length === 1 ? active[0].id : null;

  return (
    <>
      <PageHeader eyebrow="Products" title="Add a product" description="Describe a finished product you make. You can refine it afterwards." />
      <Flash params={sp} />
      <div className="mt-6 max-w-2xl" id="form">
        {organization.role !== "owner" ? (
          <Notice tone="error">Only company owners can add products.</Notice>
        ) : (
          <form action={createProduct} className="grid gap-5 rounded-md border bg-card p-5 sm:p-6">
            <Field id="name" name="name" label="Product name" required maxLength={200} autoComplete="off" placeholder="e.g. Plastic containers" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Field id="category" name="category" label="Category" maxLength={100} autoComplete="off" list="category-suggestions" placeholder="e.g. Household storage" />
                <datalist id="category-suggestions">
                  {CATEGORY_SUGGESTIONS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <Field id="internalCode" name="internalCode" label="Your product code (optional)" maxLength={60} autoComplete="off" />
            </div>
            <Field id="intendedUse" name="intendedUse" label="Intended use" maxLength={500} autoComplete="off" placeholder="e.g. Storing and carrying food at home" />
            <Textarea id="description" name="description" label="Description" maxLength={2000} placeholder="What it is, sizes, colours, notable features." />
            <Field id="unitWeightG" name="unitWeightG" label="Weight of one unit in grams (optional)" inputMode="decimal" autoComplete="off" />

            <fieldset className="grid gap-3">
              <legend className="text-sm font-medium">Made at</legend>
              {active.length === 0 ? (
                <p className="text-sm text-muted-foreground">Register a factory first to link this product to it.</p>
              ) : (
                active.map((f) => (
                  <label key={f.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="factoryIds" value={f.id} defaultChecked={f.id === preselect} className="size-4 accent-primary" />
                    {f.name}
                  </label>
                ))
              )}
            </fieldset>

            <fieldset className="grid gap-3">
              <legend className="text-sm font-medium">Specifications (optional, up to three here)</legend>
              <p className="text-xs text-muted-foreground">For example Material: PP, Capacity: 750 ml. You can add more afterwards.</p>
              {[1, 2, 3].map((i) => (
                <div key={i} className="grid gap-3 sm:grid-cols-[1.2fr_1fr_6rem]">
                  <Field id={`specName${i}`} name={`specName${i}`} label={`Specification ${i}`} maxLength={100} autoComplete="off" />
                  <Field id={`specValue${i}`} name={`specValue${i}`} label="Value" maxLength={500} autoComplete="off" />
                  <Field id={`specUnit${i}`} name={`specUnit${i}`} label="Unit" maxLength={30} autoComplete="off" />
                </div>
              ))}
            </fieldset>

            <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
              <SubmitButton>Add product</SubmitButton>
              <Button asChild variant="outline" size="lg" className="h-10 md:h-9">
                <Link href="/products">Cancel</Link>
              </Button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
