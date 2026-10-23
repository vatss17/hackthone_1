import { archiveFactory } from "@/lib/actions/factory";
import { getT } from "@/lib/i18n/server";

/**
 * Two-step archive without client JavaScript: a native disclosure reveals the
 * confirmation, and only its button submits. Archiving hides the factory and frees its
 * name; nothing is deleted.
 */
export async function ArchiveFactory({ id, name }: { id: string; name: string }) {
  const { t } = await getT();
  // The name keeps its bold weight wherever the translation puts it.
  const [before, after] = t("Archive {name}? It disappears from your active factories. Nothing is deleted, and you can register a replacement with the same name.", { name: "\u0000" }).split("\u0000");
  return (
    <details className="group">
      <summary className="inline-flex h-10 cursor-pointer list-none items-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted md:h-8 [&::-webkit-details-marker]:hidden">
        {t("Archive factory")}
      </summary>
      <form action={archiveFactory} className="mt-4 grid gap-3 rounded-md border border-border bg-muted/50 p-4">
        <input type="hidden" name="id" value={id} />
        <p className="text-sm">
          {before}
          <span className="font-medium">{name}</span>
          {after}
        </p>
        <div>
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-md bg-destructive px-3 text-sm font-medium text-white hover:opacity-90 md:h-8"
          >
            {t("Yes, archive it")}
          </button>
        </div>
      </form>
    </details>
  );
}
