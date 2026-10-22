import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Flash } from "@/components/profile/form-bits";
import { requireOrganization } from "@/lib/organization";
import { listProducts } from "@/lib/capabilities";

export const metadata: Metadata = { title: "Products · Export Enablement Platform" };
export const instant = false;

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const { organization } = await requireOrganization();
  const [products, sp] = await Promise.all([listProducts(organization.id), searchParams]);
  const isOwner = organization.role === "owner";

  return (
    <>
      <PageHeader
        eyebrow="Products"
        title="Products you make"
        description="Your finished products. Each one can be explored for its UAE export potential."
        action={
          isOwner && (
            <Button asChild>
              <Link href="/products/new">Add product</Link>
            </Button>
          )
        }
      />
      <Flash params={sp} />
      <div className="mt-8">
        {products.length === 0 ? (
          <EmptyState
            title="No products yet"
            description="Add at least one finished product so the platform can judge your export options."
            action={
              isOwner && (
                <Button asChild>
                  <Link href="/products/new">Add a product</Link>
                </Button>
              )
            }
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {products.map((p) => (
              <li key={p.id} className="flex flex-col rounded-md border bg-card p-4 sm:p-5">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="break-words text-base font-semibold">{p.name}</h2>
                  <StatusBadge kind="user" />
                </div>
                {p.category && <p className="mt-0.5 text-sm text-muted-foreground">{p.category}</p>}
                {p.intendedUse && <p className="mt-2 text-sm">{p.intendedUse}</p>}
                <p className="mt-2 text-xs text-muted-foreground">
                  {p.specCount} specification{p.specCount === 1 ? "" : "s"} ·{" "}
                  {p.factories.length > 0 ? `Made at ${p.factories.map((f) => f.name).join(", ")}` : "Not linked to a factory"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 pt-1">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/products/${p.id}`}>Open</Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href={`/opportunities/${p.id}`}>Explore export potential</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
