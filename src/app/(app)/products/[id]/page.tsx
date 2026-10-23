import type { Metadata } from "next";
import { FormAssist } from "@/components/ai-input/form-assist";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { ActionButton, Disclosure, Field, Flash, Select, SubmitButton, Textarea } from "@/components/profile/form-bits";
import { CATEGORY_SUGGESTIONS } from "@/components/profile/category-suggestions";
import { getT } from "@/lib/i18n/server";
import { requireOrganization } from "@/lib/organization";
import { listFactories } from "@/lib/factories";
import { getProductDetail } from "@/lib/capabilities";
import { isUuid } from "@/lib/factory-validation";
import { ArchiveProduct } from "@/components/products/archive-product";
import { addSpecification, linkFactory, removeSpecification, unlinkFactory, updateProduct } from "@/lib/actions/capabilities";

export const metadata: Metadata = { title: "Product · Atlas" };
export const instant = false;

export default async function ProductPage({ params, searchParams }: PageProps<"/products/[id]">) {
  const { t } = await getT();
  const { organization } = await requireOrganization();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const product = await getProductDetail(organization.id, id);
  if (!product) notFound();
  const [{ active }, sp] = await Promise.all([listFactories(organization.id), searchParams]);
  const isOwner = organization.role === "owner";
  const linked = new Set(product.factories.map((f) => f.factoryId));
  const linkable = active.filter((f) => !linked.has(f.id));
  const hid = <input type="hidden" name="productId" value={product.id} />;

  return (
    <>
      <PageHeader
        eyebrow={t("Products")}
        title={product.name}
        description={product.category ?? t("No category set")}
        action={
          <Button asChild>
            <Link href={`/opportunities/${product.id}`}>{t("Explore export potential")}</Link>
          </Button>
        }
      />
      <Flash params={sp} />

      <section id="details" className="mt-8 scroll-mt-20" aria-labelledby="details-h">
        <div className="flex items-center justify-between gap-2">
          <h2 id="details-h" className="text-lg font-semibold tracking-tight">
            {t("Details")}
          </h2>
          <StatusBadge kind="user" />
        </div>
        <dl className="mt-3 divide-y rounded-lg border bg-card">
          {[
            [t("Intended use"), product.intendedUse ?? t("Not provided")],
            [t("Description"), product.description ?? t("Not provided")],
            [t("Your product code"), product.internalCode ?? t("Not provided")],
            [t("Weight of one unit"), product.unitWeightG !== null ? `${product.unitWeightG} g` : t("Not provided")],
            [t("HS code (claimed)"), product.hsCodeClaimed ? t("{code} (unverified)", { code: product.hsCodeClaimed }) : t("Not provided. Classification is checked later.")],
          ].map(([k, v]) => (
            <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[12rem_1fr] sm:gap-4 sm:px-5">
              <dt className="text-sm text-muted-foreground">{k}</dt>
              <dd className="min-w-0 whitespace-pre-line break-words text-sm">{v}</dd>
            </div>
          ))}
        </dl>
        {isOwner && (
          <Disclosure summary={t("Edit details")}>
            <form action={updateProduct} className="grid gap-4">
              {hid}
              <FormAssist kind="product" />
              <Field id="name" name="name" label={t("Product name")} defaultValue={product.name} required maxLength={200} autoComplete="off" />
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Field id="category" name="category" label={t("Category")} defaultValue={product.category ?? ""} maxLength={100} autoComplete="off" list="category-suggestions" />
                  <datalist id="category-suggestions">
                    {CATEGORY_SUGGESTIONS.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <Field id="internalCode" name="internalCode" label={t("Your product code (optional)")} defaultValue={product.internalCode ?? ""} maxLength={60} autoComplete="off" />
              </div>
              <Field id="intendedUse" name="intendedUse" label={t("Intended use")} defaultValue={product.intendedUse ?? ""} maxLength={500} autoComplete="off" />
              <Textarea id="description" name="description" label={t("Description")} defaultValue={product.description ?? ""} maxLength={2000} />
              <Field id="unitWeightG" name="unitWeightG" label={t("Weight of one unit in grams (optional)")} defaultValue={product.unitWeightG ?? ""} inputMode="decimal" autoComplete="off" />
              <div>
                <SubmitButton>{t("Save details")}</SubmitButton>
              </div>
            </form>
          </Disclosure>
        )}
      </section>

      <section id="specifications" className="mt-10 scroll-mt-20" aria-labelledby="spec-h">
        <h2 id="spec-h" className="text-lg font-semibold tracking-tight">
          {t("Specifications")}
        </h2>
        <div className="mt-3">
          {product.specs.length === 0 ? (
            <EmptyState title={t("No specifications yet")} description={t("Add facts such as material, capacity, dimensions or colour.")} />
          ) : (
            <ul className="divide-y rounded-lg border bg-card">
              {product.specs.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
                  <p className="min-w-0 break-words text-sm">
                    <span className="text-muted-foreground">{s.name}:</span> {s.value}
                    {s.unit ? ` ${s.unit}` : ""}
                  </p>
                  {isOwner && (
                    <ActionButton action={removeSpecification} hidden={{ id: s.id, productId: product.id }} label={t("Remove {name}", { name: s.name })}>
                      {t("Remove")}
                    </ActionButton>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        {isOwner && (
          <Disclosure summary={t("Add a specification")}>
            <form action={addSpecification} className="grid gap-4 sm:grid-cols-[1.2fr_1fr_6rem]">
              {hid}
              <Field id="sn" name="name" label={t("Name")} required maxLength={100} autoComplete="off" placeholder={t("e.g. Capacity")} />
              <Field id="sv" name="value" label={t("Value")} required maxLength={500} autoComplete="off" placeholder={t("e.g. 750")} />
              <Field id="su" name="unit" label={t("Unit")} maxLength={30} autoComplete="off" placeholder="ml" />
              <div className="sm:col-span-3">
                <SubmitButton>{t("Add specification")}</SubmitButton>
              </div>
            </form>
          </Disclosure>
        )}
      </section>

      <section id="factories" className="mt-10 scroll-mt-20" aria-labelledby="fac-h">
        <h2 id="fac-h" className="text-lg font-semibold tracking-tight">
          {t("Made at")}
        </h2>
        <div className="mt-3">
          {product.factories.length === 0 ? (
            <EmptyState title={t("Not linked to a factory")} description={t("Link this product to the factory that makes it so its capabilities count in your suggestions.")} />
          ) : (
            <ul className="divide-y rounded-lg border bg-card">
              {product.factories.map((f) => (
                <li key={f.linkId} className="flex items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
                  <Link href={`/factories/${f.factoryId}`} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                    {f.name}
                  </Link>
                  {isOwner && (
                    <ActionButton action={unlinkFactory} hidden={{ id: f.linkId, productId: product.id }} label={t("Unlink {name}", { name: f.name })}>
                      {t("Unlink")}
                    </ActionButton>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        {isOwner && linkable.length > 0 && (
          <Disclosure summary={t("Link a factory")}>
            <form action={linkFactory} className="grid gap-4 sm:max-w-sm">
              {hid}
              <Select id="lf" name="factoryId" label={t("Factory")} required options={linkable.map((f) => ({ value: f.id, label: f.name }))} placeholder={t("Choose…")} />
              <div>
                <SubmitButton>{t("Link factory")}</SubmitButton>
              </div>
            </form>
          </Disclosure>
        )}
      </section>

      {isOwner && (
        <section className="mt-12 rounded-lg border bg-card p-5 sm:p-6" aria-labelledby="arch-h">
          <h2 id="arch-h" className="text-base font-semibold tracking-tight">
            {t("Archive this product")}
          </h2>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">{t("Archiving takes it out of your active list. Nothing is deleted, and you get a few seconds to undo.")}</p>
          <ArchiveProduct productId={product.id} productName={product.name} />
        </section>
      )}
    </>
  );
}
