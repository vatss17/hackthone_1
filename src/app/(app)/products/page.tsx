import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Flash } from "@/components/profile/form-bits";
import { getT } from "@/lib/i18n/server";
import { requireOrganization } from "@/lib/organization";
import { listArchivedProducts, listProducts } from "@/lib/capabilities";
import { restoreProduct } from "@/lib/actions/capabilities";

export const metadata: Metadata = { title: "Products · Atlas" };
export const instant = false;

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const { t } = await getT();
  const specs = (n: number) => (n === 1 ? t("{count} specification", { count: n }) : t("{count} specifications", { count: n }));
  const { organization } = await requireOrganization();
  const [products, archived, sp] = await Promise.all([listProducts(organization.id), listArchivedProducts(organization.id), searchParams]);
  const isOwner = organization.role === "owner";

  return (
    <>
      <PageHeader
        crumbs={[{ label: t("My factory"), href: "/factories" }, { label: t("Products") }]}
        title={t("Products you make")}
        description={t("Your finished products. Each one can be explored for its destination export potential.")}
        action={
          isOwner && (
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/products/import">{t("Import catalogue")}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/products/new">{t("Add one product")}</Link>
              </Button>
            </div>
          )
        }
      />
      <Flash params={sp} />
      <div className="mt-8">
        {products.length === 0 ? (
          <EmptyState
            title={t("No products yet")}
            description={t("Import a catalogue to start with almost no typing, or add one product by hand.")}
            action={
              isOwner && (
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <Link href="/products/import">{t("Import a catalogue")}</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/products/new">{t("Add one product")}</Link>
                  </Button>
                </div>
              )
            }
          />
        ) : (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              <span className="tnum font-medium text-foreground">{products.length}</span> {products.length === 1 ? t("product you make.") : t("products you make.")} {t("Products the platform suggests are in")}{" "}
              <Link href="/opportunities" className="font-medium text-primary underline-offset-4 hover:underline">{t("Opportunities")}</Link>.
            </p>

            {/* Wider screens: one scannable table. */}
            <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
              <Table>
                <caption className="sr-only">{t("Products you make, with category, specifications and where each is made")}</caption>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead scope="col">{t("Product")}</TableHead>
                    <TableHead scope="col">{t("Used for")}</TableHead>
                    <TableHead scope="col" className="text-right">{t("Specs")}</TableHead>
                    <TableHead scope="col">{t("Made at")}</TableHead>
                    <TableHead scope="col"><span className="sr-only">{t("Actions")}</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="max-w-[22rem] whitespace-normal">
                        <Link href={`/products/${p.id}`} className="font-medium underline-offset-4 hover:underline">{p.name}</Link>
                        {p.category && <span className="block text-[13px] text-muted-foreground">{p.category}</span>}
                      </TableCell>
                      <TableCell className="max-w-[14rem] whitespace-normal text-muted-foreground">{p.intendedUse ?? t("Not stated")}</TableCell>
                      <TableCell className="text-right">{p.specCount === 0 ? <span className="text-muted-foreground">{t("None")}</span> : p.specCount}</TableCell>
                      <TableCell className="max-w-[14rem] whitespace-normal">
                        {p.factories.length > 0 ? p.factories.map((f) => f.name).join(", ") : <span className="text-muted-foreground">{t("Not linked")}</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm">
                          <Link href={`/opportunities/${p.id}`} aria-label={t("Explore export potential for {name}", { name: p.name })}>{t("Explore potential")}</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Phones: a plain list, one product per row. */}
            <ul className="divide-y overflow-hidden rounded-lg border bg-card md:hidden">
              {products.map((p) => (
                <li key={p.id} className="px-4 py-3.5">
                  <Link href={`/products/${p.id}`} className="break-words font-medium underline-offset-4 hover:underline">{p.name}</Link>
                  {p.category && <p className="text-[13px] text-muted-foreground">{p.category}</p>}
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {specs(p.specCount)} · {p.factories.length > 0 ? t("Made at {names}", { names: p.factories.map((f) => f.name).join(", ") }) : t("Not linked to a factory")}
                  </p>
                  <div className="mt-2.5">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/opportunities/${p.id}`} aria-label={t("Explore export potential for {name}", { name: p.name })}>{t("Explore export potential")}</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {archived.length > 0 && (
        <details id="archived" className="mt-10 rounded-lg border bg-card px-4 py-3 sm:px-5" open={typeof sp.notice === "string" && sp.notice === "product_archived" ? true : undefined}>
          <summary className="cursor-pointer text-sm font-semibold">{t("Archived products ({count})", { count: archived.length })}</summary>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {t("Archived, never deleted. They no longer appear in opportunities or the workspace. Their specifications, factory links and the work saved in this browser are kept. Restoring one brings all of that back; if an active product now has the same name, rename that one first.")}
          </p>
          <ul className="mt-3 divide-y">
            {archived.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <h3 className="break-words text-[15px] font-medium">{p.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {t("Archived {date}", { date: p.archivedAt.slice(0, 10) })} · {specs(p.specCount)}
                    {p.factoryNames.length > 0 ? ` · ${t("made at {names}", { names: p.factoryNames.join(", ") })}` : ""}
                  </p>
                </div>
                {isOwner && (
                  <form action={restoreProduct}>
                    <input type="hidden" name="productId" value={p.id} />
                    <Button type="submit" variant="outline" size="sm" aria-label={t("Restore {name}", { name: p.name })}>
                      {t("Restore")}
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
